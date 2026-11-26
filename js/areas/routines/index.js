// Routines area: morning and evening checklists, the Chinese Grandpa timer and
// the phone-holder mode. Linked steps live in the areas that own them:
// mobility in rec.mobility, the evening supplements in food.days.
import { ds, addDays } from '../../core/dates.js';
import { mobilityFor } from '../recovery/logic.js';
import { supps, setSuppGroup, groupDone } from '../food/index.js';
import { timerState, startRun, toggleRun, stopRun, runOf, activeRun, mountRun, unlockAudio, stepTimerView, keepAwake } from '../../core/guided.js';
import { GRANDPA, GRANDPA_END, EVENING } from './data.js';
import { routineFor, progress, activeStep } from './logic.js';
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
  const steps = routineFor(kind, d);
  editTicks(ctx, d, x => { for (const s of steps) if (s.link !== 'mobility' && s.link !== 'supps') x[kind][s.id] = true; });
  for (const s of steps) if (s.link === 'mobility' || s.link === 'supps') setLinked(ctx, d, s.link, true);
}

export function summaryFor(ctx, d) {
  const t = ticksOf(ctx, d), l = linked(ctx, d);
  return { morgen: progress(routineFor('morgen', d), t.morgen, l), abend: progress(routineFor('abend', d), t.abend, l) };
}
export const summary = ctx => summaryFor(ctx, dayOf(ctx));

export function reload() { /* state is read from the store on every render */ }
// Screen-only state: which fold-outs are open. Kept here because every tick
// redraws the page (on iOS a tapped checkbox does not keep the focus).
const open = { pack: false, yest: false };

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
  if (!(next && next.area === 'routines' && next.view === 'holder')) leaveHolder();
  const r = activeRun();
  if (r && r.kind === 'grandpa' && !(next && next.area === 'routines' && next.view === 'grandpa')) stopRun();
}

export function header(route) {
  const v = route.view, tab = (h, l, on) => `<a href="${h}"${on ? ' class="on"' : ''}>${l}</a>`;
  return `<nav class="tabs">${tab('#routinen', 'Tag', v !== 'holder')}${tab('#routinen/halterung', 'Halterung', v === 'holder')}</nav>`;
}

function routineVM(ctx, kind, d) {
  const steps = routineFor(kind, d), ticks = ticksOf(ctx, d)[kind], l = linked(ctx, d);
  return { day: d, steps, ticks, linked: l, prog: progress(steps, ticks, l) };
}
function todayVM(ctx) {
  const d = dayOf(ctx), t = timeOf(ctx), y = routineVM(ctx, 'abend', addDays(d, -1));
  return {
    day: d, first: t < '14:00' ? 'morgen' : 'abend', open: { ...open },
    routines: { morgen: routineVM(ctx, 'morgen', d), abend: routineVM(ctx, 'abend', d) }, pack: ticksOf(ctx, d).pack,
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
  if (route.view === 'holder') return holderView({ day: dayOf(ctx), active: activeStep(dayOf(ctx), timeOf(ctx)) });
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

export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a, d = dayOf(ctx);
  if (a === 'step' && KINDS.includes(t.dataset.k)) {
    const k = t.dataset.k, sd = tickDay(ctx, t.dataset.d), s = sd && routineFor(k, sd).find(x => x.id === t.dataset.id);
    if (s && (s.link === 'mobility' || s.link === 'supps')) setLinked(ctx, sd, s.link, t.checked);
    else if (s) editTicks(ctx, sd, x => { if (t.checked) x[k][s.id] = true; else delete x[k][s.id]; });
    ctx.rerender();
  }
  if (a === 'pack' && t.dataset.id) {
    editTicks(ctx, d, x => { if (t.checked) x.pack[t.dataset.id] = true; else delete x.pack[t.dataset.id]; });
    ctx.rerender();
  }
}
