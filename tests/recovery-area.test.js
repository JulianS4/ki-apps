import test from 'node:test';
import assert from 'node:assert/strict';
import * as recovery from '../js/areas/recovery/index.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const MON = new Date(2026, 10, 23, 8, 0);
const WED = new Date(2026, 10, 25, 8, 0);
const TODAY = { area: 'recovery', view: 'today' };
const mk = (now = MON) => {
  const store = createStore(memBackend());
  const ctx = { store, now: () => now, setStatus() {}, toast() {}, rerender() {}, go() {}, prevHash: null };
  recovery.reload(ctx);
  return ctx;
};
// Minimal stand-ins for the delegated DOM events the shell passes on.
const click = dataset => ({ target: { closest: () => ({ dataset }) } });
const change = (dataset, extra = {}) => ({ target: { dataset, ...extra } });
const score = (ctx, k, n) => recovery.onClick(click({ a: 'mc', k, n: String(n) }), TODAY, ctx);

test('today view shows the three scales and planned bed times', () => {
  const html = recovery.render(TODAY, mk());
  assert.match(html, /data-k="muskeln"/);
  assert.match(html, /value="21:30"/);
  assert.match(html, /value="06:00"/);
  assert.doesNotMatch(html, /class="amp /);
});

test('scoring the morning check stores it and shows the ampel', () => {
  const ctx = mk();
  score(ctx, 'schlaf', 4);
  score(ctx, 'energie', 4);
  assert.doesNotMatch(recovery.render(TODAY, ctx), /class="amp /);
  score(ctx, 'muskeln', 4);
  const e = ctx.store.get('rec.morning')['2026-11-23'];
  assert.equal(e.schlaf, 4);
  assert.equal(e.energie, 4);
  assert.equal(e.muskeln, 4);
  assert.equal(e.bed, '21:30');
  const html = recovery.render(TODAY, ctx);
  assert.match(html, /class="amp gruen"/);
  assert.match(html, /Training wie geplant/);
});

test('a changed bedtime and pulse are stored for today', () => {
  const ctx = mk();
  recovery.onChange(change({ a: 'bed' }, { value: '23:15' }), TODAY, ctx);
  recovery.onChange(change({ a: 'puls' }, { value: '52' }), TODAY, ctx);
  const e = ctx.store.get('rec.morning')['2026-11-23'];
  assert.equal(e.bed, '23:15');
  assert.equal(e.wake, '06:00');
  assert.equal(e.puls, 52);
  assert.match(recovery.render(TODAY, ctx), /value="23:15"/);
  recovery.onChange(change({ a: 'puls' }, { value: '' }), TODAY, ctx);
  assert.equal(ctx.store.get('rec.morning')['2026-11-23'].puls, null);
});

test('today view shows lower mobility on monday', () => {
  assert.match(recovery.render(TODAY, mk()), /Routine B · Lower · 15 min/);
});

test('mobility done is stored per day', () => {
  const ctx = mk();
  recovery.onChange(change({ a: 'mobdone' }, { checked: true }), TODAY, ctx);
  assert.deepEqual(ctx.store.get('rec.mobility')['2026-11-23'], { done: true });
  recovery.onChange(change({ a: 'mobdone' }, { checked: false }), TODAY, ctx);
  assert.equal(ctx.store.get('rec.mobility')['2026-11-23'], undefined);
});

test('no block on monday, block on wednesday', () => {
  assert.doesNotMatch(recovery.render(TODAY, mk()), /Recovery-Block/);
  const ctx = mk(WED);
  assert.match(recovery.render(TODAY, ctx), /Mealprep/);
  recovery.onChange(change({ a: 'blk', i: '1' }, { checked: true }), TODAY, ctx);
  assert.deepEqual(ctx.store.get('rec.blocks')['2026-11-25'], { 1: true });
});

test('summary reports ampel, mobility and cycle', () => {
  const ctx = mk();
  score(ctx, 'schlaf', 4);
  score(ctx, 'energie', 4);
  score(ctx, 'muskeln', 4);
  const s = recovery.summary(ctx);
  assert.equal(s.ampel.key, 'gruen');
  assert.equal(s.sum, 12);
  assert.equal(s.mobility.routine, 'B');
  assert.equal(s.mobility.done, false);
  assert.equal(s.cycle.week, 6);
  assert.equal(s.suggest, false);
});

test('header highlights the active tab', () => {
  assert.match(recovery.header({ area: 'recovery', view: 'cycle' }), /href="#recovery\/zyklus" class="on"/);
});

const MOB = { area: 'recovery', view: 'mobility' };
test('mobility view shows the first step before it starts', () => {
  const html = recovery.render(MOB, mk());
  assert.match(html, /Deep Squat Hold/);
  assert.match(html, /Als Nächstes: Couch Stretch/);
  assert.match(html, /1:30/);
  assert.match(html, /15:00/);
  assert.match(html, /data-a="tstart"/);
});

test('saturday mobility runs 20 minutes', () => {
  assert.match(recovery.render(MOB, mk(new Date(2026, 10, 28, 8, 0))), /20:00/);
});

test('breath view uses the chosen minutes', () => {
  const html = recovery.render({ area: 'recovery', view: 'breath', min: 5 }, mk());
  assert.match(html, /5:00/);
  assert.match(html, /Box-Breathing · 5 min/);
});

test('a running mobility follows the real clock and marks the day when done', t => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const ctx = mk();
  recovery.onClick(click({ a: 'tstart' }), MOB, ctx);
  now += 575_000;
  const mid = recovery.render(MOB, ctx);
  assert.match(mid, /Pigeon Stretch/);
  assert.match(mid, /1:55/);
  assert.equal(ctx.store.get('rec.mobility'), null);
  now += 400_000;
  recovery.mount(null, MOB, ctx);
  assert.deepEqual(ctx.store.get('rec.mobility')['2026-11-23'], { done: true });
  assert.match(recovery.render(MOB, ctx), /Geschafft ✓/);
  recovery.onNavigate({ area: 'heute' });
});

test('leaving a running timer stops it without marking the day', t => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const ctx = mk();
  recovery.onClick(click({ a: 'tstart' }), MOB, ctx);
  now += 300_000;
  recovery.onNavigate({ area: 'heute' });
  assert.equal(ctx.store.get('rec.mobility'), null);
  assert.match(recovery.render(MOB, ctx), /data-a="tstart"/);
});
