const CACHE_NAME = 'learning-journal-v31';
const APP_SHELL = ['./', './index.html', './styles.css?v=31', './app.js?v=31', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('learning-journal-v') && key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    // Do not replace a working offline shell with an HTTP error page.
    const isShell = APP_SHELL.some((asset) => new URL(asset, self.location.href).href === event.request.url);
    if (response.ok && isShell) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {}));
    }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE_NAME).catch(() => null);
    const cached = await cache?.match(event.request);
    if (cached) return cached;
    // HTML is only a navigation fallback, never a stylesheet or script response.
    if (event.request.mode === 'navigate') return (await cache?.match('./index.html')) || Response.error();
    return Response.error();
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows[0];
    if (existing) return existing.focus();
    return clients.openWindow('./index.html');
  }));
});
