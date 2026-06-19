/* =====================================================================
   GarageSys Service Worker  –  v4 (Offline-First)
   ===================================================================== */

const CACHE_VERSION = 'v4';
const SHELL_CACHE   = `garage-shell-${CACHE_VERSION}`;
const DATA_CACHE    = `garage-data-${CACHE_VERSION}`;
const OFFLINE_URL   = '/index.html';

/* ── Static shell assets to pre-cache on install ──────────────────── */
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/logo64.png',
  '/logo144.png',
  '/logo192.png',
  '/logo512.png',
];

/* ── Font hosts we treat as cacheable ─────────────────────────────── */
const CACHEABLE_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

/* ══════════════════════════════════════════════════════════════════════
   INSTALL  –  cache app shell
   ══════════════════════════════════════════════════════════════════════ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // addAll fails entirely if one URL fails – use safe individual adds
      return Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(err =>
            console.warn(`[SW] Could not pre-cache ${url}:`, err)
          )
        )
      );
    })
  );
  self.skipWaiting();
});

/* ══════════════════════════════════════════════════════════════════════
   ACTIVATE  –  clean up old caches
   ══════════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', (event) => {
  const validCaches = [SHELL_CACHE, DATA_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => !validCaches.includes(k))
          .map(k => {
            console.log(`[SW] Deleting old cache: ${k}`);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

/* ══════════════════════════════════════════════════════════════════════
   FETCH  –  offline-first routing strategy
   ══════════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ── Skip non-GET and chrome-extension requests ─────────────────────
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // ── Navigation requests (page loads) → cache-first → fallback HTML ─
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request));
    return;
  }

  // ── Vite JS/CSS/image assets (hashed filenames) → cache-first ──────
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // ── Google Fonts → stale-while-revalidate ──────────────────────────
  if (CACHEABLE_ORIGINS.some(o => request.url.startsWith(o))) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // ── Everything else → network-first, cache fallback ────────────────
  event.respondWith(networkFirstWithFallback(request));
});

/* ══════════════════════════════════════════════════════════════════════
   BACKGROUND SYNC  –  drain offline action queue
   ══════════════════════════════════════════════════════════════════════ */
self.addEventListener('sync', (event) => {
  if (event.tag === 'garage-offline-sync') {
    event.waitUntil(notifyClientsToSync());
  }
});

/* ══════════════════════════════════════════════════════════════════════
   MESSAGE  –  communicate with app
   ══════════════════════════════════════════════════════════════════════ */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CACHE_URLS') {
    const { urls } = event.data;
    event.waitUntil(
      caches.open(DATA_CACHE).then(cache =>
        Promise.allSettled(urls.map(u => cache.add(u).catch(() => {})))
      )
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ══════════════════════════════════════════════════════════════════════ */

/** Navigate: try network first, fall back to cached /index.html */
async function handleNavigate(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch (_) {
    // Offline → serve the cached shell (SPA handles routing internally)
    const cached = await caches.match(OFFLINE_URL) || await caches.match('/');
    if (cached) return cached;
    // Ultimate fallback
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>GarageSys</title></head>
       <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0b1121;color:#fff;flex-direction:column">
         <h2>📡 You are Offline</h2>
         <p>Please check your internet connection and try again.</p>
         <button onclick="location.reload()" style="padding:10px 24px;background:#4361ee;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem;margin-top:12px">
           Retry
         </button>
       </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/** Cache-first: serve from cache; update cache in background on hit */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    // Background update
    fetch(request)
      .then(r => { if (r && r.status === 200) cache.put(request, r); })
      .catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return cached || new Response('', { status: 503 });
  }
}

/** Stale-while-revalidate: serve cache immediately, update in background */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(r => {
    if (r && r.status === 200) cache.put(request, r.clone());
    return r;
  }).catch(() => null);
  return cached || fetchPromise;
}

/** Network-first: try network, fall back to cache */
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 503 });
  }
}

/** Tell all open tabs to drain their offline queue */
async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'DRAIN_OFFLINE_QUEUE' }));
}
