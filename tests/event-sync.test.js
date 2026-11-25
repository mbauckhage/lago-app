import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import pg from 'pg';

test('live invitations, group permissions and access removal across sessions', {
  skip: !process.env.DATABASE_URL, timeout: 15000
}, async () => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const schema = 'sync_test_' + randomBytes(8).toString('hex');
  const streams = new AbortController();
  let server;
  try {
    await db.query('CREATE SCHEMA ' + schema);
    await db.query('SET search_path TO ' + schema);
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('options', '-c search_path=' + schema);
    server = spawn(process.execPath, ['server/index.js'], { env: {
      ...process.env, DATABASE_URL: url.href, HOST: '127.0.0.1', PORT: '0', LAGO_ADMIN_EMAIL: '', LAGO_ADMIN_PASSWORD: ''
    }, stdio: ['ignore', 'pipe', 'inherit'] });
    let origin;
    for await (const line of createInterface({ input: server.stdout })) {
      const match = line.match(/Server listening at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { origin = match[1]; break; }
    }
    assert.ok(origin);
    const cookies = [];
    for (const name of ['host', 'group', 'both', 'outside']) {
      const { rows: [user] } = await db.query('INSERT INTO members(email,name,password,calendar_token,approved) VALUES ($1,$1,$1,$1,true) RETURNING id', [name]);
      const token = randomBytes(32).toString('hex');
      await db.query("INSERT INTO sessions VALUES ($1,$2,now()+interval '1 hour')", [createHash('sha256').update(token).digest('hex'), user.id]);
      cookies.push('lago_session=' + token);
    }
    await db.query("INSERT INTO group_members VALUES ('Lago Nostre',1),('Lago Nostre',2),('Lago Nostre',3),('Lago Plus',4)");
    const api = (index, path, method = 'GET', body) => fetch(origin + '/api' + path, {
      method, headers: { cookie: cookies[index], ...(body && { 'Content-Type': 'application/json' }) }, body: JSON.stringify(body)
    });
    const follow = async index => {
      const response = await fetch(origin + '/api/events/live', { headers: { cookie: cookies[index] }, signal: streams.signal });
      const reader = response.body.getReader();
      await reader.read(); // initial snapshot signal
      return async () => assert.match(new TextDecoder().decode((await reader.read()).value), /data: refresh/);
    };
    const [host, guest, both] = await Promise.all([0, 1, 2].map(follow));
    assert.deepEqual(await (await api(0, '/me/groups')).json(), ['Lago Nostre']);
    const event = { title: 'Dinner', date: '2027-01-01', time: '18:00', endDate: '2027-01-02', endTime: '00:30', people: [3], groups: ['Lago Nostre'] };
    assert.equal((await api(0, '/events', 'POST', { ...event, groups: ['Lago Plus'] })).status, 400);
    assert.equal((await api(0, '/events', 'POST', { ...event, endDate: event.date })).status, 400);
    assert.equal((await api(0, '/events', 'POST', event)).status, 201);
    await Promise.all([host(), guest(), both()]);
    for (const index of [0, 1, 2, 3]) {
      const rows = await (await api(index, '/events')).json();
      if (rows.length) {
        assert.equal(rows[0].endDate, event.endDate);
        assert.equal(rows[0].endTime, event.endTime);
      }
      assert.deepEqual(rows.map(row => row.title), index === 3 ? [] : ['Dinner']);
    }
    const chat = '/events/1/chat';
    const message = { client_id: '77346d2b-32fd-4927-9ff1-83cf5239658c', body: 'Bis später!' };
    const feed = async index => (await (await api(index, '/events')).json())[0];
    assert.deepEqual(await (await api(1, chat)).json(), { messages: [], more: false });
    assert.equal((await api(3, chat, 'POST', message)).status, 404);
    const sent = await (await api(0, chat, 'POST', message)).json();
    await Promise.all([host(), guest(), both()]);
    assert.deepEqual(await (await api(0, chat, 'POST', message)).json(), sent);
    assert.equal((await feed(0)).unread, 0);
    assert.equal((await feed(1)).unread, 1);
    assert.equal((await (await api(1, chat)).json()).messages[0].body, message.body);
    assert.equal((await api(1, chat + '/read', 'PUT', sent)).status, 200);
    await guest();
    assert.equal((await feed(1)).unread, 0);
    assert.equal((await feed(2)).unread, 1);
    assert.equal((await api(1, '/events/1/rsvp', 'PUT', { status: 'Going' })).status, 200);
    await Promise.all([host(), guest(), both()]);
    await db.query("DELETE FROM group_members WHERE member_id=1");
    await Promise.all([host(), guest(), both()]);
    assert.equal((await api(0, '/events/1', 'PATCH', { ...event, endTime: '01:00', groups: [], people: [] })).status, 200);
    await Promise.all([host(), guest(), both()]);
    const [edited] = await (await api(0, '/events')).json();
    assert.deepEqual(edited.groups, ['Lago Nostre']);
    assert.equal(edited.endTime, '01:00');
    await db.query("DELETE FROM group_members WHERE member_id=2");
    await Promise.all([host(), guest(), both()]);
    assert.deepEqual(await (await api(1, '/events')).json(), []);
    assert.equal((await api(1, chat)).status, 404);
    assert.equal((await api(1, chat, 'POST', message)).status, 404);
    assert.equal((await api(1, chat + '/read', 'PUT', sent)).status, 404);
  } finally {
    streams.abort();
    if (server && server.exitCode === null && !server.signalCode) {
      const exited = once(server, 'exit');
      server.kill();
      await exited;
    }
    await db.query('DROP SCHEMA ' + schema + ' CASCADE');
    await db.end();
  }
});
