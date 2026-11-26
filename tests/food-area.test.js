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
