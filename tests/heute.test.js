import test from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../js/areas/heute.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const MON_1630 = new Date(2026, 10, 23, 16, 30);
const ctx = (store = createStore(memBackend()), now = MON_1630) => ({ store, now: () => now });

test('heute shows now and next from the week routine', () => {
  const html = render({ area: 'heute' }, ctx());
  assert.match(html, /Lower A Training/);
  assert.match(html, /17:45/);
});
test('heute asks for a first backup', () => {
  const html = render({ area: 'heute' }, ctx());
  assert.match(html, /Noch kein Backup/);
  assert.match(html, /href="#einstellungen"/);
});
test('heute hides backup card when recent', () => {
  const s = createStore(memBackend());
  s.set('meta.lastBackup', '2026-11-20');
  assert.doesNotMatch(render({ area: 'heute' }, ctx(s)), /Backup/);
});
test('heute warns about an old backup', () => {
  const s = createStore(memBackend());
  s.set('meta.lastBackup', '2026-11-01');
  assert.match(render({ area: 'heute' }, ctx(s)), /Letztes Backup vor 22 Tagen/);
});
test("heute shows today's training with set progress", () => {
  const s = createStore(memBackend());
  s.set('train.sess', { 's_2026-11-23_mo': { date: '2026-11-23', day: 'mo', sets: { pistol: [{ v: '6', ok: true }] } } });
  const html = render({ area: 'heute' }, ctx(s));
  assert.match(html, /href="#training"/);
  assert.match(html, /Lower A/);
  assert.match(html, /1\/23 Sätze/);
});
test('heute on sunday shows the rest day', () => {
  assert.match(render({ area: 'heute' }, ctx(undefined, new Date(2026, 10, 29, 10, 0))), /Ruhetag/);
});

test('heute asks for the morning check', () => {
  const html = render({ area: 'heute' }, ctx());
  assert.match(html, /Morgen-Check offen/);
  assert.match(html, /href="#recovery"/);
  assert.doesNotMatch(html, /class="amp /);
});
test('heute shows the ampel once checked', () => {
  const s = createStore(memBackend());
  s.set('rec.morning', { '2026-11-23': { schlaf: 4, energie: 5, muskeln: 4, bed: '21:30', wake: '06:00', puls: null } });
  const html = render({ area: 'heute' }, ctx(s));
  assert.match(html, /class="amp gruen"/);
  assert.match(html, /Grün/);
  assert.match(html, /13 von 15/);
  assert.doesNotMatch(html, /Morgen-Check offen/);
});
test('heute shows the cycle line', () => {
  assert.match(render({ area: 'heute' }, ctx()), /Woche 6 · Peak · RIR 1/);
});
test('heute shows the deload rules in the deload week', () => {
  const s = createStore(memBackend());
  s.set('rec.cycle', { anchor: '2026-11-30' });
  const html = render({ area: 'heute' }, ctx(s));
  assert.match(html, /Deload-Woche/);
  assert.match(html, /Sätze halbieren/);
});
test('recovery tile and coming-soon line', () => {
  const s = createStore(memBackend());
  let html = render({ area: 'heute' }, ctx(s));
  assert.match(html, /<a class="tile" href="#recovery">[\s\S]*?Mobility B · Lower[\s\S]*?offen<\/span><\/a>/);
  assert.doesNotMatch(html.match(/Kommt bald[^<]*/)[0], /Recovery/);
  s.set('rec.mobility', { '2026-11-23': { done: true } });
  html = render({ area: 'heute' }, ctx(s));
  assert.match(html, /✓ erledigt/);
});
