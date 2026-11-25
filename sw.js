// Offline cache: network first, cache as fallback. Bump CACHE on every release.
const CACHE = 'ki-apps-v1';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'js/app.js', 'js/core/dates.js', 'js/core/store.js', 'js/core/routes.js', 'js/core/schedule.js',
  'js/core/backup.js', 'js/core/html.js', 'js/areas/heute.js', 'js/areas/settings.js',
  'js/areas/training/index.js', 'js/areas/training/plan-default.js', 'js/areas/training/logic.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
