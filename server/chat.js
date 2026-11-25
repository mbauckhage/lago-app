export function setupChat(app, db, member, missing, invalid) {
  const path = '/api/events/:id/chat';
  const accessible = `SELECT e.id FROM events e WHERE e.id=$1 AND
    (e.host_id=$2 OR EXISTS (SELECT 1 FROM event_guests WHERE event_id=e.id AND member_id=$2))`;
  const validId = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
  async function keys(req) {
    const user = await member(req);
    const id = Number(req.params.id);
    if (!validId(id)) throw missing();
    return [id, user.id];
  }

  app.get(path, async req => {
    const params = await keys(req);
    const before = req.query.before === undefined ? null : Number(req.query.before);
    if (before !== null && !validId(before)) throw invalid('Ungültige Nachricht.');
    const { rows } = await db.query(`
      SELECT ARRAY(SELECT row_to_json(history) FROM (
        SELECT m.id, m.body, m.sent_at, m.sender_id, a.name
        FROM chat_messages m JOIN members a ON a.id=m.sender_id
        WHERE m.event_id=allowed.id AND ($3::int IS NULL OR m.id<$3)
        ORDER BY m.id DESC LIMIT 51
      ) history) AS messages FROM (${accessible}) allowed`, [...params, before]);
    if (!rows.length) throw missing();
    const messages = rows[0].messages;
    return { messages: messages.slice(0, 50).reverse(), more: messages.length > 50 };
  });

  app.post(path, async req => {
    const params = await keys(req);
    const body = typeof req.body?.body === 'string' && req.body.body.trim();
    const key = req.body?.client_id;
    if (!body || body.length > 4000 || typeof key !== 'string' ||
        !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(key)) throw invalid('Ungültige Nachricht.');
    // Serialize sends per event so read cursors follow commit order.
    const result = await db.query(`WITH allowed AS (${accessible} FOR UPDATE)
      INSERT INTO chat_messages(event_id,sender_id,body,client_id)
      SELECT id,$2,$3,$4 FROM allowed ON CONFLICT(event_id,sender_id,client_id)
      DO UPDATE SET client_id=excluded.client_id RETURNING id`, [...params, body, key]);
    if (!result.rowCount) throw missing();
    return result.rows[0];
  });

  app.put(path + '/read', async req => {
    const params = await keys(req);
    if (!validId(req.body?.id)) throw invalid('Ungültige Nachricht.');
    const result = await db.query(`WITH allowed AS (${accessible}), advanced AS (
      INSERT INTO chat_reads(event_id,member_id,last_id)
      SELECT allowed.id,$2,m.id FROM allowed JOIN chat_messages m ON m.event_id=allowed.id AND m.id=$3
      ON CONFLICT(event_id,member_id) DO UPDATE SET last_id=excluded.last_id
      WHERE chat_reads.last_id<excluded.last_id RETURNING member_id)
      SELECT EXISTS(SELECT FROM allowed) AS allowed,
        (SELECT pg_notify('lago_changes',member_id::text) FROM advanced) AS signal`, [...params, req.body.id]);
    if (!result.rows[0].allowed) throw missing();
    return { ok: true };
  });
}
