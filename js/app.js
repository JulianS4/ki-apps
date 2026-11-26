// Life OS shell: routing, navigation, shared context, delegated events, offline cache.
import { createStore, pickBackend } from './core/store.js';
import { parseRoute } from './core/routes.js';
import { runMigrations } from './core/migrate.js';
import * as heute from './areas/heute.js';
import * as settings from './areas/settings.js';
import * as training from './areas/training/index.js';
import * as recovery from './areas/recovery/index.js';
import * as food from './areas/food/index.js';
import * as routines from './areas/routines/index.js';
import * as body from './areas/body/index.js';
import * as arena from './areas/arena/index.js';
import { arenaOnly } from './areas/arena/index.js';
import * as cockpit from './areas/cockpit/home.js';
import * as finance from './areas/cockpit/finance.js';
import * as school from './areas/cockpit/school.js';
import * as projects from './areas/cockpit/projects.js';
import * as agents from './areas/cockpit/agents.js';
import * as notes from './areas/cockpit/notes.js';
import * as integrations from './areas/cockpit/integrations.js';
import { FAMILY } from './areas/cockpit/ui.js';
import { navKey, sideNav, bottomNav, moreList } from './areas/cockpit/nav.js';

const $ = s => document.querySelector(s);

// localStorage can be missing or throw (private mode, blocked cookies); then
// the app runs on memory and says so, because nothing survives a restart.
const { backend, persistent } = pickBackend(() => window.localStorage);

const AREAS = { heute, training, recovery, food, routines, body, arena, settings, cockpit, finance, school, projects, agents, notes, integrations };
const TITLES = { training: 'Training', recovery: 'Recovery', food: 'Ernährung', routines: 'Routinen', body: 'Körper', arena: 'Arena' };
let toastT = null, current = null, needs = false, rzT = null;
const pos = {};

const ctx = {
  store: createStore(backend),
  now: () => new Date(),
  prevHash: null,
  rerender: () => render(),
  setStatus: t => { $('#status').textContent = t; },
  toast(title, line) {
    const t = $('#toast'), b = document.createElement('b');
    b.textContent = title;
    t.replaceChildren(b, document.createTextNode(line));
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 3800);
  },
  go: h => { location.hash = h; },
  reloadAll: () => Object.values(AREAS).forEach(a => a.reload && a.reload(ctx)),
};

// The top bar: the app name on phones, or the way back from a Training &
// Erholung page; an area may add its own tabs on the right.
function header(route, area) {
  const left = route.area === 'arena' && arenaOnly(ctx.store) ? '<span class="brand">Arena</span>'
    : TITLES[route.area] ? `<a class="home" href="#heute" aria-label="Zurück zu Training &amp; Erholung">‹</a><span class="brand">${TITLES[route.area]}</span>`
      : '<a class="brand m" href="#uebersicht">Life OS</a>';
  const right = area.header ? area.header(route, ctx) : '';
  return `<div class="lead">${left}</div>${right}`;
}

function render() {
  const ae = document.activeElement;
  if (ae && /INPUT|TEXTAREA/.test(ae.tagName) && ae.closest('#main')) { needs = true; return; }
  needs = false;
  const route = parseRoute(location.hash), area = AREAS[route.area];
  // Uygar sees only the arena (and settings) until he shows everything.
  if (arenaOnly(ctx.store) && route.area !== 'arena' && route.area !== 'settings') { location.replace('#arena'); return; }
  current = { route, area };
  const key = navKey(route);
  document.body.classList.toggle('wide', FAMILY.includes(route.area) || route.area === 'settings' || route.area === 'heute');
  document.body.classList.toggle('solo', arenaOnly(ctx.store));
  $('#side').innerHTML = sideNav(key);
  $('#bnav').innerHTML = bottomNav(key);
  $('#top').innerHTML = header(route, area);
  $('#main').innerHTML = area.render(route, ctx);
  if (area.mount) area.mount($('#main'), route, ctx);
}

for (const type of ['click', 'input', 'change']) {
  const name = 'on' + type[0].toUpperCase() + type.slice(1);
  $('#main').addEventListener(type, e => { if (current && current.area[name]) current.area[name](e, current.route, ctx); });
}
$('#main').addEventListener('focusout', () => setTimeout(() => { if (needs) render(); }, 0));

// "Mehr" on the phone: every area in a dialog (Escape and the backdrop close it).
const more = $('#more');
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('[data-skip]')) { $('#main').focus(); return; }
  const t = e.target.closest && e.target.closest('[data-nav]');
  if (t && t.dataset.nav === 'more') {
    more.innerHTML = moreList(navKey(parseRoute(location.hash)));
    more.showModal();
    t.setAttribute('aria-expanded', 'true');
  } else if ((t && t.dataset.nav === 'close') || e.target === more || (e.target.closest && e.target.closest('#more a'))) more.close();
});
more.addEventListener('close', () => { const b = $('#bnav [data-nav="more"]'); if (b) b.setAttribute('aria-expanded', 'false'); });

addEventListener('hashchange', e => {
  const o = new URL(e.oldURL).hash, n = location.hash;
  pos[o] = scrollY;
  ctx.prevHash = o;
  const next = parseRoute(n), area = AREAS[next.area], left = AREAS[parseRoute(o).area];
  // The area being left hears about it too, so it can stop a running timer.
  if (left !== area && left.onNavigate) left.onNavigate(next, ctx);
  if (area.onNavigate) area.onNavigate(next, ctx);
  render();
  // Coming back from an exercise's progress page keeps your place.
  scrollTo(0, parseRoute(o).view === 'ex' && next.view !== 'ex' && pos[n] != null ? pos[n] : 0);
});
addEventListener('resize', () => {
  if (current && current.area.redrawOnResize && current.area.redrawOnResize(current.route)) {
    clearTimeout(rzT);
    rzT = setTimeout(render, 150);
  }
});

// Home-screen apps resume without reloading: redraw so "Heute" and the
// training day follow the clock instead of showing this morning's state.
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
setInterval(() => { if (!document.hidden && current && (current.route.area === 'heute' || current.route.area === 'cockpit')) render(); }, 60000);

runMigrations(ctx.store);
if (training.init) training.init(ctx);
if (recovery.init) recovery.init(ctx);
render();
if (!persistent) ctx.setStatus('Speichern nicht möglich – privater Modus? Einträge gehen beim Schließen verloren.');
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
