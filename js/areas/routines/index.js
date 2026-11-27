// Routines area: morning and evening checklists, the Chinese Grandpa timer and
// the phone-holder mode. Linked steps live in the areas that own them:
// mobility in rec.mobility, the evening supplements in food.days.
import { ds, addDays } from '../../core/dates.js';
import { mobilityFor } from '../recovery/logic.js';
import { supps, setSuppGroup, groupDone } from '../food/index.js';
import { timerState, startRun, toggleRun, stopRun, runOf, activeRun, mountRun, unlockAudio, stepTimerView, keepAwake } from '../../core/guided.js';
import { GRANDPA, GRANDPA_END, MORNING, EVENING, PACK } from './data.js';
import { routineFor, progress, activeStep, cleanSteps, cleanPack } from './logic.js';
import { todayView, holderView } from './view.js';

const p2 = n => String(n).padStart(2, '0');
export const dayOf = ctx => ds(ctx.now());
const timeOf = ctx => { const d = ctx.now(); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const map = (ctx, k) => { const v = ctx.store.get(k); return isObj(v) ? v : {}; };
function put(ctx, k, v) {
  if (!ctx.store.set(k, v)) ctx.setStatus('Speichern nicht möglich – privater Modus?');
}
const KINDS = ['morgen', 'abend'];

// The step and pack lists: edited copies from storage, else Notion's.
export function steps(ctx) {
  const v = ctx.store.get('rout.steps'), o = isObj(v) ? v : {};
  return { morgen: cleanSteps(o.morgen, MORNING), abend: cleanSteps(o.abend, EVENING) };
}
export const packList = ctx => cleanPack(ctx.store.get('rout.pack'), PACK);
const stepsFor = (ctx, kind, d) => routineFor(kind, d, steps(ctx)[kind]);

// Editing writes the whole edited list (the other routine stays on Notion
// until it is edited too); cleanSteps sorts it on the next read.
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
function editSteps(ctx, kind, fn) {
  const v = ctx.store.get('rout.steps'), o = isObj(v) ? { ...v } : {}, list = steps(ctx)[kind].map(s => ({ ...s }));
  o[kind] = fn(list) || list;
  put(ctx, 'rout.steps', o);
}
function editPack(ctx, fn) {
  const l = packList(ctx).map(c => ({ cat: c.cat, items: c.items.map(i => ({ ...i })) }));
  put(ctx, 'rout.pack', fn(l) || l);
}
const inCat = (l, cat, fn) => l.map(c => (c.cat === cat ? { ...c, items: fn(c.items) } : c));

// One day's ticks, read defensively: only objects count.
function ticksOf(ctx, d) {
  const raw = map(ctx, 'rout.days')[d], e = isObj(raw) ? raw : {};
  const obj = v => (isObj(v) ? { ...v } : {});
  return { morgen: obj(e.morgen), abend: obj(e.abend), pack: obj(e.pack) };
}
function editTicks(ctx, d, fn) {
  const all = map(ctx, 'rout.days'), t = ticksOf(ctx, d);
  fn(t);
  all[d] = t;
  put(ctx, 'rout.days', all);
}

// Linked steps read the state of the area that owns them. With no evening
// supplements the supplements step is a plain tick of its own.
const eveningSupps = ctx => supps(ctx).filter(s => s.group === 'abends');
const SUPP_STEP = EVENING.find(s => s.link === 'supps').id;
function linked(ctx, d) {
  const mob = map(ctx, 'rec.mobility')[d];
  const sup = eveningSupps(ctx).length ? groupDone(ctx, 'abends', d) : ticksOf(ctx, d).abend[SUPP_STEP] === true;
  return { mobility: isObj(mob) && mob.done === true, supps: sup };
}
// ...and are written there, never stored twice.
function setLinked(ctx, d, link, on) {
  if (link === 'mobility') {
    const m = map(ctx, 'rec.mobility');
    if (on) m[d] = { done: true }; else delete m[d];
    put(ctx, 'rec.mobility', m);
  }
  if (link === 'supps' && eveningSupps(ctx).length) setSuppGroup(ctx, 'abends', on, d);
  else if (link === 'supps') editTicks(ctx, d, x => { if (on) x.abend[SUPP_STEP] = true; else delete x.abend[SUPP_STEP]; });
}
function completeRoutine(ctx, kind, d) {
  const list = stepsFor(ctx, kind, d);
  editTicks(ctx, d, x => { for (const s of list) if (s.link !== 'mobility' && s.link !== 'supps') x[kind][s.id] = true; });
  for (const s of list) if (s.link === 'mobility' || s.link === 'supps') setLinked(ctx, d, s.link, true);
}

export function summaryFor(ctx, d) {
  const t = ticksOf(ctx, d), l = linked(ctx, d);
  return { morgen: progress(stepsFor(ctx, 'morgen', d), t.morgen, l), abend: progress(stepsFor(ctx, 'abend', d), t.abend, l) };
}
export const summary = ctx => summaryFor(ctx, dayOf(ctx));

export function reload() { /* state is read from the store on every render */ }
// Screen-only state: which fold-outs are open. Kept here because every tick
// redraws the page (on iOS a tapped checkbox does not keep the focus).
const open = { pack: false, yest: false };
// ...which routine is being edited, and whether the reset asked once.
let editing = null, confirm = false;

// The Grandpa timer belongs to its view: leaving it ends the timer.
let holdInt = null;
function leaveHolder() {
  clearInterval(holdInt);
  holdInt = null;
  keepAwake(false);
}

export function onNavigate(next) {
  open.pack = false;
  open.yest = false;
  editing = null;
  confirm = false;
  if (!(next && next.area === 'routines' && next.view === 'holder')) leaveHolder();
  const r = activeRun();
  if (r && r.kind === 'grandpa' && !(next && next.area === 'routines' && next.view === 'grandpa')) stopRun();
}

export function header(route) {
  const v = route.view, tab = (h, l, on) => `<a href="${h}"${on ? ' class="on"' : ''}>${l}</a>`;
  return `<nav class="tabs">${tab('#kalender', 'Kalender', false)}${tab('#routinen', 'Tag', v !== 'holder')}${tab('#routinen/halterung', 'Halterung', v === 'holder')}</nav>`;
}

function routineVM(ctx, kind, d) {
  const list = stepsFor(ctx, kind, d), ticks = ticksOf(ctx, d)[kind], l = linked(ctx, d);
  return { day: d, steps: list, ticks, linked: l, prog: progress(list, ticks, l) };
}
function todayVM(ctx) {
  const d = dayOf(ctx), t = timeOf(ctx), y = routineVM(ctx, 'abend', addDays(d, -1));
  return {
    day: d, first: t < '14:00' ? 'morgen' : 'abend', open: { ...open }, editing, confirm, base: steps(ctx),
    routines: { morgen: routineVM(ctx, 'morgen', d), abend: routineVM(ctx, 'abend', d) }, pack: ticksOf(ctx, d).pack, packList: packList(ctx),
    mob: mobilityFor(d), supps: eveningSupps(ctx).map(s => s.name),
    yesterday: t < '12:00' && y.prog.done < y.prog.total ? y : null,
  };
}

export function render(route, ctx) {
  if (route.view === 'grandpa') {
    const r = runOf('grandpa'), d = r ? r.def.key : dayOf(ctx);
    return stepTimerView({
      label: 'Chinese Grandpa Routine', steps: GRANDPA, end: GRANDPA_END, status: r ? r.status : 'idle',
      state: timerState(GRANDPA, GRANDPA_END, r ? Math.min(r.t, GRANDPA_END - 0.001) : 0),
      area: 'Routinen', back: '#routinen', doneTitle: 'Geschafft ✓', doneNote: 'Chinese Grandpa ist für heute abgehakt.',
      doneToday: ticksOf(ctx, d).morgen.grandpa === true,
    });
  }
  if (route.view === 'holder') return holderView({ day: dayOf(ctx), active: activeStep(dayOf(ctx), timeOf(ctx), steps(ctx)) });
  return todayView(todayVM(ctx));
}

// Holder mode keeps the screen on and follows the clock every 15 s; the
// browser drops the wake lock in the background, so every mount asks again.
export function mount(root, route, ctx) {
  if (route.view === 'grandpa') mountRun('grandpa', ctx);
  if (route.view === 'holder') {
    keepAwake(true);
    if (!holdInt) holdInt = setInterval(() => ctx.rerender(), 15000);
  }
}

export function onClick(e, route, ctx) {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const a = t.dataset.a, k = t.dataset.k;
  if (a === 'all' && KINDS.includes(k)) { completeRoutine(ctx, k, dayOf(ctx)); ctx.rerender(); }
  if (a === 'yall') { completeRoutine(ctx, 'abend', addDays(dayOf(ctx), -1)); ctx.rerender(); }
  // Editing the lists
  if (a === 'redit' && KINDS.includes(k)) { editing = editing === k ? null : k; confirm = false; ctx.rerender(); }
  if (a === 'radd' && KINDS.includes(k)) {
    editSteps(ctx, k, l => { const last = l[l.length - 1]; return [...l, { id: 'r' + uid(), from: last.to || last.from, title: 'Neuer Schritt' }]; });
    ctx.rerender();
  }
  if (a === 'rdel' && KINDS.includes(k)) { editSteps(ctx, k, l => (l.length > 1 ? l.filter(s => s.id !== t.dataset.id) : l)); ctx.rerender(); }
  if (a === 'padd' && t.dataset.cat) {
    editPack(ctx, l => inCat(l, t.dataset.cat, items => [...items, { id: 'p' + uid(), name: 'Neuer Gegenstand' }]));
    ctx.rerender();
  }
  if (a === 'pdel' && t.dataset.cat) { editPack(ctx, l => inCat(l, t.dataset.cat, items => items.filter(i => i.id !== t.dataset.id))); ctx.rerender(); }
  if (a === 'rreset') {
    // Two taps: the first only asks.
    if (confirm) { put(ctx, 'rout.steps', null); put(ctx, 'rout.pack', null); editing = null; }
    confirm = !confirm;
    ctx.rerender();
  }
  if (a === 'open' && k in open) { if (e.preventDefault) e.preventDefault(); open[k] = !open[k]; ctx.rerender(); }
  if (a === 'tstart' && route.view === 'grandpa') {
    unlockAudio();
    const d = dayOf(ctx);
    startRun({ kind: 'grandpa', key: d, steps: GRANDPA, end: GRANDPA_END, onDone: c => editTicks(c, d, x => { x.morgen.grandpa = true; }) });
    ctx.rerender();
  }
  if (a === 'tpause') { toggleRun(); ctx.rerender(); }
  if (a === 'tstop') { stopRun(); ctx.go('#routinen'); }
}

// A tick names its day; only today and yesterday can be changed.
function tickDay(ctx, raw) {
  const d = dayOf(ctx);
  if (!raw || raw === d) return d;
  return raw === addDays(d, -1) ? raw : null;
}

// Typing: saved as you go, without redrawing (keeps the keyboard open).
export function onInput(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (a === 'rt' && KINDS.includes(t.dataset.k)) editSteps(ctx, t.dataset.k, l => l.map(s => (s.id === t.dataset.id ? { ...s, title: t.value } : s)));
  if (a === 'pn' && t.dataset.cat) editPack(ctx, l => inCat(l, t.dataset.cat, items => items.map(i => (i.id === t.dataset.id ? { ...i, name: t.value } : i))));
}

// A time that is not HH:MM is ignored; an empty "bis" removes it, and a "bis"
// that is not after "von" is ignored.
function setTime(s, field, v) {
  if (field === 'rfrom') return HHMM.test(v) ? { ...s, from: v } : s;
  if (v === '') { const { to, ...rest } = s; return rest; }
  return HHMM.test(v) && v > s.from ? { ...s, to: v } : s;
}

export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a, d = dayOf(ctx);
  if ((a === 'rfrom' || a === 'rto') && KINDS.includes(t.dataset.k)) {
    editSteps(ctx, t.dataset.k, l => l.map(s => (s.id === t.dataset.id ? setTime(s, a, String(t.value || '')) : s)));
    ctx.rerender();
  }
  if (a === 'step' && KINDS.includes(t.dataset.k)) {
    const k = t.dataset.k, sd = tickDay(ctx, t.dataset.d), s = sd && stepsFor(ctx, k, sd).find(x => x.id === t.dataset.id);
    if (s && (s.link === 'mobility' || s.link === 'supps')) setLinked(ctx, sd, s.link, t.checked);
    else if (s) editTicks(ctx, sd, x => { if (t.checked) x[k][s.id] = true; else delete x[k][s.id]; });
    ctx.rerender();
  }
  if (a === 'pack' && t.dataset.id) {
    editTicks(ctx, d, x => { if (t.checked) x.pack[t.dataset.id] = true; else delete x.pack[t.dataset.id]; });
    ctx.rerender();
  }
}
