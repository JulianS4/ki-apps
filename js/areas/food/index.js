// Nutrition area: protein from tapped dishes, water, the clean-day rule,
// supplements and the shopping list. All state lives in the store (food.*).
import { ds } from '../../core/dates.js';
import { DISHES, SUPPS, SHOP, WATER, SHOP_NOTE, RULES, SLOT_ORDER } from './data.js';

const SLOTS_OK = SLOT_ORDER;
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
// Which list is in edit mode, and which double-tap reset is waiting for its second tap.
let dishEditing = false, confirm = null;

export function reload() { /* state is read from the store on every render */ }
export function onNavigate() { editing = null; peek = null; draft = ''; weightEdit = false; held = 0; dishEditing = false; confirm = null; }

const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Editing starts from a copy of the Notion lists; later edits change the copy.
function editList(ctx, key, def, fn) {
  const cur = ctx.store.get(key), l = structuredClone(Array.isArray(cur) ? cur : def);
  put(ctx, key, fn(l) || l);
}
const DAYS_OK = ['wt', 'we', 'all'];

// Two taps, like "Plan zurücksetzen": the first only asks.
function twice(ctx, key, done) {
  if (confirm !== key) { confirm = key; ctx.rerender(); return; }
  confirm = null;
  done();
  ctx.rerender();
}
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
    water: foodTotals(e).water, bottle: bottle(ctx),
    clean: e.clean, broken: e.broken, streak: cleanStreak(map(ctx, 'food.days'), d),
    supps: supps(ctx), ticked: e.supps || {}, due: dueGroup(t),
  };
}

const bottle = ctx => { const b = (ctx.store.get('food.settings') || {}).bottle; return WATER.bottles.includes(b) ? b : WATER.bottle; };
const RULE_KEYS = RULES.map(([k]) => k);

export function header(route) {
  const v = route.view, tab = (h, l, on) => `<a href="${h}"${on ? ' class="on"' : ''}>${l}</a>`;
  return `<nav class="tabs">${tab('#ernaehrung', 'Tag', v === 'today')}${tab('#ernaehrung/gerichte', 'Gerichte', v === 'dishes')}${tab('#ernaehrung/einkauf', 'Einkauf', v === 'shop')}</nav>`;
}

export function render(route, ctx) {
  const v = { day: dayOf(ctx) };
  if (route.view === 'dishes') return dishesView({ ...v, dishes: dishes(ctx), edit: dishEditing, confirm: confirm === 'dishes' });
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
  if (a === 'dedit') { dishEditing = !dishEditing; confirm = null; ctx.rerender(); }
  if (a === 'ddel') { editList(ctx, 'food.dishes', DISHES, l => l.filter(d => d.id !== id)); ctx.rerender(); }
  if (a === 'dadd' && SLOTS_OK.includes(t.dataset.slot) && DAYS_OK.includes(t.dataset.days)) {
    editList(ctx, 'food.dishes', DISHES, l => [...l, { id: 'd' + uid(), slot: t.dataset.slot, days: t.dataset.days, name: 'Neues Gericht', g: 20, ing: '' }]);
    ctx.rerender();
  }
  if (a === 'dreset') twice(ctx, 'dishes', () => { put(ctx, 'food.dishes', null); dishEditing = false; });
  if (a === 'water' || a === 'waterminus') {
    const b = bottle(ctx);
    editDay(ctx, x => { x.water = Math.max(0, foodTotals(x).water + (a === 'water' ? b : -b)); });
    ctx.rerender();
  }
  // "Alles eingehalten" toggles; a broken rule toggles itself and makes the day not clean.
  if (a === 'clean') {
    editDay(ctx, x => { if (x.clean === true) delete x.clean; else x.clean = true; x.broken = []; });
    ctx.rerender();
  }
  if (a === 'broke' && RULE_KEYS.includes(t.dataset.k)) {
    const k = t.dataset.k;
    editDay(ctx, x => {
      const b = Array.isArray(x.broken) ? x.broken : [];
      x.broken = b.includes(k) ? b.filter(r => r !== k) : [...b, k];
      if (x.broken.length) x.clean = false; else delete x.clean;
    });
    ctx.rerender();
  }
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
  if (a === 'bottle') {
    const b = +t.value;
    if (WATER.bottles.includes(b)) put(ctx, 'food.settings', { ...(ctx.store.get('food.settings') || {}), bottle: b });
    ctx.rerender();
  }
  // A supplement that brings protein ("Kreatin + Protein") logs exactly one shake.
  if (a === 'supp') {
    const s = supps(ctx).find(x => x.id === t.dataset.id);
    if (s) {
      editDay(ctx, x => {
        const ticked = { ...x.supps };
        if (t.checked) {
          ticked[s.id] = true;
          if (s.shake && !x.meals.some(m => m.supp === s.id)) {
            x.meals = [...x.meals, { id: uid(), t: timeOf(ctx), name: `Protein Shake (${s.name.split(' ')[0]})`, g: s.shake, slot: 'dr', supp: s.id }];
          }
        } else {
          delete ticked[s.id];
          x.meals = x.meals.filter(m => m.supp !== s.id);
        }
        x.supps = ticked;
      });
    }
    ctx.rerender();
  }
  if (a === 'dg') {
    const g = parseInt(t.value, 10);
    if (g >= 0 && g <= 150) editList(ctx, 'food.dishes', DISHES, l => l.map(d => (d.id === t.dataset.id ? { ...d, g } : d)));
    ctx.rerender();
  }
  if (a === 'mg') {
    const g = parseInt(t.value, 10);
    if (g >= 0 && g <= 300) editDay(ctx, x => { x.meals = x.meals.map(m => (m.id === t.dataset.id ? { ...m, g } : m)); });
    ctx.rerender();
  }
}

// Typing: saved as you go, without redrawing (keeps the keyboard open).
export function onInput(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (a === 'free') draft = t.value;
  if (a === 'dn' || a === 'di') {
    const f = a === 'dn' ? 'name' : 'ing';
    editList(ctx, 'food.dishes', DISHES, l => l.map(d => (d.id === t.dataset.id ? { ...d, [f]: t.value } : d)));
  }
}
