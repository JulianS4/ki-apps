// Körper area: measurements with curves, photos with a before/after view and
// the quarter check. Weight lives in body.weight, which Ernährung reads for
// the protein target; everything else in body.log, body.quarter, body.photos.
import { ds, dfmt } from '../../core/dates.js';
import { esc } from '../../core/html.js';
import { bindChart } from '../training/chart.js';
import { FIELDS, QUARTER_ITEMS, GOALS, POSES } from './data.js';
import { checkForm, cleanWeights, cleanLog, cleanTicks, cleanPhotos, measureDays, series, quarterOf, quarterStatus, fmtNum, fmtTime } from './logic.js';
import { overviewView, entryView, historyView, photosView, dayLine, fmtValue } from './view.js';
import { idbPhotos, resizeImage } from './photos.js';
import { lineChart } from './chart.js';

export const dayOf = ctx => ds(ctx.now());
const isDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
function put(ctx, k, v) {
  if (!ctx.store.set(k, v) && ctx.setStatus) ctx.setStatus('Speichern nicht möglich – privater Modus?');
}
const data = ctx => ({ weights: ctx.store.get('body.weight'), log: ctx.store.get('body.log'), photos: ctx.store.get('body.photos'), ticks: ctx.store.get('body.quarter') });
const last = pts => pts[pts.length - 1] || null;

// Screen-only state: the form being filled, its error and the delete question
// (a date for a measurement day, "p:" + date for a photo day), and the photo
// screen: day for new photos, the two compared days, the pose.
let draft = null, err = '', confirm = null, chosen = null, pday = null, pa = null, pb = null, pose = 'vorne', urls = [];

// Photo store: tests set one; the app opens IndexedDB once. null = not available.
let photos, resize = resizeImage;
export const setPhotoStore = s => { photos = s; };
export const setResizer = fn => { resize = fn; };
export function photoStore() {
  if (photos === undefined) { try { photos = idbPhotos(); } catch (e) { photos = null; } }
  return photos;
}
function freeUrls() {
  for (const u of urls) URL.revokeObjectURL(u);
  urls = [];
}

export function reload() { /* state is read from the store on every render */ }
export function onNavigate() {
  draft = null; err = ''; confirm = null; chosen = null; pday = null; pa = null; pb = null; pose = 'vorne';
  freeUrls();
}

export function header(route) {
  const v = route.view, tab = (h, l, on) => `<a href="${h}"${on ? ' class="on"' : ''}>${l}</a>`;
  return `<nav class="tabs">${tab('#koerper', 'Übersicht', v === 'overview' || v === 'entry')}${tab('#koerper/verlauf', 'Verlauf', v === 'history')}${tab('#koerper/fotos', 'Fotos', v === 'photos')}</nav>`;
}

export function summary(ctx) {
  const q = quarterOf(dayOf(ctx)), s = quarterStatus(q, data(ctx)), w = ctx.store.get('body.weight');
  return { kg: last(series(w, null, 'kg')), quarter: { q, done: s.done, total: s.total } };
}

// The form's day: a valid date that is not in the future, else today.
function entryDay(ctx, d) {
  const t = dayOf(ctx);
  return isDay(d) && d <= t ? d : t;
}
function storedValues(ctx, d) {
  const w = cleanWeights(ctx.store.get('body.weight'))[d], x = cleanLog(ctx.store.get('body.log'))[d] || {}, out = {};
  for (const f of FIELDS) {
    const v = f.id === 'kg' ? w : x[f.id];
    out[f.id] = v == null ? '' : f.time ? (f.id === 'hang' && v < 60 ? String(v) : fmtTime(v)) : fmtNum(v);
  }
  out.mob = x.mob || '';
  return out;
}
// The day picked in the form wins over the address: on the iPhone the page
// redraws only once the date field is left, so typing must not depend on it.
function draftFor(ctx, route) {
  const d = entryDay(ctx, chosen || route.date);
  if (!draft || draft.date !== d) { draft = { date: d, values: storedValues(ctx, d) }; err = ''; }
  return draft;
}

// The whole form or nothing; an empty field deletes that day's value.
function save(ctx, route) {
  const f = draftFor(ctx, route), r = checkForm(f.values);
  if (!r.ok) { err = r.error; ctx.rerender(); return; }
  const d = f.date, v = r.values, w = cleanWeights(ctx.store.get('body.weight')), log = cleanLog(ctx.store.get('body.log')), x = {};
  if (v.kg === null) delete w[d]; else w[d] = v.kg;
  for (const fd of FIELDS) if (fd.id !== 'kg' && v[fd.id] !== null) x[fd.id] = v[fd.id];
  if (v.mob) x.mob = v.mob;
  if (Object.keys(x).length) log[d] = x; else delete log[d];
  put(ctx, 'body.weight', w);
  put(ctx, 'body.log', log);
  draft = null;
  err = '';
  chosen = null;
  ctx.go('#koerper/verlauf');
}

function overviewVM(ctx) {
  const { weights, log } = data(ctx), pick = id => last(series(weights, log, id));
  return { quarter: { q: quarterOf(dayOf(ctx)), ...quarterStatus(quarterOf(dayOf(ctx)), data(ctx)) }, latest: { kg: pick('kg'), fat: pick('fat'), run5k: pick('run5k'), hang: pick('hang') } };
}
// One curve per value with at least two entries; a single entry is a line.
const mainWidth = () => (typeof document !== 'undefined' && document.getElementById('main') && document.getElementById('main').clientWidth) || 600;
const CHARTS = FIELDS.map(f => ({
  id: f.id, label: f.label, unit: f.id === 'run5k' ? 'min' : f.unit,
  ...(f.id === 'kg' ? { goal: GOALS.kg } : {}), ...(f.id === 'fat' ? { band: GOALS.fat } : {}),
  ...(f.id === 'run5k' ? { fmt: fmtTime, step: 5 } : {}), ...(f.id === 'hang' ? { step: 1 } : {}),
}));
let CH = [];
function charts(ctx) {
  const { weights, log } = data(ctx), curves = [], singles = [];
  CH = [];
  for (const c of CHARTS) {
    const pts = series(weights, log, c.id);
    if (pts.length >= 2) {
      const r = lineChart({ ...c, pts, width: mainWidth() });
      CH.push(r.ch);
      curves.push(`<div class="bchart"><p class="note fl"><b>${esc(c.label)}</b></p>${r.html}</div>`);
    } else if (pts.length === 1) singles.push(`<li>${esc(c.label)} ${fmtValue(c.id, pts[0].y)} am ${dfmt(pts[0].date)}</li>`);
  }
  return (curves.length ? `<section class="blk">${curves.join('')}</section>` : '')
    + (singles.length ? `<section class="blk"><p class="note">Eine Messung bisher, die Kurve kommt ab der zweiten:</p><ul class="note bsingle">${singles.join('')}</ul></section>` : '');
}
function historyVM(ctx) {
  const { weights, log } = data(ctx), w = cleanWeights(weights), l = cleanLog(log);
  return { days: measureDays(w, l).map(date => ({ date, line: dayLine(w[date], l[date] || {}) })), confirm, charts: charts(ctx) };
}

const photoDay = ctx => (isDay(pday) && pday <= dayOf(ctx) ? pday : dayOf(ctx));
function photosVM(ctx) {
  const idx = cleanPhotos(ctx.store.get('body.photos')), days = Object.keys(idx).sort(), day = photoDay(ctx);
  return {
    available: !!photoStore(), day, today: dayOf(ctx), idx, days, pose,
    a: days.includes(pa) ? pa : days[0] || null, b: days.includes(pb) ? pb : days[days.length - 1] || null,
    confirm: confirm && confirm.startsWith('p:') ? confirm.slice(2) : null,
  };
}

// Shrink, store, and only then index: a failed save leaves no ghost entry.
async function savePhoto(ctx, p, file) {
  const s = photoStore(), d = photoDay(ctx);
  if (!s || !file) return;
  try {
    await s.put(`${d}:${p}`, await resize(file));
  } catch (e) {
    if (ctx.setStatus) ctx.setStatus('Foto konnte nicht gespeichert werden');
    if (ctx.toast) ctx.toast('Foto konnte nicht gespeichert werden', 'Bitte nochmal versuchen.');
    return;
  }
  const idx = cleanPhotos(ctx.store.get('body.photos'));
  idx[d] = { ...(idx[d] || {}), [p]: true };
  put(ctx, 'body.photos', idx);
  ctx.rerender();
}
async function deletePhotos(ctx, d) {
  const s = photoStore();
  if (s) for (const p of POSES) { try { await s.del(`${d}:${p.id}`); } catch (e) { /* gone from the index anyway */ } }
  const idx = cleanPhotos(ctx.store.get('body.photos'));
  delete idx[d];
  put(ctx, 'body.photos', idx);
  ctx.rerender();
}
// Images come from the store after drawing; a missing one says so.
async function loadImages(root) {
  freeUrls();
  const s = photoStore();
  for (const img of root.querySelectorAll('img[data-photo]')) {
    let blob = null, failed = false;
    try { blob = s ? await s.get(img.dataset.photo) : null; } catch (e) { failed = true; }
    if (!img.isConnected) continue;
    if (blob) {
      const u = URL.createObjectURL(blob);
      urls.push(u);
      img.src = u;
    } else {
      const m = document.createElement('div');
      m.className = 'pmiss';
      m.textContent = failed ? 'Foto konnte nicht geladen werden' : 'Foto nicht auf diesem Gerät';
      img.replaceWith(m);
    }
  }
}

export function render(route, ctx) {
  if (route.view === 'entry') return entryView({ ...draftFor(ctx, route), err, today: dayOf(ctx) });
  if (route.view === 'history') return historyView(historyVM(ctx));
  if (route.view === 'photos') return photosView(photosVM(ctx));
  return overviewView(overviewVM(ctx));
}

export function mount(root, route, ctx) {
  if (route.view === 'history' && root) root.querySelectorAll('.bchart').forEach((el, i) => bindChart(el, CH[i]));
  if (route.view === 'photos' && root) {
    // The camera can return after a redraw (the page was hidden meanwhile). A
    // listener on the input itself still fires once the input has left the page.
    for (const inp of root.querySelectorAll('input[data-a="pfile"]')) {
      if (POSES.some(p => p.id === inp.dataset.pose)) inp.addEventListener('change', () => savePhoto(ctx, inp.dataset.pose, inp.files && inp.files[0]));
    }
    loadImages(root);
  }
}

export function onClick(e, route, ctx) {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const a = t.dataset.a;
  if (a === 'bsave' && route.view === 'entry') save(ctx, route);
  if (a === 'bdel' && isDay(t.dataset.d)) {
    // Two taps: the first only asks.
    if (confirm !== t.dataset.d) { confirm = t.dataset.d; ctx.rerender(); return; }
    confirm = null;
    const w = cleanWeights(ctx.store.get('body.weight')), l = cleanLog(ctx.store.get('body.log'));
    delete w[t.dataset.d];
    delete l[t.dataset.d];
    put(ctx, 'body.weight', w);
    put(ctx, 'body.log', l);
    ctx.rerender();
  }
  if (a === 'ppose' && POSES.some(p => p.id === t.dataset.pose)) { pose = t.dataset.pose; ctx.rerender(); }
  if (a === 'pdel' && isDay(t.dataset.d)) {
    if (confirm !== 'p:' + t.dataset.d) { confirm = 'p:' + t.dataset.d; ctx.rerender(); return undefined; }
    confirm = null;
    return deletePhotos(ctx, t.dataset.d);
  }
  return undefined;
}

// Typing: saved in the draft as you go, without redrawing.
export function onInput(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a, k = t.dataset && t.dataset.k;
  if (a === 'bf' && route.view === 'entry' && (k === 'mob' || FIELDS.some(f => f.id === k))) draftFor(ctx, route).values[k] = t.value;
}

export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (a === 'bdate') {
    if (isDay(t.value) && t.value <= dayOf(ctx)) {
      // Typed values come along unless that day already has its own.
      const cur = draftFor(ctx, route), stored = storedValues(ctx, t.value);
      chosen = t.value;
      draft = { date: t.value, values: Object.values(stored).some(v => v !== '') ? stored : { ...cur.values } };
      err = '';
    }
    ctx.rerender();
  }
  if (a === 'pdate') {
    if (isDay(t.value) && t.value <= dayOf(ctx)) pday = t.value;
    ctx.rerender();
  }
  if ((a === 'pa' || a === 'pb') && isDay(t.value)) { if (a === 'pa') pa = t.value; else pb = t.value; ctx.rerender(); }
  if (a === 'qtick' && QUARTER_ITEMS.some(i => i.id === t.dataset.id)) {
    const q = quarterOf(dayOf(ctx)), all = cleanTicks(ctx.store.get('body.quarter')), x = { ...(all[q] || {}) };
    if (t.checked) x[t.dataset.id] = true; else delete x[t.dataset.id];
    all[q] = x;
    put(ctx, 'body.quarter', all);
    ctx.rerender();
  }
}
