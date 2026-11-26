// Nutrition area: protein from tapped dishes, water, the clean-day rule,
// supplements and the shopping list. All state lives in the store (food.*).
import { ds } from '../../core/dates.js';
import { DISHES, SUPPS, SHOP, WATER, SHOP_NOTE } from './data.js';
import {
  latestWeight, proteinTarget, foodTotals, cleanStreak, dueGroup, snackHint, dinnerHint, mealprepDay,
} from './logic.js';
import { todayView, dishesView, shopView } from './view.js';

const p2 = n => String(n).padStart(2, '0');
export const dayOf = ctx => ds(ctx.now());
export const timeOf = ctx => { const d = ctx.now(); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
const map = (ctx, k) => ctx.store.get(k, {}) || {};
export function put(ctx, k, v) {
  if (!ctx.store.set(k, v)) ctx.setStatus('Speichern nicht möglich – privater Modus?');
}

// Saved lists, or the Notion start state while nothing was edited.
const list = (ctx, k, def) => { const v = ctx.store.get(k); return Array.isArray(v) ? v : def; };
export const dishes = ctx => list(ctx, 'food.dishes', DISHES);
export const supps = ctx => list(ctx, 'food.supps', SUPPS);
export const shop = ctx => list(ctx, 'food.shop', SHOP);

// Today's entry, always with a meals array; fn may change it in place.
export const dayEntry = (ctx, d = dayOf(ctx)) => {
  const e = { ...map(ctx, 'food.days')[d] };
  e.meals = Array.isArray(e.meals) ? e.meals : [];
  return e;
};
export function editDay(ctx, fn) {
  const d = dayOf(ctx), all = map(ctx, 'food.days'), e = dayEntry(ctx, d);
  fn(e);
  all[d] = e;
  put(ctx, 'food.days', all);
}

export const weight = ctx => latestWeight(map(ctx, 'body.weight'));

export function summary(ctx) {
  const d = dayOf(ctx), t = timeOf(ctx), e = dayEntry(ctx, d), tot = foodTotals(e), w = weight(ctx);
  const group = dueGroup(t), ids = supps(ctx).filter(s => s.group === group).map(s => s.id), ticked = e.supps || {};
  return {
    protein: tot.protein, target: w ? proteinTarget(w.kg) : null, water: tot.water, waterGoal: WATER.goal,
    clean: e.clean, streak: cleanStreak(map(ctx, 'food.days'), d),
    due: { group, done: ids.filter(id => ticked[id]).length, total: ids.length },
    snack: snackHint(d, t, e.meals), dinner: dinnerHint(d, t, e.meals), mealprep: mealprepDay(d),
  };
}

export function reload() { /* state is read from the store on every render */ }
export function onNavigate() {}

export function header(route) {
  const v = route.view, tab = (h, l, on) => `<a href="${h}"${on ? ' class="on"' : ''}>${l}</a>`;
  return `<nav class="tabs">${tab('#ernaehrung', 'Tag', v === 'today')}${tab('#ernaehrung/gerichte', 'Gerichte', v === 'dishes')}${tab('#ernaehrung/einkauf', 'Einkauf', v === 'shop')}</nav>`;
}

export function render(route, ctx) {
  const v = { day: dayOf(ctx) };
  if (route.view === 'dishes') return dishesView(v);
  if (route.view === 'shop') return shopView({ ...v, note: SHOP_NOTE });
  return todayView(v);
}

export function mount() {}
export function onClick() {}
export function onChange() {}
export function onInput() {}
