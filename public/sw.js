// Service Worker for PWA - offline caching
// Strategy: network-first for EVERYTHING (always get latest code),
// fall back to cache only when offline.
// This ensures users never get stuck with old cached JS that has bugs.
const CACHE_NAME = 'transmittal-v5';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Paths that must NEVER be cached (file downloads, streaming, dynamic blobs).
const NO_CACHE_PATHS = [
  '/api/excel-template',
  '/api/reports/export',
  '/api/import',
  '/api/files/',
  '/api/transmittals/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  // Force the new SW to take over immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip cross-origin requests
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  
  // NEVER cache download / upload / mutation endpoints
  if (NO_CACHE_PATHS.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(fetch(request));
    return;
  }
  
  // Network-first for ALL requests (JS, CSS, HTML, images, etc.)
  // This ensures the browser always gets the latest code.
  // Cache is only used as a fallback when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses
        if (response.ok && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(request).then((cached) => {
          return cached || caches.match('/');
        });
      })
  );
});

// Listen for messages from the page — allow manual cache clear
self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      return Promise.all(names.map((n) => caches.delete(n)));
    }).then(() => {
      event.ports[0].postMessage({ ok: true });
    });
  }
});
