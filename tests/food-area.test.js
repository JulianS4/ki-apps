import test from 'node:test';
import assert from 'node:assert/strict';
import * as food from '../js/areas/food/index.js';
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
