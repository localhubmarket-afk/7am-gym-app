const CACHE_NAME = 'budget-gym-v7';
const SYNC_QUEUE_CACHE = 'budget-gym-sync-queue-v1';
const SYNC_QUEUE_KEY = '/__offline_gym_state_queue__.json';
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
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== SYNC_QUEUE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()).catch(() => {})
  );
});

async function readSwSyncQueue() {
  try {
    const cache = await caches.open(SYNC_QUEUE_CACHE);
    const resp = await cache.match(SYNC_QUEUE_KEY);
    if (!resp) return [];
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeSwSyncQueue(items) {
  try {
    const cache = await caches.open(SYNC_QUEUE_CACHE);
    await cache.put(
      SYNC_QUEUE_KEY,
      new Response(JSON.stringify(items.slice(-10)), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  } catch {
    // Ignore cache write errors
  }
}

async function flushSwSyncQueue() {
  const queue = await readSwSyncQueue();
  if (!queue.length) return;
  const remaining = [];
  let flushedCount = 0;

  for (const item of queue) {
    try {
      const isApi = String(item.endpoint || '').includes('/api/state');
      const res = await fetch(item.endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': isApi ? 'application/json' : 'text/plain;charset=utf-8'
        },
        body: item.payloadJson
      });
      if (res && res.ok) {
        flushedCount += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  await writeSwSyncQueue(remaining);

  if (flushedCount > 0) {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => {
      client.postMessage({ type: 'OFFLINE_GYM_STATE_SYNCED', flushedCount, remainingCount: remaining.length });
    });
  }
}

self.addEventListener('message', event => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'QUEUE_GYM_STATE_SYNC' && data.item && data.item.endpoint) {
    event.waitUntil(
      (async () => {
        const current = await readSwSyncQueue();
        const deduped = current.filter(entry => entry.endpoint !== data.item.endpoint);
        deduped.push(data.item);
        await writeSwSyncQueue(deduped);
      })()
    );
  } else if (data.type === 'FLUSH_GYM_STATE_SYNC') {
    event.waitUntil(flushSwSyncQueue());
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-gym-state') {
    event.waitUntil(flushSwSyncQueue());
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  let url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname === '/sw.js'
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
