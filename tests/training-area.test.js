import test from 'node:test';
import assert from 'node:assert/strict';
import * as training from '../js/areas/training/index.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const MON = new Date(2026, 10, 23, 17, 0);
const mk = (sess = {}) => {
  const store = createStore(memBackend());
  store.set('train.sess', sess);
  const ctx = { store, now: () => MON, setStatus() {}, toast() {}, rerender() {}, prevHash: null };
  training.reload(ctx);
  return ctx;
};
const set = (v, w) => ({ v: String(v), w: String(w), ok: true });

test('todaySummary on a fresh install', () => {
  assert.deepEqual(training.todaySummary(mk()), { name: 'Lower A', type: 'kraft', done: 0, total: 23 });
});
test('day view links use training routes', () => {
  const html = training.render({ area: 'training', view: 'day', day: null }, mk());
  assert.match(html, /href="#training\/x-pistol"/);
  assert.match(html, /href="#training\/di"/);
  assert.doesNotMatch(html, /href="#x-/);
});
test('history view lists exercises with progress links', () => {
  const ctx = mk({ 's_2026-11-16_mo': { date: '2026-11-16', day: 'mo', sets: { pistol: [set(6, 15)] } } });
  const html = training.render({ area: 'training', view: 'hist' }, ctx);
  assert.match(html, /<h1>Verlauf<\/h1>/);
  assert.match(html, /href="#training\/x-pistol"/);
});
test('exercise view shows tiles and a chart', () => {
  const ctx = mk({
    's_2026-11-09_mo': { date: '2026-11-09', day: 'mo', sets: { pistol: [set(6, 12.5)] } },
    's_2026-11-16_mo': { date: '2026-11-16', day: 'mo', sets: { pistol: [set(6, 15)] } },
  });
  const html = training.render({ area: 'training', view: 'ex', ex: 'pistol' }, ctx);
  assert.match(html, /Höchstgewicht/);
  assert.match(html, /class="chart"/);
});
test('header highlights the active tab', () => {
  const h = training.header({ area: 'training', view: 'hist' });
  assert.match(h, /href="#training\/verlauf" class="on"/);
});
test('reload picks up sessions written by a backup import', () => {
  const ctx = mk();
  ctx.store.set('train.sess', { 's_2026-11-23_mo': { date: '2026-11-23', day: 'mo', sets: { pistol: [set(6, 15)] } } });
  training.reload(ctx);
  assert.equal(training.todaySummary(ctx).done, 1);
});

const TUE = new Date(2026, 10, 24, 17, 0);
const stale = (dataset, extra = {}) => ({ target: { dataset, value: '6', closest: () => ({ dataset }), ...extra } });
test('a stale tap for an exercise not in today\'s plan writes nothing', () => {
  const ctx = mk();
  ctx.now = () => TUE;
  assert.doesNotThrow(() => training.onClick(stale({ a: 'chk', e: 'pistol', i: '0', b: '0' }), { area: 'training', view: 'day', day: null }, ctx));
  training.onInput(stale({ f: 'v', e: 'pistol', i: '0' }), { area: 'training', view: 'day', day: null }, ctx);
  assert.equal(Object.keys(ctx.store.get('train.sess', {})).length, 0);
});
test('sessions without sets do not crash the summary', () => {
  const ctx = mk({ 's_2026-11-23_mo': { date: '2026-11-23', day: 'mo' } });
  assert.deepEqual(training.todaySummary(ctx), { name: 'Lower A', type: 'kraft', done: 0, total: 23 });
});
