import test from 'node:test';
import assert from 'node:assert/strict';
import * as rout from '../js/areas/routines/index.js';
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
