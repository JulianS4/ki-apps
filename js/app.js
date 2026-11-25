// KI-Apps shell: routing, shared context, delegated events, offline cache.
import { createStore } from './core/store.js';
import { parseRoute } from './core/routes.js';
import * as heute from './areas/heute.js';
import * as settings from './areas/settings.js';
import * as training from './areas/training/index.js';

const $ = s => document.querySelector(s);

// localStorage can be missing or throw (private mode); fall back to memory.
const memory = new Map();
const fallback = {
  getItem: k => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: k => memory.delete(k),
  key: i => [...memory.keys()][i] ?? null,
  get length() { return memory.size; },
};
let backend = fallback;
try { backend = window.localStorage; backend.getItem('ki.probe'); } catch (e) { backend = fallback; }

const AREAS = { heute, training, settings };
const TITLES = { training: 'Training', settings: 'Einstellungen' };
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
  const left = route.area === 'heute'
    ? '<a class="brand" href="#heute">KI-Apps</a>'
    : `<a class="home" href="#heute">‹ Heute</a><span class="brand">${TITLES[route.area]}</span>`;
  const right = area.header ? area.header(route, ctx)
    : route.area === 'heute' ? '<nav class="tabs"><a href="#einstellungen">Einstellungen</a></nav>' : '';
  return `<div class="lead">${left}</div>${right}`;
}

function render() {
  const ae = document.activeElement;
  if (ae && /INPUT|TEXTAREA/.test(ae.tagName) && ae.closest('#main')) { needs = true; return; }
  needs = false;
  const route = parseRoute(location.hash), area = AREAS[route.area];
  current = { route, area };
  $('#top').innerHTML = header(route, area);
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
  const next = parseRoute(n), area = AREAS[next.area];
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

if (training.init) training.init(ctx);
render();
ctx.setStatus(ctx.store.keys().length ? 'Gespeichert auf diesem Gerät' : 'Bereit · Daten bleiben auf diesem Gerät');
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
