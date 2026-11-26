// Routines area: morning and evening checklists, the Chinese Grandpa timer and
// the phone-holder mode. Linked steps live in the areas that own them:
// mobility in rec.mobility, the evening supplements in food.days.
import { ds, addDays } from '../../core/dates.js';
import { mobilityFor } from '../recovery/logic.js';
import { supps, dayEntry } from '../food/index.js';
import { routineFor, progress } from './logic.js';
import { todayView, placeholderView } from './view.js';

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

// Linked steps read the state of the area that owns them.
const eveningSupps = ctx => supps(ctx).filter(s => s.group === 'abends');
function linked(ctx, d) {
  const mob = map(ctx, 'rec.mobility')[d], ev = eveningSupps(ctx), ticked = dayEntry(ctx, d).supps || {};
  return { mobility: isObj(mob) && mob.done === true, supps: ev.length > 0 && ev.every(s => ticked[s.id] === true) };
}

export function summaryFor(ctx, d) {
  const t = ticksOf(ctx, d), l = linked(ctx, d);
  return { morgen: progress(routineFor('morgen', d), t.morgen, l), abend: progress(routineFor('abend', d), t.abend, l) };
}
export const summary = ctx => summaryFor(ctx, dayOf(ctx));

export function reload() { /* state is read from the store on every render */ }
export function onNavigate() {}

export function header(route) {
  const v = route.view, tab = (h, l, on) => `<a href="${h}"${on ? ' class="on"' : ''}>${l}</a>`;
  return `<nav class="tabs">${tab('#routinen', 'Tag', v !== 'holder')}${tab('#routinen/halterung', 'Halterung', v === 'holder')}</nav>`;
}

function todayVM(ctx) {
  const d = dayOf(ctx), t = timeOf(ctx), ticks = ticksOf(ctx, d), l = linked(ctx, d), y = addDays(d, -1), yp = summaryFor(ctx, y).abend;
  const routines = {};
  for (const k of KINDS) {
    const steps = routineFor(k, d);
    routines[k] = { steps, ticks: ticks[k], prog: progress(steps, ticks[k], l) };
  }
  return {
    day: d, first: t < '14:00' ? 'morgen' : 'abend', routines, linked: l, pack: ticks.pack,
    mob: mobilityFor(d), supps: eveningSupps(ctx).map(s => s.name),
    yesterday: t < '12:00' && yp.done < yp.total ? yp : null,
  };
}

export function render(route, ctx) {
  if (route.view === 'grandpa') return placeholderView({ day: dayOf(ctx) }, 'Chinese Grandpa');
  if (route.view === 'holder') return placeholderView({ day: dayOf(ctx) }, 'Halterung');
  return todayView(todayVM(ctx));
}

export function mount() {}

export function onClick(e, route, ctx) {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const a = t.dataset.a, k = t.dataset.k;
  if (a === 'all' && KINDS.includes(k)) {
    const d = dayOf(ctx);
    editTicks(ctx, d, x => { for (const s of routineFor(k, d)) if (s.link !== 'mobility' && s.link !== 'supps') x[k][s.id] = true; });
    ctx.rerender();
  }
}

export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a, d = dayOf(ctx);
  if (a === 'step' && KINDS.includes(t.dataset.k)) {
    const k = t.dataset.k, s = routineFor(k, d).find(x => x.id === t.dataset.id);
    if (s && s.link !== 'mobility' && s.link !== 'supps') {
      editTicks(ctx, d, x => { if (t.checked) x[k][s.id] = true; else delete x[k][s.id]; });
    }
    ctx.rerender();
  }
  if (a === 'pack' && t.dataset.id) {
    editTicks(ctx, d, x => { if (t.checked) x.pack[t.dataset.id] = true; else delete x.pack[t.dataset.id]; });
    ctx.rerender();
  }
}
