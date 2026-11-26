// Körper area: measurements with curves, photos with a before/after view and
// the quarter check. Weight lives in body.weight, which Ernährung reads for
// the protein target; everything else in body.log, body.quarter, body.photos.
import { ds } from '../../core/dates.js';
import { FIELDS, QUARTER_ITEMS } from './data.js';
import { checkForm, cleanWeights, cleanLog, cleanTicks, measureDays, series, quarterOf, quarterStatus, fmtNum, fmtTime } from './logic.js';
import { overviewView, entryView, historyView, photosPlaceholder, dayLine } from './view.js';

export const dayOf = ctx => ds(ctx.now());
const isDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
function put(ctx, k, v) {
  if (!ctx.store.set(k, v) && ctx.setStatus) ctx.setStatus('Speichern nicht möglich – privater Modus?');
}
const data = ctx => ({ weights: ctx.store.get('body.weight'), log: ctx.store.get('body.log'), photos: ctx.store.get('body.photos'), ticks: ctx.store.get('body.quarter') });
const last = pts => pts[pts.length - 1] || null;

// Screen-only state: the form being filled, its error and the delete question.
let draft = null, err = '', confirm = null;

export function reload() { /* state is read from the store on every render */ }
export function onNavigate() { draft = null; err = ''; confirm = null; }

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
function draftFor(ctx, route) {
  const d = entryDay(ctx, route.date);
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
  ctx.go('#koerper/verlauf');
}

function overviewVM(ctx) {
  const { weights, log } = data(ctx), pick = id => last(series(weights, log, id));
  return { quarter: { q: quarterOf(dayOf(ctx)), ...quarterStatus(quarterOf(dayOf(ctx)), data(ctx)) }, latest: { kg: pick('kg'), fat: pick('fat'), run5k: pick('run5k'), hang: pick('hang') } };
}
function historyVM(ctx) {
  const { weights, log } = data(ctx), w = cleanWeights(weights), l = cleanLog(log);
  return { days: measureDays(w, l).map(date => ({ date, line: dayLine(w[date], l[date] || {}) })), confirm };
}

export function render(route, ctx) {
  if (route.view === 'entry') return entryView({ ...draftFor(ctx, route), err, today: dayOf(ctx) });
  if (route.view === 'history') return historyView(historyVM(ctx));
  if (route.view === 'photos') return photosPlaceholder();
  return overviewView(overviewVM(ctx));
}

export function mount() { /* charts and photos are bound in later tasks */ }

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
}

// Typing: saved in the draft as you go, without redrawing.
export function onInput(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a, k = t.dataset && t.dataset.k;
  if (a === 'bf' && route.view === 'entry' && (k === 'mob' || FIELDS.some(f => f.id === k))) draftFor(ctx, route).values[k] = t.value;
}

export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (a === 'bdate' && isDay(t.value) && t.value <= dayOf(ctx)) ctx.go('#koerper/messung?' + t.value);
  if (a === 'qtick' && QUARTER_ITEMS.some(i => i.id === t.dataset.id)) {
    const q = quarterOf(dayOf(ctx)), all = cleanTicks(ctx.store.get('body.quarter')), x = { ...(all[q] || {}) };
    if (t.checked) x[t.dataset.id] = true; else delete x[t.dataset.id];
    all[q] = x;
    put(ctx, 'body.quarter', all);
    ctx.rerender();
  }
}
