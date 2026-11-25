import Fastify from 'fastify';
import { setupChat } from './chat.js';
import { setupLive } from './live.js';
import { setupPush } from './push.js';
import serveStatic from '@fastify/static';
import pg from 'pg';
import { DateTime } from 'luxon';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to your PostgreSQL connection URL.');
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = Fastify({ bodyLimit: 1_500_000, logger: { serializers: {
  req: request => ({ method: request.method, url: request.url.startsWith('/calendar/') ? '/calendar/[private]' : request.url })
} } });
const derive = promisify(scrypt);
const token = () => randomBytes(32).toString('hex');
const hash = value => createHash('sha256').update(value).digest('hex');
const groups = ['Lago Nostre', 'Lago Plus'];
const statuses = ['Going', 'Maybe', 'Declined'];
const zone = 'Europe/Zurich';
const clean = value => typeof value === 'string' ? value.trim() : '';
const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const invalid = message => error(400, message);
const missing = () => error(404, 'Dieser Termin ist nicht verfügbar.');
const validId = value => Number.isInteger(value) && value > 0 && value <= 2147483647;

app.addHook('onClose', () => db.end());
app.addHook('onRequest', async (req, reply) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/calendar/')) reply.header('Cache-Control', 'no-store');
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && req.headers['sec-fetch-site'] === 'cross-site') {
    throw error(403, 'Öffne Lago Nostre, um diese Änderung vorzunehmen.');
  }
});
app.setErrorHandler((err, req, reply) => {
  if (err.statusCode && err.statusCode < 500) {
    let message = err.message;
    if (err.code?.startsWith('FST_ERR_')) {
      message = err.statusCode === 413 ? 'Die Anfrage ist zu gross.' : 'Die Anfrage konnte nicht verarbeitet werden.';
    }
    return reply.code(err.statusCode).send({ message });
  }
  req.log.error(err);
  return reply.code(500).send({ message: 'Etwas ist schiefgelaufen. Versuch es erneut.' });
});

const adminEmail = clean(process.env.LAGO_ADMIN_EMAIL).toLowerCase();
const adminPassword = process.env.LAGO_ADMIN_PASSWORD;
if (Boolean(adminEmail) !== Boolean(adminPassword) || (adminPassword && adminPassword.length < 12)) {
  throw new Error('Set both administrator credentials and use a password of at least 12 characters.');
}
await db.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));

async function passwordRecord(password) {
  const salt = token();
  return salt + ':' + (await derive(password, salt, 64)).toString('hex');
}

if (adminEmail) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM members WHERE email = $1 AND admin', [adminEmail]
  );
  if (!rowCount) await db.query(
    'INSERT INTO members (email,password,name,approved,admin,calendar_token) VALUES ($1,$2,$3,true,true,$4)',
    [adminEmail, await passwordRecord(adminPassword), clean(process.env.LAGO_ADMIN_NAME) || 'Lago Nostre Admin', token()]
  );
}

function sessionCookie(value, seconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `lago_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure}`;
}

function sessionToken(req) {
  return req.headers.cookie?.match(/(?:^|;\s*)lago_session=([a-f0-9]{64})(?:;|$)/)?.[1];
}

async function signIn(reply, id) {
  const session = token();
  const seconds = 60 * 60 * 24 * 30;
  await db.query('INSERT INTO sessions VALUES ($1,$2,$3)', [hash(session), id, new Date(Date.now() + seconds * 1000)]);
  reply.header('Set-Cookie', sessionCookie(session, seconds));
}

async function member(req, access = 'approved') {
  const session = sessionToken(req);
  if (!session) throw error(401, 'Melde dich an, um fortzufahren.');
  const { rows: [user] } = await db.query(
    'SELECT m.* FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.token=$1 AND s.expires>now()',
    [hash(session)]
  );
  if (!user) throw error(401, 'Melde dich an, um fortzufahren.');
  if (access !== 'signed-in' && !user.approved) throw error(403, 'Dein Konto wartet auf die Freigabe.');
  if (access === 'admin' && !user.admin) throw error(403, 'Diese Aktion ist der Administration vorbehalten.');
  return user;
}

function account(user) {
  const { id, name, approved, admin, photo, email_updates, push_updates, calendar_prompt_seen, calendar_token } = user;
  return { id, name, approved, admin, photo, email_updates, push_updates, calendar_prompt_seen, calendar_token: approved ? calendar_token : null };
}

const deliver = await setupPush(app, db, member, invalid);
await setupLive(app, db, member, deliver);
setupChat(app, db, member, missing, invalid);

app.get('/api/me/groups', async req => {
  const user = await member(req);
  const { rows } = await db.query('SELECT group_name FROM group_members WHERE member_id=$1 ORDER BY group_name', [user.id]);
  return rows.map(row => row.group_name);
});

app.post('/api/register', async (req, reply) => {
  const { email, password, name } = req.body ?? {};
  const address = clean(email).toLowerCase();
  const displayName = clean(name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254) throw invalid('Gib eine gültige E-Mail-Adresse ein.');
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw invalid('Verwende ein Passwort mit 12 bis 128 Zeichen.');
  if (!displayName || displayName.length > 35) throw invalid('Gib einen Anzeigenamen mit höchstens 35 Zeichen ein.');
  const { rows: [user] } = await db.query(
    'INSERT INTO members (email,password,name,calendar_token) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING RETURNING *',
    [address, await passwordRecord(password), displayName, token()]
  );
  if (!user) throw error(409, 'Für diese E-Mail-Adresse gibt es bereits ein Konto. Melde dich an.');
  await signIn(reply, user.id);
  return reply.code(201).send(account(user));
});

app.post('/api/login', async (req, reply) => {
  const { email, password } = req.body ?? {};
  if (typeof password !== 'string' || password.length > 128) throw invalid('Gib deine E-Mail-Adresse und dein Passwort ein.');
  const { rows: [user] } = await db.query('SELECT * FROM members WHERE email=$1', [clean(email).toLowerCase()]);
  const [salt, expected] = (user?.password ?? `${'0'.repeat(64)}:${'0'.repeat(128)}`).split(':');
  const actual = await derive(password, salt, 64);
  if (!user || !timingSafeEqual(actual, Buffer.from(expected, 'hex'))) throw error(401, 'Die E-Mail-Adresse oder das Passwort ist falsch.');
  await signIn(reply, user.id);
  return account(user);
});

app.post('/api/logout', async (req, reply) => {
  const session = sessionToken(req);
  if (session) {
    await db.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND member_id=(SELECT member_id FROM sessions WHERE token=$2)', [req.body?.endpoint, hash(session)]);
    await db.query('DELETE FROM sessions WHERE token=$1', [hash(session)]);
  }
  return reply.header('Set-Cookie', sessionCookie('', 0)).code(204).send();
});

app.get('/api/health', async (req, reply) => {
  try {
    await db.query('SELECT 1');
    return { status: 'ok' };
  } catch (err) {
    req.log.error(err);
    return reply.code(503).send({ status: 'unavailable' });
  }
});

app.get('/api/me', async req => account(await member(req, 'signed-in')));

app.patch('/api/me', async req => {
  const user = await member(req);
  const { name, photo, email_updates, push_updates } = req.body ?? {};
  const displayName = clean(name);
  if (!displayName || displayName.length > 35) throw invalid('Gib einen Anzeigenamen mit höchstens 35 Zeichen ein.');
  validatePhoto(photo);
  if (typeof email_updates !== 'boolean' || typeof push_updates !== 'boolean') throw invalid('Wähle deine Benachrichtigungseinstellungen.');
  const { rows: [updated] } = await db.query(
    'UPDATE members SET name=$1,photo=coalesce($2,photo),email_updates=$3,push_updates=$4 WHERE id=$5 RETURNING *',
    [displayName, photo, email_updates, push_updates, user.id]
  );
  return account(updated);
});

app.put('/api/me/calendar/prompt', async req => {
  const user = await member(req);
  const { rowCount } = await db.query('UPDATE members SET calendar_prompt_seen=true WHERE id=$1 AND NOT calendar_prompt_seen', [user.id]);
  return { showPrompt: rowCount === 1 };
});

app.post('/api/me/calendar', async req => {
  const user = await member(req);
  const { rows: [updated] } = await db.query('UPDATE members SET calendar_token=$1 WHERE id=$2 RETURNING *', [token(), user.id]);
  return account(updated);
});

app.get('/api/members', async req => {
  const user = await member(req);
  const { rows } = await db.query(`SELECT m.id,m.name,
    ARRAY(SELECT gm.group_name FROM group_members gm
      JOIN group_members own ON own.group_name=gm.group_name AND own.member_id=$1
      WHERE gm.member_id=m.id ORDER BY gm.group_name) AS groups
    FROM members m WHERE m.approved ORDER BY m.name,m.id`, [user.id]);
  return rows;
});

app.get('/api/admin/members', async req => {
  await member(req, 'admin');
  const { rows } = await db.query(`SELECT m.id,m.name,m.email,m.approved,m.admin,
    ARRAY(SELECT group_name FROM group_members WHERE member_id=m.id ORDER BY group_name) AS groups
    FROM members m ORDER BY approved,name,id`);
  return rows;
});

app.patch('/api/admin/members/:id', async req => {
  await member(req, 'admin');
  const id = Number(req.params.id);
  const { approved, groups: selected } = req.body ?? {};
  if (!validId(id) || approved !== true || !Array.isArray(selected) || !selected.every(group => groups.includes(group))) {
    throw invalid('Wähle ein Konto und gültige Gruppen.');
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('UPDATE members SET approved=true WHERE id=$1', [id]);
    if (!result.rowCount) throw error(404, 'Dieses Konto ist nicht verfügbar.');
    await client.query('DELETE FROM group_members WHERE member_id=$1', [id]);
    await client.query('INSERT INTO group_members SELECT unnest($1::text[]), $2', [[...new Set(selected)], id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { saved: true };
});

app.get('/api/events', async req => {
  const user = await member(req);
  const { rows } = await db.query(`
    SELECT e.*, h.name AS host, h.photo AS host_photo, s.status,
      (e.host_id=$1) AS mine,
      (SELECT count(*)::int FROM chat_messages m WHERE m.event_id=e.id AND m.sender_id<>$1
        AND m.id>coalesce(cr.last_id,0)) AS unread,
      (SELECT json_build_object('id',m.id,'body',left(m.body,120),'sent_at',m.sent_at,'sender',a.name)
        FROM chat_messages m JOIN members a ON a.id=m.sender_id WHERE m.event_id=e.id
        ORDER BY m.id DESC LIMIT 1) AS latest_message,
      (SELECT coalesce(json_agg(json_build_object('id', m.id, 'name', m.name, 'status', r.status)
        ORDER BY m.name,m.id), '[]'::json)
        FROM event_guests g JOIN members m ON m.id=g.member_id
        LEFT JOIN responses r ON r.event_id=g.event_id AND r.member_id=g.member_id
        WHERE g.event_id=e.id) AS guests
    FROM events e JOIN members h ON h.id=e.host_id
    LEFT JOIN responses s ON s.event_id=e.id AND s.member_id=$1
    LEFT JOIN chat_reads cr ON cr.event_id=e.id AND cr.member_id=$1
    WHERE e.host_id=$1 OR EXISTS (SELECT 1 FROM event_guests WHERE event_id=e.id AND member_id=$1)
    ORDER BY e.id DESC`, [user.id]);
  return rows.map(({ host_id, people, groups, starts_at, ends_at, ...event }) => {
    const start = DateTime.fromJSDate(starts_at, { zone });
    const end = ends_at && DateTime.fromJSDate(ends_at, { zone });
    return {
      ...event, host_id, date: start.toISODate(), time: start.toFormat('HH:mm'),
      endDate: end?.toISODate(), endTime: end?.toFormat('HH:mm'),
      ...(event.mine ? { people, groups } : {})
    };
  });
});

function validatePhoto(photo) {
  if (photo !== undefined && (typeof photo !== 'string' || photo.length > 1_400_000 ||
    (photo && !/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(photo)))) {
    throw invalid('Wähle ein JPEG-, PNG- oder WebP-Bild unter 1 MB.');
  }
}

function eventDateTime(date, time) {
  const dateTime = typeof date === 'string' && typeof time === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date + 'T' + time)
    ? DateTime.fromISO(date + 'T' + time, { zone }) : null;
  if (!dateTime?.isValid || dateTime.toISODate() !== date || dateTime.toFormat('HH:mm') !== time) {
    throw invalid('Gib ein gültiges Datum und eine gültige Uhrzeit ein.');
  }
  return dateTime;
}

async function eventFields(body, host, editing = false) {
  const { title, date, time, endDate, endTime, place, note, photo, people, groups: selected } = body ?? {};
  const dateTime = eventDateTime(date, time);
  const end = endDate === undefined && endTime === undefined ? null : eventDateTime(endDate, endTime);
  if (end && end <= dateTime) throw invalid('Das Ende muss nach dem Start liegen.');
  if (!clean(title) || clean(title).length > 75 || clean(place).length > 80 || clean(note).length > 350) {
    throw invalid('Gib einen Titel ein und beachte die Zeichenlimiten der Felder.');
  }
  if (!Array.isArray(people) || people.length > 500 || !people.every(id => validId(id) && id !== host) ||
      !Array.isArray(selected) || !selected.every(group => groups.includes(group))) throw invalid('Wähle gültige Personen oder Gruppen aus.');
  validatePhoto(photo);
  const invitees = [...new Set(people)];
  if (!editing && !invitees.length && !selected.length) throw invalid('Wähle mindestens eine Person oder Gruppe aus.');
  const result = await db.query('SELECT id FROM members WHERE approved AND id=ANY($1::int[])', [invitees]);
  if (result.rowCount !== invitees.length) throw invalid('Eine eingeladene Person ist nicht verfügbar. Lade die Seite neu und versuch es erneut.');
  return [clean(title), dateTime.toJSDate(), clean(place), clean(note), invitees, [...new Set(selected)], host, photo ?? null, end?.toJSDate() ?? null];
}

const hostGroups = 'ARRAY(SELECT group_name FROM group_members WHERE member_id=$7)';

app.post('/api/events', async (req, reply) => {
  const user = await member(req);
  const { rows: [event] } = await db.query(
    `INSERT INTO events (title,starts_at,place,note,people,groups,host_id,photo,ends_at)
     SELECT $1,$2,$3,$4,$5,$6,$7,coalesce($8,''),$9 WHERE $6::text[] <@ ${hostGroups} RETURNING id`,
    await eventFields(req.body, user.id)
  );
  if (!event) throw invalid('Wähle nur Gruppen, denen du angehörst.');
  return reply.code(201).send(event);
});

app.patch('/api/events/:id', async req => {
  const user = await member(req);
  const id = Number(req.params.id);
  if (!validId(id)) throw missing();
  const { rowCount } = await db.query(`UPDATE events SET title=$1,starts_at=$2,place=$3,note=$4,people=$5,
    groups=ARRAY(SELECT unnest($6::text[]) UNION SELECT g FROM unnest(events.groups) g WHERE NOT g=ANY(${hostGroups})),photo=coalesce($8,photo),
    ends_at=coalesce($9,ends_at), updated_at=clock_timestamp() WHERE host_id=$7 AND id=$10 AND NOT cancelled AND $6::text[] <@ ${hostGroups}
    AND (cardinality($5::int[]) + cardinality($6::text[]) > 0 OR NOT events.groups <@ ${hostGroups})`, [...await eventFields(req.body, user.id, true), id]);
  if (!rowCount) throw missing();
  return { saved: true };
});

app.post('/api/events/:id/cancel', async req => {
  const user = await member(req);
  const id = Number(req.params.id);
  if (!validId(id)) throw missing();
  const { rowCount } = await db.query(
    'UPDATE events SET cancelled=true,updated_at=clock_timestamp() WHERE id=$1 AND host_id=$2 AND NOT cancelled', [id, user.id]
  );
  if (!rowCount) throw missing();
  return { saved: true };
});

app.put('/api/events/:id/rsvp', async req => {
  const user = await member(req);
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!validId(id)) throw missing();
  if (!statuses.includes(status)) throw invalid('Wähle «Dabei», «Vielleicht» oder «Abgesagt».');
  const { rowCount } = await db.query(`
    INSERT INTO responses (event_id,member_id,status)
    SELECT e.id,$2,$3 FROM events e JOIN event_guests g ON g.event_id=e.id AND g.member_id=$2
    WHERE e.id=$1 AND NOT e.cancelled FOR UPDATE OF e
    ON CONFLICT (event_id,member_id) DO UPDATE SET status=excluded.status`, [id, user.id, status]);
  if (!rowCount) throw missing();
  return { saved: true };
});

const calendarDate = date => DateTime.fromJSDate(date, { zone: 'utc' }).toFormat("yyyyMMdd'T'HHmmss'Z'");
const calendarText = value => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[;,]/g, '\\$&');
function fold(line) {
  let result = '';
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char);
    if (bytes + size > 75) {
      result += '\r\n ';
      bytes = 1;
    }
    result += char;
    bytes += size;
  }
  return result;
}

app.get('/calendar/:file', async (req, reply) => {
  const match = /^([a-f0-9]{64})\.ics$/.exec(req.params.file);
  if (!match) throw error(404, 'Dieser Kalender ist nicht verfügbar.');
  const { rows: [user] } = await db.query('SELECT id FROM members WHERE approved AND calendar_token=$1', [match[1]]);
  if (!user) throw error(404, 'Dieser Kalender ist nicht verfügbar.');
  const { rows } = await db.query(`
    SELECT e.* FROM events e
    WHERE NOT e.cancelled AND (e.host_id=$1 OR EXISTS (
      SELECT 1 FROM event_guests g JOIN responses r USING (event_id,member_id)
      WHERE g.event_id=e.id AND g.member_id=$1 AND r.status IN ('Going','Maybe')
    )) ORDER BY e.starts_at`, [user.id]);
  const entries = rows.flatMap(e => [
    'BEGIN:VEVENT', `UID:${e.id}@lago`, 'DTSTAMP:' + calendarDate(e.updated_at),
    'DTSTART:' + calendarDate(e.starts_at),
    ...(e.ends_at ? ['DTEND:' + calendarDate(e.ends_at)] : []), 'SUMMARY:' + calendarText(e.title),
    'LOCATION:' + calendarText(e.place), 'DESCRIPTION:' + calendarText(e.note), 'END:VEVENT'
  ]);
  return reply.type('text/calendar; charset=utf-8').send([
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lago//Personal Calendar//EN', 'X-WR-CALNAME:Lago Nostre',
    ...entries, 'END:VCALENDAR', ''
  ].map(fold).join('\r\n'));
});

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
if (existsSync(dist)) await app.register(serveStatic, { root: dist });
await app.listen({ port: Number(process.env.PORT || 3000), host: process.env.HOST || '127.0.0.1' });
