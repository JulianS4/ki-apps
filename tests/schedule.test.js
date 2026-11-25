import test from 'node:test';
import assert from 'node:assert/strict';
import { nowNext } from '../js/core/schedule.js';

const at = (day, h, m) => nowNext(new Date(2026, 10, day, h, m));

test('Mo 16:30 is Lower A training', () => {
  const r = at(23, 16, 30);
  assert.equal(r.now.title, 'Lower A Training');
  assert.equal(r.next.start, '17:45');
});
test('Mo 05:30 is still Sunday night sleep', () => {
  const r = at(30, 5, 30);
  assert.equal(r.now.title, 'Schlafen');
  assert.equal(r.next.title, 'Morgenroutine');
  assert.equal(r.next.start, '06:00');
});
test('Sa 07:30 is the late morning routine', () => {
  const r = at(28, 7, 30);
  assert.equal(r.now.title, 'Morgenroutine');
  assert.equal(r.next.start, '08:00');
});
test('Fr 22:00 is the late evening routine', () => {
  const r = at(27, 22, 0);
  assert.equal(r.now.title, 'Abendroutine');
  assert.equal(r.next.title, 'Schlafen');
  assert.equal(r.next.start, '22:30');
});
test('So 11:45 falls into a gap', () => {
  const r = at(29, 11, 45);
  assert.equal(r.now, null);
  assert.equal(r.next.title, 'Sonntag Routine');
  assert.equal(r.next.start, '12:00');
});
test('Mi 23:00 sleeps, next is Thursday morning', () => {
  const r = at(25, 23, 0);
  assert.equal(r.now.title, 'Schlafen');
  assert.equal(r.next.title, 'Morgenroutine');
  assert.equal(r.next.day, 'do');
});
