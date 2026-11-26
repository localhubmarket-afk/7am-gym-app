const APP_SHELL_CACHE = 'budget-gym-shell-v11';
const STATIC_ASSET_CACHE = 'budget-gym-assets-v11';
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
  '/pwa-maskable-512x512.png',
  '/assets/machines/barbell-bench-rack.jpg',
  '/assets/machines/cable-lat-pulldown.jpg',
  '/assets/machines/seated-leg-press-curl.jpg',
  '/assets/machines/chest-shoulder-press.jpg',
  '/assets/machines/pullup-bar-station.jpg'
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

function sortOutboxFifo(items) {
  return [...items].sort((a, b) => {
    const aMs =
      typeof a.createdAtMs === 'number' && Number.isFinite(a.createdAtMs)
        ? a.createdAtMs
        : Date.parse(String(a.queuedAt || '')) || 0;
    const bMs =
      typeof b.createdAtMs === 'number' && Number.isFinite(b.createdAtMs)
        ? b.createdAtMs
        : Date.parse(String(b.queuedAt || '')) || 0;
    if (aMs !== bMs) return aMs - bMs;

    const aSeq = typeof a.seq === 'number' && Number.isFinite(a.seq) ? a.seq : 0;
    const bSeq = typeof b.seq === 'number' && Number.isFinite(b.seq) ? b.seq : 0;
    if (aSeq !== bSeq) return aSeq - bSeq;

    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

async function readIndexedDbOutbox() {
  try {
    const db = await openOutboxDatabase();
    const all = await new Promise((resolve) => {
      const tx = db.transaction(SYNC_OUTBOX_STORE, 'readonly');
      const req = tx.objectStore(SYNC_OUTBOX_STORE).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
    const pending = all.filter((entry) => entry && (!entry.status || entry.status === 'pending'));
    return sortOutboxFifo(pending);
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

let activeSwFlushPromise = null;

async function runSwFifoFlush() {
  const pending = await readIndexedDbOutbox();
  if (!pending.length) return;
  let flushedCount = 0;

  // Strict FIFO processing: upload oldest pending record first.
  // Delete on verified Supabase upload; on any failure keep pending and STOP immediately.
  for (const item of pending) {
    const endpoint = String((item && item.endpoint) || '').trim();
    if (!endpoint || endpoint === 'pending_endpoint') {
      break;
    }
    try {
      const isApi = endpoint.includes('/api/state');
      const isFirebase = endpoint.includes('firebaseio.com') || endpoint.endsWith('.json');
      const res = await fetch(endpoint, {
        method: isFirebase ? 'PUT' : 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': isApi ? 'application/json' : 'text/plain;charset=utf-8'
        },
        body: item.payloadJson
      });
      if (!res || !res.ok) {
        await putIndexedDbOutboxItem({
          ...item,
          status: 'pending',
          attempts: Number(item.attempts || 0) + 1
        });
        break;
      }
      const json = await res.json().catch(() => ({}));
      if (json && (json.configured === false || json.saved === false)) {
        await putIndexedDbOutboxItem({
          ...item,
          status: 'pending',
          attempts: Number(item.attempts || 0) + 1
        });
        break;
      }
      flushedCount += 1;
      await deleteIndexedDbOutboxItem(item.id);
    } catch {
      await putIndexedDbOutboxItem({
        ...item,
        status: 'pending',
        attempts: Number(item.attempts || 0) + 1
      });
      break;
    }
  }

  const afterPending = await readIndexedDbOutbox();
  const remainingCount = afterPending.length;

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

function flushSwSyncQueue() {
  if (!activeSwFlushPromise) {
    activeSwFlushPromise = runSwFifoFlush().finally(() => {
      activeSwFlushPromise = null;
    });
  }
  return activeSwFlushPromise;
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
  } else if (data.type === 'QUEUE_GYM_STATE_SYNC' && data.item) {
    const nowMs =
      typeof data.item.createdAtMs === 'number' && Number.isFinite(data.item.createdAtMs)
        ? data.item.createdAtMs
        : Date.now();
    const nowIso = String(data.item.queuedAt || new Date(nowMs).toISOString());
    event.waitUntil(
      putIndexedDbOutboxItem({
        id: String(data.item.id || `fifo_${nowMs}_${Math.random().toString(36).slice(2, 7)}`),
        seq: typeof data.item.seq === 'number' ? data.item.seq : 0,
        createdAtMs: nowMs,
        status: 'pending',
        actionType: String(data.item.actionType || data.item.reason || 'set_logged'),
        setKey: data.item.setKey || null,
        exerciseId: data.item.exerciseId || null,
        endpoint: String(data.item.endpoint || 'pending_endpoint'),
        payloadJson: String(data.item.payloadJson || '{}'),
        reason: String(data.item.reason || 'sw_message'),
        queuedAt: nowIso,
        lastUpdated: String(data.item.lastUpdated || nowIso),
        attempts: Number(data.item.attempts || 0)
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
    url.pathname.startsWith('/src/') ||
    /\.(?:tsx?|jsx)$/.test(url.pathname) ||
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
