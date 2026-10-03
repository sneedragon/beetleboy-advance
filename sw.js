// BeetleBoy SP service worker: shows timer notifications pushed by push.php
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'BeetleBoy SP', {
    body: d.body || 'A timer is ready!',
    tag: d.tag || 'beetleboy',            // same tag as the in-app notice, so it replaces instead of doubling
    icon: 'icons/beetles/green.png',
    badge: 'icons/beetles/green.png',
    renotify: true,
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find(w => new URL(w.url).origin === self.location.origin);
    if (open) return open.focus();
    return self.clients.openWindow('./');
  })());
});
