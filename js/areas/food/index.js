// Nutrition area: protein from tapped dishes, water, the clean-day rule,
// supplements and the shopping list. All state lives in the store (food.*).
import { ds } from '../../core/dates.js';
import { DISHES, SUPPS, SHOP, WATER, SHOP_NOTE } from './data.js';
import {
  latestWeight, proteinTarget, foodTotals, cleanStreak, dueGroup, snackHint, dinnerHint, mealprepDay,
  suggestions, slotAt,
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

// Screen-only state: the entry being edited, the dish whose ingredients show,
// the typed free grams and whether the weight field is open.
let editing = null, peek = null, draft = '', weightEdit = false, held = 0;

export function reload() { /* state is read from the store on every render */ }
export function onNavigate() { editing = null; peek = null; draft = ''; weightEdit = false; held = 0; }

const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function addMeal(ctx, m) {
  const meal = { id: uid(), t: timeOf(ctx), ...m };
  editDay(ctx, e => { e.meals = [...e.meals, meal]; });
  return meal;
}

function todayVM(ctx) {
  const d = dayOf(ctx), t = timeOf(ctx), e = dayEntry(ctx, d), w = weight(ctx), all = dishes(ctx), s = suggestions(all, d, t);
  return {
    day: d, weight: w, target: w ? proteinTarget(w.kg) : null, protein: foodTotals(e).protein, weightEdit,
    slot: slotAt(t), now: s.now, rest: s.rest, peek: peek && all.find(x => x.id === peek), draft,
    meals: e.meals, editing,
  };
}

export function header(route) {
  const v = route.view, tab = (h, l, on) => `<a href="${h}"${on ? ' class="on"' : ''}>${l}</a>`;
  return `<nav class="tabs">${tab('#ernaehrung', 'Tag', v === 'today')}${tab('#ernaehrung/gerichte', 'Gerichte', v === 'dishes')}${tab('#ernaehrung/einkauf', 'Einkauf', v === 'shop')}</nav>`;
}

export function render(route, ctx) {
  const v = { day: dayOf(ctx) };
  if (route.view === 'dishes') return dishesView(v);
  if (route.view === 'shop') return shopView({ ...v, note: SHOP_NOTE });
  return todayView(todayVM(ctx));
}

// Press and hold a dish (450 ms) to see its ingredients instead of logging it.
export function mount(root, route, ctx) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('.dish[data-id]').forEach(b => {
    let timer = null;
    const stop = () => clearTimeout(timer);
    b.addEventListener('pointerdown', () => {
      stop();
      timer = setTimeout(() => { held = Date.now(); peek = b.dataset.id; ctx.rerender(); }, 450);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, stop));
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
}

export function onClick(e, route, ctx) {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const a = t.dataset.a, id = t.dataset.id;
  if (a === 'dish') {
    // The click that ends a long press must not log the dish as well.
    if (held && !t.dataset.nohold) { const fresh = Date.now() - held < 1500; held = 0; if (fresh) return; }
    const d = dishes(ctx).find(x => x.id === id);
    if (!d) return;
    const m = addMeal(ctx, { name: d.name, g: d.g, slot: d.slot, dish: d.id });
    peek = null;
    editing = d.free ? m.id : null;
    ctx.rerender();
  }
  if (a === 'quick') { const g = +t.dataset.g; if (g > 0) addMeal(ctx, { name: 'Eigene Eingabe', g, slot: 'frei' }); ctx.rerender(); }
  if (a === 'fadd') {
    const g = parseInt(draft, 10);
    if (g >= 1 && g <= 300) { addMeal(ctx, { name: 'Eigene Eingabe', g, slot: 'frei' }); draft = ''; }
    ctx.rerender();
  }
  if (a === 'medit') { editing = editing === id ? null : id; ctx.rerender(); }
  if (a === 'mdone') { editing = null; ctx.rerender(); }
  if (a === 'mdel') { editDay(ctx, x => { x.meals = x.meals.filter(m => m.id !== id); }); editing = null; ctx.rerender(); }
  if (a === 'peekx') { peek = null; ctx.rerender(); }
  if (a === 'wedit') { weightEdit = true; ctx.rerender(); }
}

export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (a === 'weight') {
    const kg = Math.round(parseFloat(String(t.value).replace(',', '.')) * 10) / 10;
    if (kg >= 30 && kg <= 250) {
      const w = ctx.store.get('body.weight', {}) || {};
      w[dayOf(ctx)] = kg;
      put(ctx, 'body.weight', w);
      weightEdit = false;
    }
    ctx.rerender();
  }
  if (a === 'mg') {
    const g = parseInt(t.value, 10);
    if (g >= 0 && g <= 300) editDay(ctx, x => { x.meals = x.meals.map(m => (m.id === t.dataset.id ? { ...m, g } : m)); });
    ctx.rerender();
  }
}

export function onInput(e) {
  const t = e.target;
  if (t.dataset && t.dataset.a === 'free') draft = t.value;
}
