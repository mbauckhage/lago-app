CREATE TABLE IF NOT EXISTS members (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  name text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  admin boolean NOT NULL DEFAULT false,
  photo text NOT NULL DEFAULT '',
  email_updates boolean NOT NULL DEFAULT true,
  push_updates boolean NOT NULL DEFAULT true,
  calendar_token text NOT NULL UNIQUE
);

ALTER TABLE members ADD COLUMN IF NOT EXISTS calendar_prompt_seen boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  member_id integer NOT NULL REFERENCES members ON DELETE CASCADE,
  expires timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_name text NOT NULL CHECK (group_name IN ('Lago Nostre', 'Lago Plus')),
  member_id integer NOT NULL REFERENCES members ON DELETE CASCADE,
  PRIMARY KEY (group_name, member_id)
);

CREATE TABLE IF NOT EXISTS events (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  host_id integer NOT NULL REFERENCES members,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  place text NOT NULL,
  note text NOT NULL,
  people integer[] NOT NULL,
  groups text[] NOT NULL,
  cancelled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS ends_at timestamptz CHECK (ends_at > starts_at);
ALTER TABLE events ADD COLUMN IF NOT EXISTS photo text NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_deadline timestamptz;

CREATE TABLE IF NOT EXISTS responses (
  event_id integer NOT NULL REFERENCES events ON DELETE CASCADE,
  member_id integer NOT NULL REFERENCES members ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('Going', 'Maybe', 'Declined')),
  PRIMARY KEY (event_id, member_id)
);

CREATE OR REPLACE VIEW event_guests AS
SELECT e.id AS event_id, m.id AS member_id
FROM events e
JOIN members m ON m.approved AND m.id <> e.host_id
  AND (m.id = ANY(e.people) OR EXISTS (
    SELECT 1 FROM group_members g WHERE g.member_id = m.id AND g.group_name = ANY(e.groups)
  ));

CREATE TABLE IF NOT EXISTS push_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  public_key text NOT NULL,
  private_key text NOT NULL
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint text PRIMARY KEY,
  member_id integer NOT NULL REFERENCES members ON DELETE CASCADE,
  subscription jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS push_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id integer NOT NULL REFERENCES events ON DELETE CASCADE,
  member_id integer NOT NULL REFERENCES members ON DELETE CASCADE,
  kind text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION queue_event_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO push_jobs (event_id,member_id,kind)
    SELECT NEW.id,g.member_id,CASE WHEN TG_OP='INSERT' THEN 'invitation'
      WHEN NEW.cancelled THEN 'cancelled' ELSE 'updated' END
    FROM event_guests g WHERE g.event_id=NEW.id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS event_push ON events;
CREATE TRIGGER event_push AFTER INSERT OR UPDATE ON events FOR EACH ROW EXECUTE FUNCTION queue_event_push();

CREATE OR REPLACE FUNCTION signal_event_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  recipient integer;
BEGIN
  IF TG_TABLE_NAME = 'group_members' THEN
    FOR recipient IN SELECT coalesce(NEW.member_id, OLD.member_id)
      UNION SELECT e.host_id FROM events e WHERE coalesce(NEW.group_name, OLD.group_name)=ANY(e.groups)
      UNION SELECT g.member_id FROM event_guests g JOIN events e ON e.id=g.event_id
        WHERE coalesce(NEW.group_name, OLD.group_name)=ANY(e.groups) LOOP
      PERFORM pg_notify('lago_changes', recipient::text);
    END LOOP;
  ELSIF TG_TABLE_NAME IN ('responses', 'chat_messages') THEN
    FOR recipient IN SELECT member_id FROM event_guests WHERE event_id=NEW.event_id
      UNION SELECT host_id FROM events WHERE id=NEW.event_id LOOP
      PERFORM pg_notify('lago_changes', recipient::text);
    END LOOP;
    IF TG_TABLE_NAME = 'chat_messages' THEN
      INSERT INTO push_jobs(event_id,member_id,kind)
        SELECT NEW.event_id,participants.member_id,'chat' FROM (
          SELECT host_id AS member_id FROM events WHERE id=NEW.event_id
          UNION SELECT member_id FROM event_guests WHERE event_id=NEW.event_id
        ) participants WHERE participants.member_id<>NEW.sender_id;
      PERFORM pg_notify('lago_changes', 'push');
    END IF;
  ELSE
    FOR recipient IN SELECT member_id FROM event_guests WHERE event_id=NEW.id
      UNION SELECT NEW.host_id
      UNION SELECT unnest(OLD.people)
      UNION SELECT member_id FROM group_members WHERE group_name=ANY(OLD.groups) LOOP
      PERFORM pg_notify('lago_changes', recipient::text);
    END LOOP;
    IF TG_OP='INSERT' THEN
      INSERT INTO push_jobs (event_id,member_id,kind) VALUES (NEW.id,NEW.host_id,'created');
    END IF;
    PERFORM pg_notify('lago_changes', 'push');
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS event_change ON events;
CREATE TRIGGER event_change AFTER INSERT OR UPDATE ON events FOR EACH ROW EXECUTE FUNCTION signal_event_change();
DROP TRIGGER IF EXISTS response_change ON responses;
CREATE TRIGGER response_change AFTER INSERT OR UPDATE ON responses FOR EACH ROW EXECUTE FUNCTION signal_event_change();
DROP TRIGGER IF EXISTS membership_change ON group_members;
CREATE TRIGGER membership_change AFTER INSERT OR DELETE ON group_members FOR EACH ROW EXECUTE FUNCTION signal_event_change();

CREATE TABLE IF NOT EXISTS chat_messages (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id integer NOT NULL REFERENCES events ON DELETE CASCADE,
  sender_id integer NOT NULL REFERENCES members,
  client_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  sent_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(event_id, sender_id, client_id)
);
CREATE INDEX IF NOT EXISTS chat_history ON chat_messages(event_id, id);
CREATE TABLE IF NOT EXISTS chat_reads (
  event_id integer NOT NULL REFERENCES events ON DELETE CASCADE,
  member_id integer NOT NULL REFERENCES members ON DELETE CASCADE,
  last_id integer NOT NULL,
  PRIMARY KEY(event_id, member_id)
);
DROP TRIGGER IF EXISTS message_change ON chat_messages;
CREATE TRIGGER message_change AFTER INSERT ON chat_messages FOR EACH ROW EXECUTE FUNCTION signal_event_change();
