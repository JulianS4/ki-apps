// KI-Apps shell: routing, shared context, delegated events, offline cache.
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
import { FAMILY, cnav } from './areas/cockpit/ui.js';

const $ = s => document.querySelector(s);

// localStorage can be missing or throw (private mode, blocked cookies); then
// the app runs on memory and says so, because nothing survives a restart.
const { backend, persistent } = pickBackend(() => window.localStorage);

const AREAS = { heute, training, recovery, food, routines, body, arena, settings, cockpit, finance, school, projects, agents, notes, integrations };
const TITLES = { training: 'Training', recovery: 'Recovery', food: 'Ernährung', routines: 'Routinen', body: 'Körper', arena: 'Arena', settings: 'Einstellungen' };
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

function header(route, area) {
  // Cockpit pages share one navigation row under the brand.
  if (FAMILY.includes(route.area)) return `<div class="lead"><a class="brand" href="#cockpit">Cockpit</a></div><a class="home" href="#heute">KI-Apps ›</a>${cnav(route.area)}`;
  const left = route.area === 'arena' && arenaOnly(ctx.store) ? '<span class="brand">Arena</span>' : route.area === 'heute'
    ? '<a class="brand" href="#heute">KI-Apps</a>'
    : `<a class="home" href="#heute">‹ Heute</a><span class="brand">${TITLES[route.area]}</span>`;
  const right = area.header ? area.header(route, ctx)
    : route.area === 'heute' ? '<nav class="tabs"><a href="#cockpit">Cockpit</a><a href="#einstellungen">Einstellungen</a></nav>' : '';
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
  const cx = FAMILY.includes(route.area);
  document.body.classList.toggle('cx', cx);
  $('#top').innerHTML = header(route, area);
  const nav = cx && $('#top .cnav'), on = nav && nav.querySelector('.on');
  if (on) nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
  $('#main').innerHTML = area.render(route, ctx);
  if (area.mount) area.mount($('#main'), route, ctx);
}

for (const type of ['click', 'input', 'change']) {
  const name = 'on' + type[0].toUpperCase() + type.slice(1);
  $('#main').addEventListener(type, e => { if (current && current.area[name]) current.area[name](e, current.route, ctx); });
}
$('#main').addEventListener('focusout', () => setTimeout(() => { if (needs) render(); }, 0));

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
setInterval(() => { if (!document.hidden && current && current.route.area === 'heute') render(); }, 60000);

runMigrations(ctx.store);
if (training.init) training.init(ctx);
if (recovery.init) recovery.init(ctx);
render();
ctx.setStatus(!persistent ? 'Speichern nicht möglich – privater Modus? Einträge gehen beim Schließen verloren.'
  : ctx.store.keys().length ? 'Gespeichert auf diesem Gerät' : 'Bereit · Daten bleiben auf diesem Gerät');
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
