// Offline cache: network first, cache as fallback. Bump CACHE on every release.
// Own files skip the browser cache (GitHub Pages lets it keep files for 10 minutes): an
// update must never mix an old and a new module, or the page stays blank.
const CACHE = 'ki-apps-v14';
const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'js/app.js', 'js/core/dates.js', 'js/core/store.js', 'js/core/routes.js', 'js/core/schedule.js',
  'js/core/backup.js', 'js/core/html.js', 'js/areas/heute.js', 'js/areas/settings.js',
  'js/areas/training/index.js', 'js/areas/training/plan-default.js', 'js/areas/training/logic.js',
  'js/areas/training/view.js', 'js/areas/training/chart.js', 'js/core/migrate.js',
  'js/areas/recovery/data.js', 'js/areas/recovery/logic.js', 'js/areas/recovery/view.js', 'js/areas/recovery/index.js',
  'js/areas/food/data.js', 'js/areas/food/logic.js', 'js/areas/food/view.js', 'js/areas/food/index.js',
  'js/core/guided.js', 'js/areas/routines/data.js', 'js/areas/routines/logic.js', 'js/areas/routines/view.js', 'js/areas/routines/index.js',
  'js/areas/body/data.js', 'js/areas/body/logic.js', 'js/areas/body/view.js', 'js/areas/body/index.js', 'js/areas/body/chart.js', 'js/areas/body/photos.js',
  'js/areas/arena/data.js', 'js/areas/arena/logic.js', 'js/areas/arena/net.js', 'js/areas/arena/view.js', 'js/areas/arena/index.js',
  'js/areas/cockpit/logic.js', 'js/areas/cockpit/data.js', 'js/areas/cockpit/schema.js', 'js/areas/cockpit/db.js', 'js/areas/cockpit/ui.js', 'js/areas/cockpit/zip.js', 'js/areas/cockpit/nav.js', 'js/areas/cockpit/charts.js',
  'js/areas/cockpit/md.js', 'js/areas/cockpit/unzip.js', 'js/areas/cockpit/vault.js', 'js/areas/cockpit/graph.js', 'js/areas/cockpit/knowledge.js', 'js/areas/cockpit/brain.js', 'js/areas/cockpit/lifeimport.js', 'js/areas/cockpit/imports.js', 'js/areas/cockpit/calendar.js',
  'js/areas/cockpit/home.js', 'js/areas/cockpit/finance.js', 'js/areas/cockpit/school.js', 'js/areas/cockpit/projects.js',
  'js/areas/cockpit/agents.js', 'js/areas/cockpit/notes.js', 'js/areas/cockpit/integrations.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Own files and the pinned Firebase SDK go network first and are cached;
// every other request (Firestore's own channel) passes through untouched.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url), sdk = url.href.startsWith(SDK);
  if (url.origin !== location.origin && !sdk) return;
  e.respondWith(
    (sdk || e.request.mode === 'navigate' ? fetch(e.request) : fetch(e.request, { cache: 'no-cache' }))
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (sdk ? Response.error() : caches.match('index.html'))))
  );
});
