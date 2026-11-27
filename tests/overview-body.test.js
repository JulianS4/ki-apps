// The overview carries what the former "Training & Erholung" page showed: today's training,
// nutrition, recovery and body as tiles, and their hints under "Jetzt wichtig".
import test from 'node:test';
import assert from 'node:assert/strict';
import * as home from '../js/areas/cockpit/home.js';
import { setFoodSummary, foodSummary as foodSummaryDefault, setBodySummary, bodySummary as bodySummaryDefault } from '../js/areas/heute.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const MON_1630 = new Date(2026, 10, 23, 16, 30);
const ctx = (store = createStore(memBackend()), now = MON_1630) => ({ store, now: () => now, rerender() {}, toast() {}, go() {} });
const page = c => { home.onNavigate(null, c); return home.render({ area: 'cockpit' }, c); };
const widget = (html, k) => (html.split(`data-w="${k}"`)[1] || '').split('<section class="w ')[0];

test('now and next from the week routine sit under "Jetzt wichtig"', () => {
  assert.match(widget(page(ctx()), 'agenda'), /Jetzt: Lower A Training[\s\S]*bis 17:45/);
});
test('backup: asked for first, quiet when recent, warned when old', () => {
  assert.match(widget(page(ctx()), 'agenda'), /Noch kein Backup[\s\S]*?href|href="#einstellungen"/);
  const s = createStore(memBackend());
  s.set('meta.lastBackup', '2026-11-20');
  assert.doesNotMatch(page(ctx(s)), /Backup/);
  s.set('meta.lastBackup', '2026-11-01');
  assert.match(page(ctx(s)), /Letztes Backup vor 22 Tagen/);
});
test("the training tile shows today's sets, the rest day and the cycle", () => {
  const s = createStore(memBackend());
  s.set('train.sess', { 's_2026-11-23_mo': { date: '2026-11-23', day: 'mo', sets: { pistol: [{ v: '6', ok: true }] } } });
  const w = widget(page(ctx(s)), 'train');
  assert.match(w, /<a class="wgo" href="#training">/);
  assert.match(w, /Lower A/);
  assert.match(w, /1\/23 Sätze/);
  assert.match(w, /Woche 6 · Peak · RIR 1/);
  assert.match(widget(page(ctx(undefined, new Date(2026, 10, 29, 10, 0))), 'train'), /Ruhetag/);
});
test('the recovery tile: morning check open or done, mobility, routines, the deload week', () => {
  const s = createStore(memBackend());
  let w = widget(page(ctx(s)), 'recovery');
  assert.match(w, /href="#recovery"/);
  assert.match(w, /Morgen-Check offen/);
  assert.match(w, /Mobility B · Lower offen/);
  assert.match(w, /Morgen 0\/10[\s\S]*Abend 0\/7/);
  s.set('rec.morning', { '2026-11-23': { schlaf: 4, energie: 5, muskeln: 4, bed: '21:30', wake: '06:00', puls: null } });
  s.set('rec.mobility', { '2026-11-23': { done: true } });
  s.set('rout.days', { '2026-11-23': { morgen: { wecker: true, toilette: true, mund: true } } });
  w = widget(page(ctx(s)), 'recovery');
  assert.match(w, /13 von 15 · Grün/);
  assert.doesNotMatch(w, /Morgen-Check offen/);
  assert.match(w, /✓ erledigt/);
  assert.match(w, /Morgen 3\/10/);
  const d = createStore(memBackend());
  d.set('rec.cycle', { anchor: '2026-11-30' });
  const html = page(ctx(d));
  assert.match(widget(html, 'recovery'), /Sätze halbieren/);
  assert.match(widget(html, 'agenda'), /Deload-Woche/);
});
const meal = (t, g, slot) => ({ id: 'm' + t, name: 'x', g, slot, t });
test('the nutrition tile: protein and water against their goals', () => {
  const s = createStore(memBackend());
  s.set('body.weight', { '2026-11-20': 85 });
  s.set('food.days', { '2026-11-23': { meals: [meal('07:00', 45, 'fr')], water: 1000, supps: { omega: true } } });
  const w = widget(page(ctx(s)), 'food');
  assert.match(w, /href="#ernaehrung"/);
  assert.match(w, /Protein 45 \/ 170 g/);
  assert.match(w, /Wasser 1,0 \/ 3,5 L/);
  assert.match(w, /Mittags 0\/1/);
  assert.match(widget(page(ctx()), 'food'), /Protein 0 g · Ziel fehlt/);
  assert.doesNotMatch(page(ctx()), /NaN/);
});
test('nutrition hints: snack before training, dinner after, mealprep on Wednesday', () => {
  const s = createStore(memBackend());
  s.set('food.days', { '2026-11-26': { meals: [meal('12:00', 30, 'mi')] } });
  assert.match(widget(page(ctx(s, new Date(2026, 10, 26, 14, 30))), 'agenda'), /Kohlenhydrat-Snack/);
  assert.doesNotMatch(page(ctx(s, new Date(2026, 10, 26, 11, 0))), /Kohlenhydrat-Snack/);
  assert.match(widget(page(ctx(undefined, new Date(2026, 10, 26, 18, 0))), 'agenda'), /30–40 g Protein/);
  assert.match(widget(page(ctx(undefined, new Date(2026, 10, 25, 10, 0))), 'agenda'), /Heute Mealprep/);
  assert.doesNotMatch(page(ctx(undefined, new Date(2026, 10, 26, 10, 0))), /Heute Mealprep/);
});
test('the health tile shows the latest weight and the distance to 90; the quarter check stays under "Jetzt wichtig" until done', () => {
  const s = createStore(memBackend());
  s.set('body.weight', { '2026-11-20': 92.4 });
  const w = widget(page(ctx(s)), 'health');
  assert.match(w, /href="#koerper"/);
  assert.match(w, /92,4 kg/);
  assert.match(w, /2,4 kg bis 90/);
  assert.match(widget(page(ctx()), 'health'), /Gewicht fehlt/);
  assert.match(widget(page(ctx()), 'agenda'), /Quartals-Check fällig · 0\/8/);
  s.set('body.quarter', { '2026-Q4': Object.fromEntries(['weight', 'photos', 'measures', 'mob', 'run5k', 'plan', 'pain', 'hang'].map(k => [k, true])) });
  assert.doesNotMatch(widget(page(ctx(s)), 'agenda'), /Quartals-Check/);
});
test('one broken area never blanks the overview', () => {
  const s = createStore(memBackend());
  s.set('food.supps', [null]);
  assert.doesNotThrow(() => page(ctx(s)));
  const food = foodSummaryDefault, body = bodySummaryDefault;
  setFoodSummary(() => { throw new Error('boom'); });
  setBodySummary(() => { throw new Error('x'); });
  try {
    const html = page(ctx());
    assert.match(widget(html, 'train'), /Lower A/);
    assert.match(widget(html, 'food'), /Keine Daten/);
    assert.match(widget(html, 'health'), /Keine Daten/);
  } finally {
    setFoodSummary(food);
    setBodySummary(body);
  }
});
test('a free task due today shows up under "Jetzt wichtig"', async () => {
  const db = await import('../js/areas/cockpit/db.js');
  const c = ctx();
  db.upsert(c, 'task', { text: 'Steuer machen', due: '2026-11-23', done: false });
  assert.match(widget(page(c), 'agenda'), /href="#aufgaben"[\s\S]*Steuer machen/);
});
