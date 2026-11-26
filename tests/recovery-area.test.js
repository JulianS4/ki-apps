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

const WEEK = { area: 'recovery', view: 'week' };
const CYCLE = { area: 'recovery', view: 'cycle' };
const input = (dataset, value) => ({ target: { dataset, value } });

test("weekly check belongs to this week's sunday", () => {
  const ctx = mk(WED);
  recovery.onClick(click({ a: 'wk', k: 'ziel', n: '4' }), WEEK, ctx);
  recovery.onInput(input({ a: 'wkt', k: 'gut' }, 'Alle Einheiten geschafft'), WEEK, ctx);
  assert.equal(ctx.store.get('rec.weekly')['2026-11-29'].ziel, 4);
  assert.equal(ctx.store.get('rec.weekly')['2026-11-29'].gut, 'Alle Einheiten geschafft');
  ctx.now = () => new Date(2026, 10, 30, 8, 0);
  recovery.onClick(click({ a: 'wk', k: 'ziel', n: '2' }), WEEK, ctx);
  assert.equal(ctx.store.get('rec.weekly')['2026-12-06'].ziel, 2);
  assert.equal(ctx.store.get('rec.weekly')['2026-11-29'].ziel, 4);
  assert.match(recovery.render(WEEK, ctx), /Alle Einheiten geschafft/);
});

test('week view lists recent morning checks', () => {
  const ctx = mk(WED);
  ctx.store.set('rec.morning', { '2026-11-24': { schlaf: 2, energie: 2, muskeln: 3, bed: '23:15', wake: '06:00', puls: null } });
  const html = recovery.render(WEEK, ctx);
  assert.match(html, /Di 24\.11\./);
  assert.match(html, /7 von 15/);
  assert.match(html, /6,75 h/);
});

test('cycle view marks week 6 and the next deload', () => {
  const html = recovery.render(CYCLE, mk(WED));
  assert.match(html, /Woche 6/);
  assert.match(html, /30\.11\./);
  assert.match(html, /data-a="deload"/);
});

test('starting a deload now makes this week the deload week', () => {
  const ctx = mk(WED);
  recovery.onClick(click({ a: 'deload' }), CYCLE, ctx);
  assert.equal(ctx.store.get('rec.cycle'), null);
  recovery.onClick(click({ a: 'deload' }), CYCLE, ctx);
  assert.equal(ctx.store.get('rec.cycle').anchor, '2026-11-30');
  assert.equal(recovery.summary(ctx).cycle.deload, true);
  assert.match(recovery.render(CYCLE, ctx), /Sätze halbieren/);
});

test('manual deload signs are stored for this week', () => {
  const ctx = mk(WED);
  recovery.onChange(change({ a: 'flag', k: 'leistung' }, { checked: true }), CYCLE, ctx);
  assert.deepEqual(ctx.store.get('rec.flags'), { '2026-11-23': { leistung: true } });
});

test('adding and resolving a complaint', () => {
  const ctx = mk(WED);
  recovery.onInput(input({ a: 'cf', k: 'place' }, 'Knie links'), CYCLE, ctx);
  recovery.onClick(click({ a: 'clv', n: '3' }), CYCLE, ctx);
  recovery.onClick(click({ a: 'cadd' }), CYCLE, ctx);
  const list = ctx.store.get('rec.complaints');
  assert.equal(list.length, 1);
  assert.equal(list[0].place, 'Knie links');
  assert.equal(list[0].level, 3);
  assert.equal(list[0].start, '2026-11-25');
  assert.equal(list[0].resolved, null);
  assert.match(recovery.render(CYCLE, ctx), /Knie links/);
  recovery.onClick(click({ a: 'cres', id: list[0].id }), CYCLE, ctx);
  assert.equal(ctx.store.get('rec.complaints')[0].resolved, '2026-11-25');
});

test('a complaint needs a body part', () => {
  const ctx = mk(WED);
  recovery.onClick(click({ a: 'cadd' }), CYCLE, ctx);
  assert.equal(ctx.store.get('rec.complaints'), null);
});

test('a broken cycle anchor from a backup falls back to the notion anchor', () => {
  for (const bad of ['30.11.2026', '2026-11-3', 123, '2026-13-45']) {
    const ctx = mk(WED);
    ctx.store.set('rec.cycle', { anchor: bad });
    assert.equal(recovery.summary(ctx).cycle.week, 6, String(bad));
    assert.doesNotThrow(() => recovery.render(TODAY, ctx));
    assert.doesNotThrow(() => recovery.render(CYCLE, ctx));
  }
});

test('no "Deload vorziehen?" during the deload week', () => {
  const ctx = mk(WED);
  const red = { schlaf: 2, energie: 3, muskeln: 3, bed: '21:30', wake: '06:00', puls: null };
  ctx.store.set('rec.morning', { '2026-11-20': red, '2026-11-24': red });
  ctx.store.set('rec.flags', { '2026-11-23': { leistung: true } });
  assert.equal(recovery.summary(ctx).suggest, true);
  ctx.store.set('rec.cycle', { anchor: '2026-11-30' });
  assert.equal(recovery.summary(ctx).suggest, false);
  assert.doesNotMatch(recovery.render(TODAY, ctx), /Deload vorziehen\?<\/b>/);
  assert.doesNotMatch(recovery.render(CYCLE, ctx), /empfohlen|Zieh den Deload vor/);
});

test('a complaint can start on an earlier day', () => {
  const ctx = mk(WED);
  assert.match(recovery.render(CYCLE, ctx), /data-k="start"/);
  recovery.onInput(input({ a: 'cf', k: 'place' }, 'Achillessehne'), CYCLE, ctx);
  recovery.onInput(input({ a: 'cf', k: 'start' }, '2026-11-21'), CYCLE, ctx);
  recovery.onClick(click({ a: 'clv', n: '2' }), CYCLE, ctx);
  recovery.onClick(click({ a: 'cadd' }), CYCLE, ctx);
  assert.equal(ctx.store.get('rec.complaints')[0].start, '2026-11-21');
  assert.equal(recovery.summary(ctx).suggest, false);
  assert.match(recovery.render(CYCLE, ctx), /seit 4 Tagen/);
  recovery.onInput(input({ a: 'cf', k: 'start' }, 'gestern'), CYCLE, ctx);
  recovery.onInput(input({ a: 'cf', k: 'place' }, 'Knie'), CYCLE, ctx);
  recovery.onClick(click({ a: 'clv', n: '2' }), CYCLE, ctx);
  recovery.onClick(click({ a: 'cadd' }), CYCLE, ctx);
  assert.equal(ctx.store.get('rec.complaints')[1].start, '2026-11-25');
});
