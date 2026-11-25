async function updateAppBadge(count) {
  if (!Number.isSafeInteger(count) || count < 0) return;
  try {
    if (count) await self.navigator.setAppBadge?.(count);
    else await self.navigator.clearAppBadge?.();
  } catch { /* A badge failure must not interrupt notification delivery. */ }
}

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  event.waitUntil(Promise.all([
    updateAppBadge(data.badgeCount),
    self.registration.showNotification(data.title || 'Lago Nostre', {
      body: data.body || 'Es gibt Neuigkeiten in Lago Nostre.', icon: '/lago-192.png',
      tag: data.tag, data: { url: data.url || '/' }
    })
  ]));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('navigate' in client) { await client.navigate(url.href); return client.focus(); }
    }
    return self.clients.openWindow(url.href);
  })());
});
