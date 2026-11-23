import * as webpush from 'web-push';

export function validSubscription(value) {
  try {
    const url = new URL(value.endpoint);
    const hosts = ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com', 'notify.windows.com'];
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host)) &&
      value.endpoint.length < 4096 && /^[\w-]{87}$/.test(value.keys?.p256dh) && /^[\w-]{22}$/.test(value.keys?.auth);
  } catch { return false; }
}

export async function setupPush(app, db, member, invalid) {
  const keys = webpush.generateVAPIDKeys();
  await db.query('INSERT INTO push_config (public_key,private_key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [keys.publicKey, keys.privateKey]);
  const { rows: [config] } = await db.query('SELECT * FROM push_config');
  webpush.setVapidDetails(process.env.WEB_PUSH_SUBJECT || 'mailto:admin@lagonostre.ch', config.public_key, config.private_key);
  app.get('/api/push', async req => {
    const user = await member(req);
    const { rows } = await db.query('SELECT endpoint FROM push_subscriptions WHERE member_id=$1', [user.id]);
    return { publicKey: config.public_key, endpoints: rows.map(row => row.endpoint) };
  });
  app.post('/api/push', async req => {
    const user = await member(req);
    if (!validSubscription(req.body)) throw invalid('Dieses Gerät konnte nicht für Push registriert werden.');
    const { endpoint, keys } = req.body;
    await db.query(`INSERT INTO push_subscriptions VALUES ($1,$2,$3)
      ON CONFLICT (endpoint) DO UPDATE SET member_id=excluded.member_id,subscription=excluded.subscription`,
    [endpoint, user.id, JSON.stringify({ endpoint, keys })]);
    return { saved: true };
  });
  app.delete('/api/push', async req => {
    const user = await member(req, 'signed-in');
    await db.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND member_id=$2', [req.body?.endpoint, user.id]);
    return { saved: true };
  });
  let running = false;
  const deliver = async () => {
    if (running) return;
    running = true;
    const client = await db.connect().catch(err => { app.log.error(err); running = false; });
    if (!client) return;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`SELECT j.*,e.title FROM push_jobs j JOIN events e ON e.id=j.event_id
        WHERE available_at<=now() ORDER BY j.id LIMIT 20 FOR UPDATE OF j SKIP LOCKED`);
      for (const job of rows) {
        const { rows: subscriptions } = await client.query(`SELECT s.* FROM push_subscriptions s JOIN members m ON m.id=s.member_id
          WHERE m.id=$1 AND m.approved AND m.push_updates AND EXISTS
          (SELECT 1 FROM event_guests WHERE event_id=$2 AND member_id=m.id)`, [job.member_id, job.event_id]);
        let retry = false;
        for (const item of subscriptions) {
          try {
            await webpush.sendNotification(item.subscription, JSON.stringify({
              title: 'Lago Nostre', body: `${job.kind === 'cancelled' ? 'Abgesagt' : job.kind === 'updated' ? 'Termin aktualisiert' : 'Neue Einladung'}: ${job.title}`,
              tag: `event-${job.event_id}`, url: `/?event=${job.event_id}`
            }), { TTL: 86400, timeout: 10000 });
          } catch (err) {
            if ([404, 410].includes(err.statusCode)) await client.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [item.endpoint]);
            else { retry = true; app.log.warn({ statusCode: err.statusCode }, 'Push delivery failed'); }
          }
        }
        if (retry && job.attempts < 4) await client.query("UPDATE push_jobs SET attempts=attempts+1,available_at=now()+interval '1 minute' * power(2,attempts) WHERE id=$1", [job.id]);
        else await client.query('DELETE FROM push_jobs WHERE id=$1', [job.id]);
      }
      await client.query('COMMIT');
    } catch (err) { await client.query('ROLLBACK'); app.log.error(err); }
    finally { client.release(); running = false; }
  };
  const timer = setInterval(deliver, 5000);
  timer.unref();
  app.addHook('onClose', async () => clearInterval(timer));
}
