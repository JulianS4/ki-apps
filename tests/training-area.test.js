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

const DAY = { area: 'training', view: 'day', day: null };
const SUN = { area: 'training', view: 'day', day: 'so' };

test('no ampel banner without a complete check', () => {
  assert.doesNotMatch(training.render(DAY, mk()), /class="amp/);
  const ctx = mk();
  ctx.store.set('rec.morning', { '2026-11-23': { schlaf: 2, energie: 2 } });
  assert.doesNotMatch(training.render(DAY, ctx), /class="amp/);
});

test("yellow check shows the advice on today's training", () => {
  const ctx = mk();
  ctx.store.set('rec.morning', { '2026-11-23': { schlaf: 3, energie: 3, muskeln: 4 } });
  const html = training.render(DAY, ctx);
  assert.match(html, /class="amp gelb"/);
  assert.match(html, /1 Wdh mehr im Tank/);
});

test('cycle line in the hero', () => {
  assert.match(training.render(DAY, mk()), /Woche 6 · RIR 1/);
});

test('mobility is a link to recovery', () => {
  const ctx = mk();
  let html = training.render(DAY, ctx);
  assert.match(html, /href="#recovery"/);
  assert.match(html, /Routine B/);
  assert.match(html, /<span class="s">offen/);
  assert.doesNotMatch(html, /data-a="mob"/);
  ctx.store.set('rec.mobility', { '2026-11-23': { done: true } });
  html = training.render(DAY, ctx);
  assert.match(html, /<span class="s">erledigt/);
});

test('sunday links to the weekly check', () => {
  const ctx = mk();
  const html = training.render(SUN, ctx);
  assert.match(html, /href="#recovery\/woche"/);
  assert.doesNotMatch(html, /data-a="scale"/);
  assert.doesNotMatch(html, /href="#training\/so" class="[^"]*done/);
  ctx.store.set('rec.weekly', { '2026-11-29': { schlaf: 4, energie: 4, gelenke: 4, ziel: 4, gut: '', next: '' } });
  assert.match(training.render(SUN, ctx), /href="#training\/so" class="[^"]*done/);
});

// The rest timer and toasts touch the page; a tiny stand-in is enough here.
function withPage(t) {
  const el = { className: '', innerHTML: '', classList: { add() {}, remove() {}, contains: () => false } };
  globalThis.document = { querySelector: () => el, getElementById: () => null };
  t.after(() => { delete globalThis.document; });
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
}
const tick = (ctx, e) => training.onClick({ target: { closest: () => ({ dataset: { a: 'chk', e, i: '0', b: '0' } }) } }, DAY, ctx);
const heavier = ctx => training.onInput({ target: { dataset: { f: 'w', e: 'pistol', i: '0' }, value: '20' } }, DAY, ctx);
const lastWeek = { 's_2026-11-16_mo': { date: '2026-11-16', day: 'mo', sets: { pistol: [set(6, 15)] } } };

test('a record set shows a toast outside the deload week', t => {
  withPage(t);
  const ctx = mk(lastWeek);
  ctx.toast = t.mock.fn();
  heavier(ctx);
  tick(ctx, 'pistol');
  assert.equal(ctx.toast.mock.callCount(), 1);
});

test('deload week shows the rules and silences record toasts', t => {
  withPage(t);
  const ctx = mk(lastWeek);
  ctx.store.set('rec.cycle', { anchor: '2026-11-30' });
  const html = training.render(DAY, ctx);
  assert.match(html, /Deload-Woche/);
  assert.match(html, /Sätze halbieren/);
  ctx.toast = t.mock.fn();
  heavier(ctx);
  tick(ctx, 'pistol');
  assert.equal(ctx.toast.mock.callCount(), 0);
  assert.equal(ctx.store.get('train.sess')['s_2026-11-23_mo'].sets.pistol[0].ok, true);
});

test("a previewed day shows its own mobility routine without today's status", () => {
  const ctx = mk();
  ctx.store.set('rec.mobility', { '2026-11-23': { done: true } });
  const html = training.render({ area: 'training', view: 'day', day: 'sa' }, ctx);
  assert.match(html, /Routine B · Lower · 20 min<\/span><span class="s">›</);
  assert.doesNotMatch(html, /<span class="s">erledigt/);
  assert.match(training.render({ area: 'training', view: 'day', day: 'so' }, ctx), /Routine A · Upper · 15 min/);
});
