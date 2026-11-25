// Recovery area: morning check, mobility, breathing, recovery blocks,
// week check and deload cycle. All state lives in the store (rec.*).
import { ds, DAYS, dayIdx } from '../../core/dates.js';
import { BLOCKS, CYCLE_ANCHOR } from './data.js';
import { checkSum, ampel, plannedBed, cycleInfo, mobilityFor, deloadTriggers, sundayOf } from './logic.js';
import { todayView } from './view.js';

const SCORES = ['schlaf', 'energie', 'muskeln'];
const WEEKLY = ['schlaf', 'energie', 'gelenke', 'ziel'];
const isNum = v => typeof v === 'number' && Number.isFinite(v);

const day = ctx => ds(ctx.now());
const map = (ctx, k) => ctx.store.get(k, {}) || {};
function put(ctx, k, v) {
  if (!ctx.store.set(k, v)) ctx.setStatus('Speichern nicht möglich – privater Modus?');
}
export const anchor = ctx => (ctx.store.get('rec.cycle') || {}).anchor || CYCLE_ANCHOR;
const inputs = ctx => ({ morning: map(ctx, 'rec.morning'), complaints: ctx.store.get('rec.complaints', []) || [], flags: map(ctx, 'rec.flags') });

// Today's morning entry, with bed and wake times taken from the Week Routine
// until the person changes them.
const entryFor = (ctx, d) => ({ ...plannedBed(d), puls: null, ...map(ctx, 'rec.morning')[d] });
function setMorning(ctx, patch) {
  const d = day(ctx), m = map(ctx, 'rec.morning');
  m[d] = { ...entryFor(ctx, d), ...patch };
  put(ctx, 'rec.morning', m);
}
function setDone(ctx, key, d, on) {
  const m = map(ctx, key);
  if (on) m[d] = { done: true }; else delete m[d];
  put(ctx, key, m);
}

export const weeklyDone = (ctx, d) => {
  const w = map(ctx, 'rec.weekly')[sundayOf(d)];
  return !!w && WEEKLY.every(k => isNum(w[k]));
};

export function summary(ctx) {
  const d = day(ctx), sum = checkSum(map(ctx, 'rec.morning')[d]), m = mobilityFor(d);
  return {
    ampel: ampel(sum), sum,
    mobility: { routine: m.routine, name: m.name, minutes: m.minutes, done: !!map(ctx, 'rec.mobility')[d] },
    cycle: cycleInfo(d, anchor(ctx)),
    suggest: deloadTriggers(inputs(ctx), d).suggest,
  };
}

export function reload() { /* state is read from the store on every render */ }

export function header(route) {
  const v = route.view, tab = (h, l, on) => `<a href="${h}"${on ? ' class="on"' : ''}>${l}</a>`;
  return `<nav class="tabs">${tab('#recovery', 'Tag',!['week', 'cycle'].includes(v))}${tab('#recovery/woche', 'Woche', v === 'week')}${tab('#recovery/zyklus', 'Zyklus', v === 'cycle')}</nav>`;
}

export function render(route, ctx) {
  const d = day(ctx), s = summary(ctx), entry = entryFor(ctx, d), wd = DAYS[dayIdx(new Date(d + 'T12:00:00'))];
  return todayView({
    day: d, entry, planned: plannedBed(d), sum: s.sum, amp: s.ampel,
    mob: { ...mobilityFor(d), done: s.mobility.done }, sat: wd === 'sa',
    blocks: BLOCKS[wd] || null, blockDone: map(ctx, 'rec.blocks')[d] || {}, weeklyDone: weeklyDone(ctx, d),
    cycle: s.cycle, trig: deloadTriggers(inputs(ctx), d),
  });
}

export function onClick(e, route, ctx) {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const a = t.dataset.a, n = +t.dataset.n;
  if (a === 'mc' && SCORES.includes(t.dataset.k) && n >= 1 && n <= 5) { setMorning(ctx, { [t.dataset.k]: n }); ctx.rerender(); }
}

export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (a === 'bed' || a === 'wake') {
    if (/^\d\d:\d\d$/.test(t.value)) setMorning(ctx, { [a]: t.value });
    ctx.rerender();
  }
  if (a === 'puls') {
    const n = parseInt(t.value, 10);
    setMorning(ctx, { puls: n >= 25 && n <= 200 ? n : null });
    ctx.rerender();
  }
  if (a === 'mobdone') { setDone(ctx, 'rec.mobility', day(ctx), t.checked); ctx.rerender(); }
  if (a === 'blk') {
    const d = day(ctx), m = map(ctx, 'rec.blocks'), b = { ...m[d] };
    if (t.checked) b[t.dataset.i] = true; else delete b[t.dataset.i];
    m[d] = b;
    put(ctx, 'rec.blocks', m);
    ctx.rerender();
  }
}
