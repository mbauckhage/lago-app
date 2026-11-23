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

ALTER TABLE events ADD COLUMN IF NOT EXISTS photo text NOT NULL DEFAULT '';

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
