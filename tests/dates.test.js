import test from 'node:test';
import assert from 'node:assert/strict';
import { ds, dayIdx, monday, addDays, dfmt, dshort, DAYS, DN } from '../js/core/dates.js';

test('ds formats local date', () => assert.equal(ds(new Date(2026, 10, 25, 8)), '2026-11-25'));
test('dayIdx monday-based', () => assert.equal(dayIdx(new Date(2026, 10, 25)), 2));
test('monday of wed and sun', () => {
  assert.equal(ds(monday(new Date(2026, 10, 25))), '2026-11-23');
  assert.equal(ds(monday(new Date(2026, 10, 29))), '2026-11-23');
});
test('addDays across month, year and DST', () => {
  assert.equal(addDays('2026-11-30', -1), '2026-11-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-10-24', 1), '2026-10-25');
  assert.equal(addDays('2027-03-27', 1), '2027-03-28');
});
test('dfmt and dshort', () => {
  assert.equal(dfmt('2026-11-25'), 'Mi 25.11.');
  assert.equal(dshort('2026-01-05'), '5.1.');
});
test('DAYS and DN', () => {
  assert.deepEqual(DAYS, ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']);
  assert.equal(DN.so, 'So');
});
