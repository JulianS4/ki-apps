import test from 'node:test';
import assert from 'node:assert/strict';
import * as rout from '../js/areas/routines/index.js';
import * as food from '../js/areas/food/index.js';
import { runOf } from '../js/core/guided.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const at = (h, m, d = 26) => new Date(2026, 10, d, h, m);
const TODAY = { area: 'routines', view: 'today' };
const mk = (now = at(6, 7)) => {
  const store = createStore(memBackend());
  const ctx = { store, now: () => now, setStatus() {}, toast() {}, rerender() {}, go() {}, prevHash: null };
  rout.reload(ctx);
  rout.onNavigate({ area: 'routines', view: 'today' }, ctx);
  return ctx;
};
// Minimal stand-ins for the delegated DOM events the shell passes on.
const click = dataset => ({ target: { closest: () => ({ dataset }) } });
const change = (dataset, extra = {}) => ({ target: { dataset, ...extra } });
const day = (ctx, d = '2026-11-26') => (ctx.store.get('rout.days') || {})[d] || {};

test('today shows both routines with shifted times', () => {
  const thu = rout.render(TODAY, mk());
  assert.match(thu, /ab 06:00/);
  assert.match(thu, /ab 20:30/);
  const sat = rout.render(TODAY, mk(at(8, 0, 28)));
  assert.match(sat, /ab 07:00/);
  assert.match(sat, /ab 21:30/);
});

test('ticking a step is stored per day', () => {
  const ctx = mk();
  rout.onChange(change({ a: 'step', k: 'morgen', id: 'toilette' }, { checked: true }), TODAY, ctx);
  assert.equal(day(ctx).morgen.toilette, true);
  assert.deepEqual(rout.summary(ctx).morgen, { done: 1, total: 10 });
  rout.onChange(change({ a: 'step', k: 'morgen', id: 'toilette' }, { checked: false }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).morgen, { done: 0, total: 10 });
});

test('everything done in one tap', () => {
  const ctx = mk();
  rout.onClick(click({ a: 'all', k: 'morgen' }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).morgen, { done: 10, total: 10 });
});

test('pack list ticks', () => {
  const ctx = mk();
  rout.onChange(change({ a: 'pack', id: 'handy' }, { checked: true }), TODAY, ctx);
  assert.equal(day(ctx).pack.handy, true);
  assert.match(rout.render(TODAY, ctx), /Packliste 1\/15/);
});

test('yesterday evening card shows in the morning', () => {
  assert.match(rout.render(TODAY, mk(at(7, 0))), /Gestern Abend 0\/7/);
  assert.doesNotMatch(rout.render(TODAY, mk(at(12, 30))), /Gestern Abend/);
});

test('malformed routine data never crashes', () => {
  for (const bad of ['x', [], { '2026-11-26': { morgen: 5, pack: [] } }, { '2026-11-26': 'x' }]) {
    const ctx = mk();
    ctx.store.set('rout.days', bad);
    assert.doesNotThrow(() => rout.render(TODAY, ctx));
    assert.doesNotThrow(() => rout.summary(ctx));
    rout.onChange(change({ a: 'step', k: 'morgen', id: 'toilette' }, { checked: true }), TODAY, ctx);
    rout.onChange(change({ a: 'pack', id: 'handy' }, { checked: true }), TODAY, ctx);
    assert.equal(day(ctx).morgen.toilette, true, JSON.stringify(bad));
    assert.equal(day(ctx).pack.handy, true, JSON.stringify(bad));
  }
});

test('header highlights the active tab', () => {
  assert.match(rout.header({ area: 'routines', view: 'holder' }), /href="#routinen\/halterung" class="on"/);
});

const FOOD = { area: 'food', view: 'today' };
const step = (ctx, k, id, checked = true) => rout.onChange(change({ a: 'step', k, id }, { checked }), TODAY, ctx);

test('mobility tick is shared with recovery', () => {
  const ctx = mk();
  step(ctx, 'abend', 'mobility');
  assert.deepEqual(ctx.store.get('rec.mobility')['2026-11-26'], { done: true });
  step(ctx, 'abend', 'mobility', false);
  assert.equal(ctx.store.get('rec.mobility')['2026-11-26'], undefined);
  ctx.store.set('rec.mobility', { '2026-11-26': { done: true } });
  assert.match(rout.render(TODAY, ctx), /data-id="mobility" checked/);
  assert.equal(rout.summary(ctx).abend.done, 1);
});

test('evening supplements tick is shared with nutrition', () => {
  const ctx = mk();
  step(ctx, 'abend', 'lesen');
  const s = ctx.store.get('food.days')['2026-11-26'].supps;
  assert.equal(s.magnesium, true);
  assert.equal(s.kirsch, true);
  step(ctx, 'abend', 'lesen', false);
  assert.equal(rout.summary(ctx).abend.done, 0);
  food.onChange(change({ a: 'supp', id: 'magnesium' }, { checked: true }), FOOD, ctx);
  food.onChange(change({ a: 'supp', id: 'kirsch' }, { checked: true }), FOOD, ctx);
  assert.equal(rout.summary(ctx).abend.done, 1);
});

test('morning water counts half a litre once', () => {
  const ctx = mk();
  step(ctx, 'morgen', 'wasser');
  assert.equal(food.summary(ctx).water, 500);
  assert.match(food.render(FOOD, ctx), /0,5 \/ 3,5 L/);
  assert.match(food.render(FOOD, ctx), /inkl\. 0,5 L aus der Morgenroutine/);
  food.onClick(click({ a: 'water' }), FOOD, ctx);
  assert.equal(food.summary(ctx).water, 1000);
  food.onClick(click({ a: 'waterminus' }), FOOD, ctx);
  food.onClick(click({ a: 'waterminus' }), FOOD, ctx);
  assert.equal(food.summary(ctx).water, 500);
  step(ctx, 'morgen', 'wasser', false);
  assert.equal(food.summary(ctx).water, 0);
});

test('everything done in the evening sets the linked steps too', () => {
  const ctx = mk();
  rout.onClick(click({ a: 'all', k: 'abend' }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).abend, { done: 7, total: 7 });
  assert.deepEqual(ctx.store.get('rec.mobility')['2026-11-26'], { done: true });
});

test('yesterday evening can be completed in the morning', () => {
  const ctx = mk(at(7, 0));
  rout.onClick(click({ a: 'yall' }), TODAY, ctx);
  assert.deepEqual(rout.summaryFor(ctx, '2026-11-25').abend, { done: 7, total: 7 });
  assert.deepEqual(ctx.store.get('rec.mobility')['2026-11-25'], { done: true });
  assert.equal(ctx.store.get('food.days')['2026-11-25'].supps.kirsch, true);
  assert.deepEqual(rout.summary(ctx).abend, { done: 0, total: 7 });
  assert.doesNotMatch(rout.render(TODAY, ctx), /Gestern Abend/);
});

const GRAND = { area: 'routines', view: 'grandpa' };
test('grandpa timer ticks the step when done', t => {
  let now = 5_000_000;
  t.mock.method(Date, 'now', () => now);
  const ctx = mk();
  assert.match(rout.render(GRAND, ctx), /Lymphatic Hops/);
  rout.onClick(click({ a: 'tstart' }), GRAND, ctx);
  now += 95_000;
  assert.match(rout.render(GRAND, ctx), /Golf Swings/);
  now += 150_000;
  rout.mount(null, GRAND, ctx);
  assert.equal(day(ctx).morgen.grandpa, true);
  assert.match(rout.render(GRAND, ctx), /Geschafft ✓/);
  rout.onNavigate({ area: 'routines', view: 'today' }, ctx);
  assert.equal(runOf('grandpa'), null);
});
