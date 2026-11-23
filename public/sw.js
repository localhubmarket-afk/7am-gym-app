const APP_SHELL_CACHE = 'budget-gym-shell-v8';
const STATIC_ASSET_CACHE = 'budget-gym-assets-v8';
const GYM_SYNC_TAG = 'sync-gym-state';
const GYM_IDB_NAME = 'budget_gym_offline_db';
const GYM_IDB_VERSION = 1;
const SYNC_OUTBOX_STORE = 'sync_outbox';

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/pwa-maskable-512x512.png'
];

function openOutboxDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(GYM_IDB_NAME, GYM_IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('gym_state')) {
        db.createObjectStore('gym_state', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(SYNC_OUTBOX_STORE)) {
        db.createObjectStore(SYNC_OUTBOX_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readIndexedDbOutbox() {
  try {
    const db = await openOutboxDatabase();
    return await new Promise((resolve) => {
      const tx = db.transaction(SYNC_OUTBOX_STORE, 'readonly');
      const req = tx.objectStore(SYNC_OUTBOX_STORE).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function putIndexedDbOutboxItem(item) {
  try {
    const db = await openOutboxDatabase();
    await new Promise((resolve) => {
      const tx = db.transaction(SYNC_OUTBOX_STORE, 'readwrite');
      tx.objectStore(SYNC_OUTBOX_STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function deleteIndexedDbOutboxItem(id) {
  try {
    const db = await openOutboxDatabase();
    await new Promise((resolve) => {
      const tx = db.transaction(SYNC_OUTBOX_STORE, 'readwrite');
      tx.objectStore(SYNC_OUTBOX_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function flushSwSyncQueue() {
  const pending = await readIndexedDbOutbox();
  if (!pending.length) return;
  let flushedCount = 0;
  let remainingCount = 0;

  for (const item of pending) {
    if (!item || !item.endpoint) {
      if (item && item.id) await deleteIndexedDbOutboxItem(item.id);
      continue;
    }
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
        await deleteIndexedDbOutboxItem(item.id);
      } else {
        remainingCount += 1;
      }
    } catch {
      remainingCount += 1;
    }
  }

  if (flushedCount > 0) {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => {
      client.postMessage({
        type: 'OFFLINE_GYM_STATE_SYNCED',
        flushedCount,
        remainingCount
      });
    });
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => Promise.all(APP_SHELL_ASSETS.map((u) => cache.add(u).catch(() => {}))))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== APP_SHELL_CACHE && k !== STATIC_ASSET_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() => flushSwSyncQueue())
      .catch(() => {})
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'QUEUE_GYM_STATE_SYNC' && data.item && data.item.endpoint) {
    event.waitUntil(
      putIndexedDbOutboxItem({
        id: String(data.item.id || `outbox:${data.item.endpoint}`),
        endpoint: String(data.item.endpoint),
        payloadJson: String(data.item.payloadJson || '{}'),
        reason: String(data.item.reason || 'sw_message'),
        queuedAt: String(data.item.queuedAt || new Date().toISOString()),
        lastUpdated: String(data.item.lastUpdated || new Date().toISOString())
      })
    );
  } else if (data.type === 'FLUSH_GYM_STATE_SYNC') {
    event.waitUntil(flushSwSyncQueue());
  }
});

self.addEventListener('sync', (event) => {
  if (event && event.tag === GYM_SYNC_TAG) {
    event.waitUntil(flushSwSyncQueue());
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname === '/sw.js' ||
    url.pathname === '/service-worker.js'
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(APP_SHELL_CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          }
          flushSwSyncQueue().catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request).then((m) => m || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(STATIC_ASSET_CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
