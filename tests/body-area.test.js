import test from 'node:test';
import assert from 'node:assert/strict';
import * as body from '../js/areas/body/index.js';
import * as food from '../js/areas/food/index.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const at = (h, m, d = 26, mo = 10) => new Date(2026, mo, d, h, m);
const OV = { area: 'body', view: 'overview' }, HIST = { area: 'body', view: 'history' }, PH = { area: 'body', view: 'photos' };
const ENTRY = (date = null) => ({ area: 'body', view: 'entry', date });
const mk = (now = at(9, 0)) => {
  const store = createStore(memBackend());
  const ctx = { store, now: () => now, status: '', setStatus(t) { ctx.status = t; }, toast() {}, rerender() {}, go(h) { ctx.went = h; }, prevHash: null };
  body.reload(ctx);
  body.onNavigate(OV, ctx);
  return ctx;
};
const click = dataset => ({ target: { closest: () => ({ dataset }) } });
const fill = (ctx, values, route = ENTRY()) => { for (const [k, v] of Object.entries(values)) body.onInput({ target: { dataset: { a: 'bf', k }, value: v } }, route, ctx); };
const tick = (ctx, id, checked) => body.onChange({ target: { dataset: { a: 'qtick', id }, checked } }, OV, ctx);

test('entry saves weight and values for the day', () => {
  const ctx = mk();
  body.render(ENTRY(), ctx);
  fill(ctx, { kg: '92,4', fat: '14,5', taille: '84', run5k: '23:45', mob: 'Hüfte steif' });
  body.onClick(click({ a: 'bsave' }), ENTRY(), ctx);
  assert.deepEqual(ctx.store.get('body.weight'), { '2026-11-26': 92.4 });
  assert.deepEqual(ctx.store.get('body.log'), { '2026-11-26': { fat: 14.5, taille: 84, run5k: 1425, mob: 'Hüfte steif' } });
  assert.equal(ctx.went, '#koerper/verlauf');
  assert.equal(food.weight(ctx).kg, 92.4);
});

test('an invalid field saves nothing and names the field', () => {
  const ctx = mk();
  body.render(ENTRY(), ctx);
  fill(ctx, { kg: '92', fat: '80' });
  body.onClick(click({ a: 'bsave' }), ENTRY(), ctx);
  assert.equal(ctx.store.get('body.weight'), null);
  assert.equal(ctx.store.get('body.log'), null);
  assert.match(body.render(ENTRY(), ctx), /class="err"[^>]*>Körperfett: 3–60 %/);
});

test('a cleared field deletes only that value', () => {
  const ctx = mk();
  ctx.store.set('body.weight', { '2026-11-26': 92 });
  ctx.store.set('body.log', { '2026-11-26': { fat: 15, taille: 84 } });
  assert.match(body.render(ENTRY(), ctx), /data-a="bf" data-k="fat"[^>]*value="15"/);
  fill(ctx, { fat: '' });
  body.onClick(click({ a: 'bsave' }), ENTRY(), ctx);
  assert.deepEqual(ctx.store.get('body.log'), { '2026-11-26': { taille: 84 } });
  assert.deepEqual(ctx.store.get('body.weight'), { '2026-11-26': 92 });
});

test('an older day opens prefilled, a future day falls back to today', () => {
  const ctx = mk();
  ctx.store.set('body.weight', { '2026-11-20': 93 });
  ctx.store.set('body.log', { '2026-11-20': { run5k: 1425 } });
  const html = body.render(ENTRY('2026-11-20'), ctx);
  assert.match(html, /data-a="bf" data-k="kg"[^>]*value="93"/);
  assert.match(html, /data-a="bf" data-k="run5k"[^>]*value="23:45"/);
  assert.match(body.render(ENTRY('2026-12-01'), ctx), /data-a="bdate"[^>]*value="2026-11-26"/);
});

test('deleting a measurement day takes two taps and removes the weight too', () => {
  const ctx = mk();
  ctx.store.set('body.weight', { '2026-11-01': 93, '2026-11-20': 92 });
  ctx.store.set('body.log', { '2026-11-20': { fat: 15 } });
  assert.match(body.render(HIST, ctx), /href="#koerper\/messung\?2026-11-20"/);
  body.onClick(click({ a: 'bdel', d: '2026-11-20' }), HIST, ctx);
  assert.match(body.render(HIST, ctx), /Sicher\? Nochmal tippen/);
  assert.equal(ctx.store.get('body.weight')['2026-11-20'], 92);
  body.onClick(click({ a: 'bdel', d: '2026-11-20' }), HIST, ctx);
  assert.deepEqual(ctx.store.get('body.weight'), { '2026-11-01': 93 });
  assert.deepEqual(ctx.store.get('body.log'), {});
  assert.equal(food.weight(ctx).kg, 93);
});

test('quarter check: automatic items and hand ticks', () => {
  const ctx = mk();
  ctx.store.set('body.weight', { '2026-10-05': 92 });
  const html = body.render(OV, ctx);
  assert.match(html, /Quartals-Check/);
  assert.match(html, /1\/8/);
  assert.match(html, /data-a="qtick" data-id="weight" checked/);
  assert.match(html, /\(automatisch\)/);
  assert.match(html, /href="#recovery"/);
  tick(ctx, 'plan', true);
  assert.deepEqual(ctx.store.get('body.quarter'), { '2026-Q4': { plan: true } });
  tick(ctx, 'weight', false);
  assert.deepEqual(body.summary(ctx).quarter, { q: '2026-Q4', done: 2, total: 8 });
  for (const id of ['photos', 'measures', 'mob', 'run5k', 'pain', 'hang']) tick(ctx, id, true);
  assert.match(body.render(OV, ctx), /Quartals-Check Q4 erledigt ✓/);
});

test('summary gives the latest weight and the quarter', () => {
  const ctx = mk();
  assert.deepEqual(body.summary(ctx), { kg: null, quarter: { q: '2026-Q4', done: 0, total: 8 } });
  ctx.store.set('body.weight', { '2026-11-01': 93, '2026-11-20': 92.4 });
  assert.deepEqual(body.summary(ctx).kg, { date: '2026-11-20', y: 92.4 });
  assert.match(body.render(OV, ctx), /2,4 kg bis 90/);
});

test('malformed body data never crashes', () => {
  for (const bad of ['x', [], 5, { '2026-11-20': 'x' }, { nope: { fat: 1 } }]) {
    const ctx = mk();
    for (const k of ['body.weight', 'body.log', 'body.quarter', 'body.photos']) ctx.store.set(k, bad);
    for (const r of [OV, HIST, ENTRY(), PH]) assert.doesNotThrow(() => body.render(r, ctx), JSON.stringify(bad));
    assert.doesNotThrow(() => body.summary(ctx));
    tick(ctx, 'plan', true);
    body.render(ENTRY(), ctx);
    fill(ctx, { kg: '90' });
    body.onClick(click({ a: 'bsave' }), ENTRY(), ctx);
    assert.equal(ctx.store.get('body.weight')['2026-11-26'], 90, JSON.stringify(bad));
  }
});

test('header highlights the tab', () => {
  assert.match(body.header({ area: 'body', view: 'history' }), /href="#koerper\/verlauf" class="on"/);
  assert.match(body.header(ENTRY()), /href="#koerper" class="on"/);
});
