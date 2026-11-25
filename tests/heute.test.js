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
