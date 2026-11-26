import test from 'node:test';
import assert from 'node:assert/strict';
import * as food from '../js/areas/food/index.js';
import { todayView } from '../js/areas/food/view.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const THU = new Date(2026, 10, 26, 7, 30);
const at = (h, m, d = 26) => new Date(2026, 10, d, h, m);
const TODAY = { area: 'food', view: 'today' };
const mk = (now = THU, weight = null) => {
  const store = createStore(memBackend());
  if (weight) store.set('body.weight', { '2026-11-20': weight });
  const ctx = { store, now: () => now, setStatus() {}, toast() {}, rerender() {}, go() {}, prevHash: null };
  food.reload(ctx);
  food.onNavigate({ area: 'food', view: 'today' }, ctx);
  return ctx;
};
// Minimal stand-ins for the delegated DOM events the shell passes on.
const click = dataset => ({ target: { closest: () => ({ dataset }) } });
const change = (dataset, extra = {}) => ({ target: { dataset, ...extra } });
const input = (dataset, value) => ({ target: { dataset, value } });
const day = (ctx, d = '2026-11-26') => (ctx.store.get('food.days') || {})[d] || {};

test('header highlights the active tab', () => {
  assert.match(food.header({ area: 'food', view: 'shop' }), /href="#ernaehrung\/einkauf" class="on"/);
});

test('summary on a fresh install', () => {
  const s = food.summary(mk());
  assert.deepEqual(
    { protein: s.protein, target: s.target, water: s.water, waterGoal: s.waterGoal, clean: s.clean, streak: s.streak },
    { protein: 0, target: null, water: 0, waterGoal: 3500, clean: undefined, streak: 0 },
  );
  assert.deepEqual(s.due, { group: 'morgens', done: 0, total: 3 });
});

test('protein asks for the weight first', () => {
  const ctx = mk();
  let html = food.render(TODAY, ctx);
  assert.match(html, /data-a="weight"/);
  assert.doesNotMatch(html, /NaN/);
  food.onChange(change({ a: 'weight' }, { value: '12' }), TODAY, ctx);
  assert.equal(ctx.store.get('body.weight'), null);
  food.onChange(change({ a: 'weight' }, { value: '85,0' }), TODAY, ctx);
  assert.deepEqual(ctx.store.get('body.weight'), { '2026-11-26': 85 });
  html = food.render(TODAY, ctx);
  assert.match(html, /0 \/ 170 g/);
  assert.doesNotMatch(html, /data-a="weight"/);
});

test('tapping a dish logs it with time and protein', () => {
  const ctx = mk(THU, 85);
  food.onClick(click({ a: 'dish', id: 'joghurt-bowl' }), TODAY, ctx);
  const m = day(ctx).meals[0];
  assert.deepEqual({ name: m.name, g: m.g, t: m.t, slot: m.slot, dish: m.dish }, { name: 'Joghurt Bowl', g: 45, t: '07:30', slot: 'fr', dish: 'joghurt-bowl' });
  assert.ok(m.id);
  assert.match(food.render(TODAY, ctx), /45 \/ 170 g/);
});

test('suggested dishes come first', () => {
  const html = food.render(TODAY, mk(THU, 85));
  const a = html.indexOf('data-id="joghurt-bowl"'), b = html.indexOf('data-id="lachspfanne"');
  assert.ok(a > -1 && b > a);
});

test('a meal after 19:00 is marked late', () => {
  const late = mk(at(19, 30), 85);
  food.onClick(click({ a: 'dish', id: 'bolognese' }), TODAY, late);
  assert.match(food.render(TODAY, late), /nach 19 Uhr/);
  const ok = mk(at(18, 59), 85);
  food.onClick(click({ a: 'dish', id: 'bolognese' }), TODAY, ok);
  assert.doesNotMatch(food.render(TODAY, ok), /nach 19 Uhr/);
});

test('aldi opens for its grams', () => {
  const ctx = mk(at(12, 0), 85);
  food.onClick(click({ a: 'dish', id: 'aldi' }), TODAY, ctx);
  assert.equal(day(ctx).meals[0].g, 30);
  assert.match(food.render(TODAY, ctx), /data-a="mg"/);
});

test('free grams, editing and deleting an entry', () => {
  const ctx = mk(THU, 85);
  food.onClick(click({ a: 'quick', g: '20' }), TODAY, ctx);
  const m = day(ctx).meals[0];
  assert.deepEqual({ name: m.name, g: m.g, slot: m.slot }, { name: 'Eigene Eingabe', g: 20, slot: 'frei' });
  food.onInput(input({ a: 'free' }, '35'), TODAY, ctx);
  food.onClick(click({ a: 'fadd' }), TODAY, ctx);
  assert.equal(day(ctx).meals[1].g, 35);
  food.onClick(click({ a: 'medit', id: m.id }), TODAY, ctx);
  assert.match(food.render(TODAY, ctx), /data-a="mg"/);
  food.onChange(change({ a: 'mg', id: m.id }, { value: '25' }), TODAY, ctx);
  assert.equal(day(ctx).meals[0].g, 25);
  food.onClick(click({ a: 'mdel', id: m.id }), TODAY, ctx);
  assert.equal(day(ctx).meals.length, 1);
  assert.match(food.render(TODAY, ctx), /35 \/ 170 g/);
});

test('water adds the bottle size', () => {
  const ctx = mk(THU, 85);
  food.onClick(click({ a: 'waterminus' }), TODAY, ctx);
  assert.equal(day(ctx).water || 0, 0);
  food.onClick(click({ a: 'water' }), TODAY, ctx);
  food.onClick(click({ a: 'water' }), TODAY, ctx);
  assert.equal(day(ctx).water, 1000);
  assert.match(food.render(TODAY, ctx), /1,0 \/ 3,5 L/);
  food.onClick(click({ a: 'waterminus' }), TODAY, ctx);
  assert.equal(day(ctx).water, 500);
  food.onChange(change({ a: 'bottle' }, { value: '750' }), TODAY, ctx);
  food.onClick(click({ a: 'water' }), TODAY, ctx);
  assert.equal(day(ctx).water, 1250);
  assert.match(food.render(TODAY, ctx), /1,25 \/ 3,5 L/);
});

test('clean day and broken rules', () => {
  const ctx = mk(THU, 85);
  food.onClick(click({ a: 'clean' }), TODAY, ctx);
  assert.equal(day(ctx).clean, true);
  assert.match(food.render(TODAY, ctx), /1 Tag sauber/);
  food.onClick(click({ a: 'broke', k: 'kaffee' }), TODAY, ctx);
  assert.equal(day(ctx).clean, false);
  assert.deepEqual(day(ctx).broken, ['kaffee']);
  food.onClick(click({ a: 'broke', k: 'kaffee' }), TODAY, ctx);
  assert.equal(day(ctx).clean, undefined);
  food.onClick(click({ a: 'clean' }), TODAY, ctx);
  food.onClick(click({ a: 'clean' }), TODAY, ctx);
  assert.equal(day(ctx).clean, undefined);
});

test('creatine tick adds exactly one shake', () => {
  const ctx = mk(THU, 85);
  const tick = checked => food.onChange(change({ a: 'supp', id: 'kreatin' }, { checked }), TODAY, ctx);
  tick(true);
  tick(true);
  const shakes = day(ctx).meals.filter(m => m.supp === 'kreatin');
  assert.equal(shakes.length, 1);
  assert.equal(shakes[0].g, 25);
  assert.equal(day(ctx).supps.kreatin, true);
  tick(false);
  assert.equal(day(ctx).meals.filter(m => m.supp === 'kreatin').length, 0);
  assert.equal(day(ctx).supps.kreatin, undefined);
  assert.equal(food.summary(ctx).protein, 0);
});

test('due supplements come first', () => {
  const morning = food.render(TODAY, mk(THU, 85));
  assert.ok(morning.indexOf('Morgens') > -1 && morning.indexOf('Morgens') < morning.indexOf('Mittags'));
  const evening = food.render(TODAY, mk(at(18, 0), 85));
  assert.ok(evening.indexOf('Abends') > -1 && evening.indexOf('Abends') < evening.indexOf('Morgens'));
  const ctx = mk(THU, 85);
  food.onChange(change({ a: 'supp', id: 'omega' }, { checked: true }), TODAY, ctx);
  assert.deepEqual(food.summary(ctx).due, { group: 'morgens', done: 1, total: 3 });
});

const DISH = { area: 'food', view: 'dishes' };

test('dishes view shows the ingredients', () => {
  const html = food.render(DISH, mk());
  assert.match(html, /Griechischer Joghurt \+ Whey/);
  assert.match(html, /Frühstück Sa–So/);
  assert.match(html, /data-a="dedit"/);
});

test('editing a dish changes the plan', () => {
  const ctx = mk(THU, 85);
  food.onClick(click({ a: 'dedit' }), DISH, ctx);
  assert.match(food.render(DISH, ctx), /data-a="dg"/);
  food.onChange(change({ a: 'dg', id: 'joghurt-bowl' }, { value: '50' }), DISH, ctx);
  assert.equal(ctx.store.get('food.dishes').find(d => d.id === 'joghurt-bowl').g, 50);
  food.onClick(click({ a: 'dish', id: 'joghurt-bowl' }), TODAY, ctx);
  assert.equal(day(ctx).meals[0].g, 50);
});

test('editing a dish does not change logged meals', () => {
  const ctx = mk(THU, 85);
  food.onClick(click({ a: 'dish', id: 'joghurt-bowl' }), TODAY, ctx);
  food.onClick(click({ a: 'dedit' }), DISH, ctx);
  food.onInput(input({ a: 'dn', id: 'joghurt-bowl' }, 'Bowl XL'), DISH, ctx);
  food.onChange(change({ a: 'dg', id: 'joghurt-bowl' }, { value: '60' }), DISH, ctx);
  assert.equal(ctx.store.get('food.dishes').find(d => d.id === 'joghurt-bowl').name, 'Bowl XL');
  const m = day(ctx).meals[0];
  assert.deepEqual({ name: m.name, g: m.g }, { name: 'Joghurt Bowl', g: 45 });
  food.onClick(click({ a: 'dreset' }), DISH, ctx);
  assert.ok(Array.isArray(ctx.store.get('food.dishes')));
  food.onClick(click({ a: 'dreset' }), DISH, ctx);
  assert.equal(ctx.store.get('food.dishes'), null);
  assert.deepEqual({ name: day(ctx).meals[0].name, g: day(ctx).meals[0].g }, { name: 'Joghurt Bowl', g: 45 });
});

test('adding and deleting a dish', () => {
  const ctx = mk(THU, 85);
  food.onClick(click({ a: 'dedit' }), DISH, ctx);
  food.onClick(click({ a: 'dadd', slot: 'sn', days: 'all' }), DISH, ctx);
  const added = ctx.store.get('food.dishes').filter(d => d.name === 'Neues Gericht');
  assert.equal(added.length, 1);
  assert.deepEqual({ slot: added[0].slot, days: added[0].days, g: added[0].g }, { slot: 'sn', days: 'all', g: 20 });
  food.onClick(click({ a: 'ddel', id: added[0].id }), DISH, ctx);
  assert.equal(ctx.store.get('food.dishes').filter(d => d.name === 'Neues Gericht').length, 0);
});

const SHOP_V = { area: 'food', view: 'shop' };
const MILK = 'Milchprodukte & Eier';

test('shopping list marks missing items', () => {
  const ctx = mk(THU, 85);
  food.onChange(change({ a: 'need', id: 'eier' }, { checked: true }), SHOP_V, ctx);
  assert.deepEqual(ctx.store.get('food.need'), { eier: true });
  food.onClick(click({ a: 'onlyneed' }), SHOP_V, ctx);
  let html = food.render(SHOP_V, ctx);
  assert.match(html, /data-id="eier"/);
  assert.doesNotMatch(html, /data-id="milch"/);
  food.onChange(change({ a: 'need', id: 'eier' }, { checked: false }), SHOP_V, ctx);
  assert.deepEqual(ctx.store.get('food.need'), {});
  food.onChange(change({ a: 'need', id: 'milch' }, { checked: true }), SHOP_V, ctx);
  food.onClick(click({ a: 'shopclear' }), SHOP_V, ctx);
  assert.deepEqual(ctx.store.get('food.need'), { milch: true });
  food.onClick(click({ a: 'shopclear' }), SHOP_V, ctx);
  assert.deepEqual(ctx.store.get('food.need'), {});
  html = food.render(SHOP_V, ctx);
  assert.match(html, /Nichts fehlt/);
});

test('adding and removing a shopping item', () => {
  const ctx = mk(THU, 85);
  food.onClick(click({ a: 'iedit' }), SHOP_V, ctx);
  food.onInput(input({ a: 'inew', cat: MILK }, 'Hafermilch'), SHOP_V, ctx);
  food.onClick(click({ a: 'iadd', cat: MILK }), SHOP_V, ctx);
  const items = () => ctx.store.get('food.shop').find(c => c.cat === MILK).items.map(i => i.id);
  assert.ok(items().includes('hafermilch'));
  food.onInput(input({ a: 'inew', cat: MILK }, 'Hafermilch'), SHOP_V, ctx);
  food.onClick(click({ a: 'iadd', cat: MILK }), SHOP_V, ctx);
  assert.ok(items().includes('hafermilch-2'));
  food.onClick(click({ a: 'idel', id: 'hafermilch' }), SHOP_V, ctx);
  assert.ok(!items().includes('hafermilch'));
  food.onClick(click({ a: 'ireset' }), SHOP_V, ctx);
  food.onClick(click({ a: 'ireset' }), SHOP_V, ctx);
  assert.equal(ctx.store.get('food.shop'), null);
});

test('mealprep reminder on wednesday and sunday', () => {
  assert.match(food.render(SHOP_V, mk(at(9, 0, 25))), /Heute Mealprep/);
  assert.doesNotMatch(food.render(SHOP_V, mk(THU)), /Heute Mealprep/);
});

test('editing supplements keeps the shake', () => {
  const ctx = mk(THU, 85);
  food.onClick(click({ a: 'sedit' }), TODAY, ctx);
  assert.match(food.render(TODAY, ctx), /data-a="sn"/);
  food.onInput(input({ a: 'sn', id: 'kreatin' }, 'Kreatin + Whey'), TODAY, ctx);
  assert.equal(ctx.store.get('food.supps').find(s => s.id === 'kreatin').name, 'Kreatin + Whey');
  food.onChange(change({ a: 'supp', id: 'kreatin' }, { checked: true }), TODAY, ctx);
  assert.equal(day(ctx).meals.find(m => m.supp === 'kreatin').g, 25);
  food.onClick(click({ a: 'sadd', group: 'abends' }), TODAY, ctx);
  const added = ctx.store.get('food.supps').find(s => s.name === 'Neues Supplement');
  assert.equal(added.group, 'abends');
  food.onClick(click({ a: 'sdel', id: added.id }), TODAY, ctx);
  assert.equal(ctx.store.get('food.supps').some(s => s.id === added.id), false);
  food.onClick(click({ a: 'sreset' }), TODAY, ctx);
  food.onClick(click({ a: 'sreset' }), TODAY, ctx);
  assert.equal(ctx.store.get('food.supps'), null);
});

// Hand-edited backups can put anything into the store; nothing may crash.
test('malformed food data never crashes', () => {
  const bad = [
    ['food.supps', [null, { id: 'x', group: 'morgens', shake: 20 }]],
    ['food.dishes', [null, 5, { id: 'ok', slot: 'fr', days: 'wt', name: 'Ok', g: 10 }]],
    ['food.shop', [null, { cat: 'A' }, { cat: 'B', items: [null, { id: 'i', name: 'I' }] }]],
    ['food.need', 'x'],
    ['food.days', { '2026-11-26': { meals: [null, 5, { id: 'm', name: 'M', g: 'x', t: '08:00' }], broken: 5, supps: 'x', water: -500 } }],
    ['food.days', []],
    ['body.weight', { zzz: 70, '2026-11-20': 0.2 }],
    ['body.weight', 'x'],
  ];
  for (const [k, v] of bad) {
    const ctx = mk(THU);
    ctx.store.set(k, v);
    for (const view of ['today', 'dishes', 'shop']) assert.doesNotThrow(() => food.render({ area: 'food', view }, ctx), `${k} ${view}`);
    assert.doesNotThrow(() => food.summary(ctx), k);
    assert.doesNotMatch(food.render(TODAY, ctx), /NaN|-0,5/, k);
    assert.doesNotThrow(() => {
      food.onChange(change({ a: 'supp', id: 'x' }, { checked: true }), TODAY, ctx);
      food.onClick(click({ a: 'water' }), TODAY, ctx);
      food.onClick(click({ a: 'mdel', id: 'm' }), TODAY, ctx);
      food.onChange(change({ a: 'need', id: 'i' }, { checked: true }), SHOP_V, ctx);
      food.onChange(change({ a: 'weight' }, { value: '80' }), TODAY, ctx);
      food.onClick(click({ a: 'iedit' }), SHOP_V, ctx);
      food.onInput(input({ a: 'inew', cat: 'B' }, 'Neu'), SHOP_V, ctx);
      food.onClick(click({ a: 'iadd', cat: 'B' }), SHOP_V, ctx);
    }, k);
    assert.equal(day(ctx).water, 500, k);
    assert.equal(ctx.store.get('food.need').i, true, k);
    assert.equal(ctx.store.get('body.weight')['2026-11-26'], 80, k);
  }
});

test('the weight field accepts a German decimal comma', () => {
  assert.match(food.render(TODAY, mk()), /type="text" inputmode="decimal"[^>]*data-a="weight"/);
});

test('other dishes stay open while logging', () => {
  const ctx = mk(THU, 85);
  food.onClick(click({ a: 'more' }), TODAY, ctx);
  assert.match(food.render(TODAY, ctx), /<details class="ses more" open>/);
  food.onClick(click({ a: 'dish', id: 'shake' }), TODAY, ctx);
  assert.match(food.render(TODAY, ctx), /<details class="ses more" open>/);
  food.onClick(click({ a: 'more' }), TODAY, ctx);
  assert.match(food.render(TODAY, ctx), /<details class="ses more">/);
});

test('a held dish from the other list shows its ingredients there', () => {
  const shake = { id: 'shake', slot: 'dr', days: 'all', name: 'Protein Shake', g: 25, ing: 'statt Milchshakes' };
  const html = todayView({ day: '2026-11-26', weight: null, protein: 0, slot: 'fr', now: [], rest: [shake], peek: shake, draft: '', meals: [], water: 0, bottle: 500, supps: [], ticked: {}, due: 'morgens', broken: [], streak: 0 });
  const more = html.slice(html.indexOf('<details class="ses more"'));
  assert.match(more, /^<details class="ses more" open>/);
  assert.match(more.slice(0, more.indexOf('</details>')), /class="ex peek"/);
});

test('yesterday can still be marked clean', () => {
  const ctx = mk(THU, 85);
  ctx.store.set('food.days', { '2026-11-23': { meals: [], clean: true }, '2026-11-24': { meals: [], clean: true } });
  assert.match(food.render(TODAY, ctx), /Gestern sauber gegessen\?/);
  assert.equal(food.summary(ctx).streak, 0);
  food.onClick(click({ a: 'yclean' }), TODAY, ctx);
  assert.equal(day(ctx, '2026-11-25').clean, true);
  assert.equal(food.summary(ctx).streak, 3);
  assert.doesNotMatch(food.render(TODAY, ctx), /Gestern sauber gegessen\?/);
  const other = mk(THU, 85);
  food.onClick(click({ a: 'ybroke' }), TODAY, other);
  assert.equal(day(other, '2026-11-25').clean, false);
});
