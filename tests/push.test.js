import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import * as webpush from 'web-push';
import Fastify from 'fastify';
import { setupPush, validSubscription } from '../server/push.js';

const keys = webpush.generateVAPIDKeys();
const subscription = { endpoint: 'https://web.push.apple.com/test', keys: { p256dh: keys.publicKey, auth: Buffer.alloc(16).toString('base64url') } };
test('subscription validation rejects unsafe destinations and malformed keys', () => {
  assert.ok(validSubscription(subscription));
  for (const endpoint of ['http://web.push.apple.com/test', 'https://localhost/test', 'https://web.push.apple.com.evil.com/test', 'https://user@web.push.apple.com/test', 'https://web.push.apple.com:444/test']) {
    assert.ok(!validSubscription({ ...subscription, endpoint }));
  }
  assert.ok(!validSubscription({ ...subscription, keys: {} }));
});

test('push routes, persistent keys and event queue', { skip: !process.env.DATABASE_URL }, async () => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const schema = `push_test_${Date.now()}`;
  let app;
  let pool;
  try {
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(`SET search_path TO ${schema}`);
    await db.query(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
    await db.query(`INSERT INTO members (email,password,name,approved,calendar_token) VALUES
      ('host@test','x','Host',true,'host'),('guest@test','x','Guest',true,'guest'),('other@test','x','Other',true,'other')`);
    app = Fastify();
    const member = async req => {
      if (!req.headers['x-member']) throw Object.assign(new Error('Sign in'), { statusCode: 401 });
      return { id: Number(req.headers['x-member']) };
    };
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: '-c search_path=' + schema });
    const deliveries = [];
    const links = [];
    const deliver = await setupPush(app, pool, member, message => Object.assign(new Error(message), { statusCode: 400 }),
      async (device, payload) => {
        const { url, body, badgeCount } = JSON.parse(payload);
        links.push(url);
        deliveries.push([device.endpoint, body, badgeCount]);
      });
    assert.equal((await app.inject('/api/push')).statusCode, 401);
    const headers = { 'x-member': '2' };
    const config = (await app.inject({ url: '/api/push', headers })).json();
    assert.ok(config.publicKey);
    assert.equal((await app.inject({ method: 'POST', url: '/api/push', headers, payload: { endpoint: 'https://localhost' } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'POST', url: '/api/push', headers, payload: subscription })).statusCode, 200);
    assert.deepEqual((await app.inject({ url: '/api/push', headers })).json().endpoints, [subscription.endpoint]);
    await app.inject({ method: 'DELETE', url: '/api/push', headers: { 'x-member': '3' }, payload: { endpoint: subscription.endpoint } });
    assert.equal((await db.query('SELECT * FROM push_subscriptions')).rowCount, 1);
    await app.inject({ method: 'DELETE', url: '/api/push', headers, payload: { endpoint: subscription.endpoint } });
    assert.equal((await db.query('SELECT * FROM push_subscriptions')).rowCount, 0);
    await db.query("INSERT INTO group_members VALUES ('Lago Nostre',2)");
    await db.query(`INSERT INTO events (host_id,title,starts_at,place,note,people,groups)
      VALUES (1,'Test',now(),'','',ARRAY[2],ARRAY['Lago Nostre'])`);
    await db.query("UPDATE events SET title='Updated'");
    await db.query('UPDATE events SET cancelled=true');
    const jobs = (await db.query('SELECT member_id,kind FROM push_jobs ORDER BY member_id,id')).rows;
    assert.deepEqual(jobs, [{ member_id: 1, kind: 'created' }, ...['invitation', 'updated', 'cancelled'].map(kind => ({ member_id: 2, kind }))]);
    for (const id of [1, 2, 3]) {
      const device = { ...subscription, endpoint: subscription.endpoint + id };
      await app.inject({ method: 'POST', url: '/api/push', headers: { 'x-member': String(id) }, payload: device });
    }
    await deliver();
    assert.deepEqual(deliveries.sort(), [
      [subscription.endpoint + 1, 'Termin veröffentlicht: Updated', 0],
      [subscription.endpoint + 2, 'Abgesagt: Updated', 0],
      [subscription.endpoint + 2, 'Neue Einladung: Updated', 0],
      [subscription.endpoint + 2, 'Termin aktualisiert: Updated', 0]
    ]);
    await db.query(`INSERT INTO events (host_id,title,starts_at,place,note,people,groups)
      VALUES (1,'Dinner',now(),'','',ARRAY[2],ARRAY['Lago Nostre'])`);
    deliveries.length = 0;
    await deliver();
    assert.deepEqual(deliveries.sort(), [
      [subscription.endpoint + 1, 'Termin veröffentlicht: Dinner', 0],
      [subscription.endpoint + 2, 'Neue Einladung: Dinner', 1]
    ]);
    await db.query("INSERT INTO responses SELECT id,2,'Maybe' FROM events WHERE title='Dinner'");
    await db.query("UPDATE events SET title='Lunch' WHERE title='Dinner'");
    deliveries.length = 0;
    await deliver();
    assert.deepEqual(deliveries, [[subscription.endpoint + 2, 'Termin aktualisiert: Lunch', 0]]);
    async function sendChat(sender) {
      await db.query("INSERT INTO chat_messages(event_id,sender_id,client_id,body) VALUES (2,$1,gen_random_uuid(),'Hallo!')", [sender]);
    }
    deliveries.length = 0;
    await sendChat(2);
    await sendChat(1);
    await deliver();
    assert.deepEqual(deliveries, [1, 2].map(id => [subscription.endpoint + id, 'Neue Chatnachricht: Lunch', 0]));
    assert.deepEqual(links.slice(-2), ['/?event=2&view=chat', '/?event=2&view=chat']);
    deliveries.length = 0;
    await sendChat(2);
    await sendChat(1);
    await db.query('UPDATE members SET push_updates=false WHERE id=1');
    await db.query("UPDATE events SET people='{}', groups='{}' WHERE id=2");
    await deliver();
    assert.deepEqual(deliveries, []);
    const stored = (await db.query('SELECT public_key FROM push_config')).rows[0].public_key;
    assert.equal(stored, config.publicKey);
  } finally {
    if (app) await app.close();
    if (pool) await pool.end();
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
    await db.end();
  }
});
