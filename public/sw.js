const CACHE_NAME = 'budget-gym-v5';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  // Always use a Network-First strategy so installed PWAs never get trapped on stale HTML/JS
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html')))
  );
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data && data.type === 'SHOW_WRIST_TIMER_NOTIFICATION') {
    const title = data.title || 'Rest Complete! Start Next Set';
    const options = Object.assign(
      {
        body: data.body || 'Time to lift! Check your target weight & reps.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [300, 150, 300, 150, 400],
        tag: 'gym-rest-timer',
        renotify: true,
        requireInteraction: true
      },
      data.options || {}
    );
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});
