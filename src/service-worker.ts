/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST?: Array<{ url: string; revision?: string | null } | string>;
};

export const APP_SHELL_CACHE = 'budget-gym-shell-v8';
export const STATIC_ASSET_CACHE = 'budget-gym-assets-v8';
export const GYM_SYNC_TAG = 'sync-gym-state';
export const GYM_IDB_NAME = 'budget_gym_offline_db';
export const GYM_IDB_VERSION = 1;
export const SYNC_OUTBOX_STORE = 'sync_outbox';

export const APP_SHELL_ASSETS: string[] = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/pwa-maskable-512x512.png'
];

interface OutboxItem {
  id: string;
  endpoint: string;
  payloadJson: string;
  reason?: string;
  queuedAt?: string;
  lastUpdated?: string;
}

const INJECTED_WB_MANIFEST = self.__WB_MANIFEST;

function getPrecacheUrls(): string[] {
  const manifestEntries = Array.isArray(INJECTED_WB_MANIFEST) ? INJECTED_WB_MANIFEST : [];
  const urls = new Set<string>(APP_SHELL_ASSETS);
  for (const entry of manifestEntries) {
    if (typeof entry === 'string' && entry.trim()) {
      urls.add(entry.startsWith('/') ? entry : `/${entry}`);
    } else if (entry && typeof entry === 'object' && typeof entry.url === 'string') {
      urls.add(entry.url.startsWith('/') ? entry.url : `/${entry.url}`);
    }
  }
  return Array.from(urls);
}

function openOutboxDatabase(): Promise<IDBDatabase> {
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

async function readIndexedDbOutbox(): Promise<OutboxItem[]> {
  try {
    const db = await openOutboxDatabase();
    return await new Promise<OutboxItem[]>((resolve) => {
      const tx = db.transaction(SYNC_OUTBOX_STORE, 'readonly');
      const req = tx.objectStore(SYNC_OUTBOX_STORE).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function putIndexedDbOutboxItem(item: OutboxItem): Promise<void> {
  try {
    const db = await openOutboxDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(SYNC_OUTBOX_STORE, 'readwrite');
      tx.objectStore(SYNC_OUTBOX_STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore storage write errors inside SW
  }
}

async function deleteIndexedDbOutboxItem(id: string): Promise<void> {
  try {
    const db = await openOutboxDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(SYNC_OUTBOX_STORE, 'readwrite');
      tx.objectStore(SYNC_OUTBOX_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore storage delete errors inside SW
  }
}

async function pushPendingGymStateToSupabase(): Promise<{
  flushedCount: number;
  remainingCount: number;
}> {
  const pending = await readIndexedDbOutbox();
  if (pending.length === 0) {
    return { flushedCount: 0, remainingCount: 0 };
  }

  let flushedCount = 0;
  let remainingCount = 0;

  for (const item of pending) {
    if (!item || !item.endpoint) {
      if (item?.id) await deleteIndexedDbOutboxItem(item.id);
      continue;
    }
    try {
      const isApi = String(item.endpoint).includes('/api/state');
      const response = await fetch(item.endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': isApi ? 'application/json' : 'text/plain;charset=utf-8'
        },
        body: item.payloadJson
      });
      if (response && response.ok) {
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
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    for (const client of clients) {
      client.postMessage({
        type: 'OFFLINE_GYM_STATE_SYNCED',
        flushedCount,
        remainingCount
      });
    }
  }

  return { flushedCount, remainingCount };
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          getPrecacheUrls().map((url) =>
            cache.add(url).catch(() => {
              // Individual optional asset miss should not fail install
            })
          )
        )
      )
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
            .filter((key) => key !== APP_SHELL_CACHE && key !== STATIC_ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() => pushPendingGymStateToSupabase())
      .catch(() => {})
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'QUEUE_GYM_STATE_SYNC' && data.item && data.item.endpoint) {
    const item: OutboxItem = {
      id: String(data.item.id || `outbox:${data.item.endpoint}`),
      endpoint: String(data.item.endpoint),
      payloadJson: String(data.item.payloadJson || '{}'),
      reason: String(data.item.reason || 'sw_message'),
      queuedAt: String(data.item.queuedAt || new Date().toISOString()),
      lastUpdated: String(data.item.lastUpdated || new Date().toISOString())
    };
    event.waitUntil(putIndexedDbOutboxItem(item));
    return;
  }

  if (data.type === 'FLUSH_GYM_STATE_SYNC') {
    event.waitUntil(pushPendingGymStateToSupabase());
  }
});

self.addEventListener('sync', (event: any) => {
  if (event && event.tag === GYM_SYNC_TAG) {
    event.waitUntil(pushPendingGymStateToSupabase());
  }
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && typeof client.focus === 'function') {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return undefined;
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  let url: URL;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Never cache live API, Vite HMR internals, or service worker script itself
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname === '/sw.js' ||
    url.pathname === '/service-worker.js'
  ) {
    return;
  }

  // App shell navigation: NetworkFirst with cached /index.html offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches
              .open(APP_SHELL_CACHE)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => {});
          }
          // Network succeeded — opportunistically flush any pending IndexedDB updates
          pushPendingGymStateToSupabase().catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached =
            (await caches.match(event.request)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          return cached || Response.error();
        })
    );
    return;
  }

  // Static assets: StaleWhileRevalidate for instant offline loading
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches
              .open(STATIC_ASSET_CACHE)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => cachedResponse as Response);

      return cachedResponse || networkFetch;
    })
  );
});
