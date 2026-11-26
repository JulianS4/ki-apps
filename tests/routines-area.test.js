import test from 'node:test';
import assert from 'node:assert/strict';
import * as rout from '../js/areas/routines/index.js';
import * as food from '../js/areas/food/index.js';
import { runOf } from '../js/core/guided.js';
import { EVENING } from '../js/areas/routines/data.js';
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

const HOLD = { area: 'routines', view: 'holder' };
test('holder shows the current step', () => {
  const html = rout.render(HOLD, mk(at(6, 7)));
  assert.match(html, /Anziehen → Chinese Grandpa Routine im Tageslicht/);
  assert.match(html, /06:05–06:10/);
  assert.match(html, /Danach: Toilette/);
  assert.match(html, /Morgenroutine/);
});

test('holder between routines shows the next one', () => {
  assert.match(rout.render(HOLD, mk(at(21, 15, 27))), /Nächste Routine: Abendroutine um 21:30/);
  const late = rout.render(HOLD, mk(at(22, 0)));
  assert.match(late, /Morgenroutine/);
  assert.match(late, /Fr 06:00/);
});

// ---- final review fixes ----
test('pack list stays open while ticking', () => {
  const ctx = mk();
  assert.doesNotMatch(rout.render(TODAY, ctx), /pk2" open/);
  rout.onClick(click({ a: 'open', k: 'pack' }), TODAY, ctx);
  rout.onChange(change({ a: 'pack', id: 'handy' }, { checked: true }), TODAY, ctx);
  assert.match(rout.render(TODAY, ctx), /<details class="ses pk2" open>/);
  rout.onNavigate({ area: 'food', view: 'today' }, ctx);
  assert.doesNotMatch(rout.render(TODAY, ctx), /pk2" open/);
});

test('yesterday evening can be ticked step by step', () => {
  const ctx = mk(at(7, 0));
  assert.match(rout.render(TODAY, ctx), /data-k="abend" data-d="2026-11-25" data-id="mobility"/);
  rout.onChange(change({ a: 'step', k: 'abend', d: '2026-11-25', id: 'mobility' }, { checked: true }), TODAY, ctx);
  rout.onChange(change({ a: 'step', k: 'abend', d: '2026-11-25', id: 'shutdown' }, { checked: true }), TODAY, ctx);
  assert.deepEqual(ctx.store.get('rec.mobility'), { '2026-11-25': { done: true } });
  assert.deepEqual(rout.summaryFor(ctx, '2026-11-25').abend, { done: 2, total: 7 });
  assert.deepEqual(rout.summary(ctx).abend, { done: 0, total: 7 });
  assert.match(rout.render(TODAY, ctx), /Gestern Abend 2\/7/);
  rout.onClick(click({ a: 'open', k: 'yest' }), TODAY, ctx);
  assert.match(rout.render(TODAY, ctx), /<details class="yd" open>/);
});

test('a tick for a day other than today or yesterday is ignored', () => {
  const ctx = mk(at(7, 0));
  rout.onChange(change({ a: 'step', k: 'abend', d: '2026-11-20', id: 'shutdown' }, { checked: true }), TODAY, ctx);
  assert.equal(rout.summaryFor(ctx, '2026-11-20').abend.done, 0);
  assert.equal(rout.summary(ctx).abend.done, 0);
});

test('evening supplements step works without evening supplements', () => {
  const ctx = mk();
  ctx.store.set('food.supps', [{ id: 'omega', group: 'morgens', name: 'Omega' }]);
  step(ctx, 'abend', 'lesen');
  assert.equal(rout.summary(ctx).abend.done, 1);
  assert.match(rout.render(TODAY, ctx), /data-id="lesen" checked/);
  step(ctx, 'abend', 'lesen', false);
  assert.equal(rout.summary(ctx).abend.done, 0);
  rout.onClick(click({ a: 'all', k: 'abend' }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).abend, { done: 7, total: 7 });
});

// ---- edited lists ----
test('edited lists drive today, summary and holder', () => {
  const ctx = mk(at(6, 7));
  ctx.store.set('rout.steps', { morgen: [
    { id: 'wecker', from: '06:00', title: 'Aufstehen' },
    { id: 'grandpa', from: '06:05', to: '06:10', title: 'Grandpa draußen', link: 'grandpa' },
    { id: 'tasche', from: '06:55', to: '07:00', title: 'Tasche', link: 'pack' },
  ] });
  ctx.store.set('rout.pack', [{ cat: 'Tasche', items: [{ id: 'buch', name: 'Buch' }] }]);
  const html = rout.render(TODAY, ctx);
  assert.match(html, /Aufstehen/);
  assert.match(html, /Packliste 0\/1/);
  assert.deepEqual(rout.summary(ctx).morgen, { done: 0, total: 3 });
  assert.deepEqual(rout.summary(ctx).abend, { done: 0, total: 7 });
  assert.match(rout.render(HOLD, ctx), /Grandpa draußen/);
  rout.onClick(click({ a: 'all', k: 'morgen' }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).morgen, { done: 3, total: 3 });
});

test('malformed stored lists fall back to Notion', () => {
  for (const bad of ['x', [], { morgen: [] }, { morgen: [{ id: 1 }], abend: 'x' }]) {
    const ctx = mk();
    ctx.store.set('rout.steps', bad);
    ctx.store.set('rout.pack', bad);
    assert.doesNotThrow(() => rout.render(TODAY, ctx));
    assert.doesNotThrow(() => rout.render(HOLD, ctx));
    assert.deepEqual(rout.summary(ctx), { morgen: { done: 0, total: 10 }, abend: { done: 0, total: 7 } });
    assert.match(rout.render(TODAY, ctx), /Packliste 0\/15/);
  }
});

test('a deleted mobility step is no longer set by everything done', () => {
  const ctx = mk();
  ctx.store.set('rout.steps', { abend: EVENING.filter(s => s.id !== 'mobility') });
  rout.onClick(click({ a: 'all', k: 'abend' }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).abend, { done: 6, total: 6 });
  assert.equal(ctx.store.get('rec.mobility'), null);
});

// ---- edit mode ----
const edit = (ctx, k = 'morgen') => rout.onClick(click({ a: 'redit', k }), TODAY, ctx);
const base = (ctx, k = 'morgen') => rout.steps(ctx)[k];

test('edit mode shows base times, titles and the tools', () => {
  const ctx = mk(at(8, 0, 28)); // Samstag: Anzeige 07:10, bearbeitet wird die Grundzeit
  assert.match(rout.render(TODAY, ctx), /data-a="redit" data-k="morgen"/);
  edit(ctx);
  const html = rout.render(TODAY, ctx);
  assert.match(html, /data-a="rfrom" data-k="morgen" data-id="toilette" value="06:10"/);
  assert.match(html, /data-a="rto" data-k="morgen" data-id="toilette" value="06:20"/);
  assert.match(html, /data-a="rt" data-k="morgen" data-id="toilette" value="Toilette"/);
  assert.match(html, /data-a="pn" data-cat="Essentials" data-id="handy" value="Handy"/);
  assert.match(html, /\+ Schritt/);
  assert.match(html, /Fertig mit Bearbeiten/);
  assert.match(html, /Auf Notion-Stand zurücksetzen/);
  assert.match(html, /Sa\/So automatisch \+1 h/);
  assert.doesNotMatch(html, /data-a="rt" data-k="abend"/);
  rout.onNavigate({ area: 'food', view: 'today' }, ctx);
  assert.doesNotMatch(rout.render(TODAY, ctx), /data-a="rt"/);
});

test('renaming a step keeps its tick and its link', () => {
  const ctx = mk();
  step(ctx, 'morgen', 'toilette');
  edit(ctx);
  rout.onInput(change({ a: 'rt', k: 'morgen', id: 'toilette' }, { value: 'Klo' }), TODAY, ctx);
  rout.onInput(change({ a: 'rt', k: 'abend', id: 'mobility' }, { value: 'Dehnen' }), TODAY, ctx);
  assert.equal(base(ctx).find(s => s.id === 'toilette').title, 'Klo');
  assert.deepEqual(rout.summary(ctx).morgen, { done: 1, total: 10 });
  step(ctx, 'abend', 'mobility');
  assert.deepEqual(ctx.store.get('rec.mobility')['2026-11-26'], { done: true });
});

test('changing a time re-sorts and still shifts on weekends', () => {
  const ctx = mk();
  let now = at(6, 7);
  ctx.now = () => now;
  edit(ctx);
  rout.onChange(change({ a: 'rfrom', k: 'morgen', id: 'toilette' }, { value: '05:50' }), TODAY, ctx);
  assert.equal(base(ctx)[0].id, 'toilette');
  rout.onChange(change({ a: 'rto', k: 'morgen', id: 'toilette' }, { value: '05:40' }), TODAY, ctx);
  assert.equal(base(ctx)[0].to, '06:20');
  rout.onChange(change({ a: 'rto', k: 'morgen', id: 'toilette' }, { value: '' }), TODAY, ctx);
  assert.equal('to' in base(ctx)[0], false);
  rout.onChange(change({ a: 'rfrom', k: 'morgen', id: 'toilette' }, { value: 'quatsch' }), TODAY, ctx);
  assert.equal(base(ctx)[0].from, '05:50');
  now = at(8, 0, 28);
  edit(ctx);
  assert.match(rout.render(TODAY, ctx), /ab 06:50/);
});

test('adding and deleting steps', () => {
  const ctx = mk();
  edit(ctx);
  rout.onClick(click({ a: 'radd', k: 'morgen' }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).morgen, { done: 0, total: 11 });
  const added = base(ctx).find(s => s.title === 'Neuer Schritt');
  assert.equal(added.from, '07:00');
  rout.onClick(click({ a: 'rdel', k: 'morgen', id: added.id }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).morgen, { done: 0, total: 10 });
  ctx.store.set('rout.steps', { morgen: [{ id: 'x', from: '06:00', title: 'Nur einer' }] });
  rout.onClick(click({ a: 'rdel', k: 'morgen', id: 'x' }), TODAY, ctx);
  assert.equal(base(ctx).length, 1);
  assert.doesNotMatch(rout.render(TODAY, ctx), /data-a="rdel" data-k="morgen"/);
});

test('pack items can be renamed, removed and added', () => {
  const ctx = mk();
  edit(ctx);
  rout.onInput(change({ a: 'pn', cat: 'Essentials', id: 'handy' }, { value: 'iPhone' }), TODAY, ctx);
  rout.onClick(click({ a: 'pdel', cat: 'Essentials', id: 'airpods' }), TODAY, ctx);
  rout.onClick(click({ a: 'padd', cat: 'Tasche' }), TODAY, ctx);
  edit(ctx);
  const html = rout.render(TODAY, ctx);
  assert.match(html, /iPhone/);
  assert.match(html, /Neuer Gegenstand/);
  assert.match(html, /Packliste 0\/15/);
  assert.doesNotMatch(html, /data-id="airpods"/);
});

test('reset restores Notion after two taps', () => {
  const ctx = mk();
  edit(ctx);
  rout.onClick(click({ a: 'radd', k: 'abend' }), TODAY, ctx);
  rout.onClick(click({ a: 'pdel', cat: 'Essentials', id: 'handy' }), TODAY, ctx);
  rout.onClick(click({ a: 'rreset' }), TODAY, ctx);
  assert.match(rout.render(TODAY, ctx), /Sicher\? Nochmal tippen/);
  assert.equal(rout.summary(ctx).abend.total, 8);
  rout.onClick(click({ a: 'rreset' }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx), { morgen: { done: 0, total: 10 }, abend: { done: 0, total: 7 } });
  assert.match(rout.render(TODAY, ctx), /Packliste 0\/15/);
  assert.doesNotMatch(rout.render(TODAY, ctx), /data-a="rt"/);
});
