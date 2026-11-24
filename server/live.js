// One PostgreSQL listener per API instance fans committed changes out to open tabs.
export async function setupLive(app, db, member, deliver) {
  const streams = new Map();
  let closing = false;
  let listener;
  let retry;
  function refreshAll() {
    for (const clients of streams.values()) {
      for (const stream of clients) stream.write('data: refresh\n\n');
    }
  }
  async function listen() {
    let client;
    function disconnected(err) {
      if (!client || listener !== client) return;
      listener = null;
      client.release(true);
      if (!closing) {
        app.log.warn(err, 'Reconnecting event listener');
        retry = setTimeout(listen, 1000);
      }
    }
    try {
      client = await db.connect();
      listener = client;
      client.once('error', disconnected);
      client.on('notification', ({ payload }) => {
        if (payload === 'push') return void deliver();
        for (const stream of streams.get(Number(payload)) ?? []) stream.write('data: refresh\n\n');
      });
      await client.query('LISTEN lago_changes');
      refreshAll();
    } catch (err) {
      if (client) disconnected(err);
      else if (!closing) retry = setTimeout(listen, 1000);
    }
  }
  await listen();
  app.get('/api/events/live', async (req, reply) => {
    const user = await member(req);
    const stream = reply.raw;
    reply.hijack();
    stream.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    const clients = streams.get(user.id) ?? new Set();
    streams.set(user.id, clients);
    clients.add(stream);
    stream.write('data: refresh\n\n');
    const heartbeat = setInterval(() => stream.write(': heartbeat\n\n'), 20000);
    // Reconnect periodically to recheck the session, including sign-outs in another tab.
    const lifetime = setTimeout(() => stream.end(), 300000);
    stream.on('close', () => {
      clearInterval(heartbeat);
      clearTimeout(lifetime);
      clients.delete(stream);
      if (!clients.size) streams.delete(user.id);
    });
  });
  app.addHook('preClose', async () => {
    closing = true;
    clearTimeout(retry);
    listener?.release(true);
    for (const clients of streams.values()) for (const stream of clients) stream.end();
  });
}
