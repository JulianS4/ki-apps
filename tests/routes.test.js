import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../js/core/routes.js';

const cases = [
  ['', { area: 'cockpit' }],
  ['#', { area: 'cockpit' }],
  ['#heute', { area: 'heute' }],
  ['#training', { area: 'training', view: 'day', day: null }],
  ['#training/mo', { area: 'training', view: 'day', day: 'mo' }],
  ['#training/verlauf', { area: 'training', view: 'hist' }],
  ['#training/x-pistol', { area: 'training', view: 'ex', ex: 'pistol' }],
  ['#einstellungen', { area: 'settings' }],
  ['#mo', { area: 'training', view: 'day', day: 'mo' }],
  ['#verlauf', { area: 'training', view: 'hist' }],
  ['#x-pistol', { area: 'training', view: 'ex', ex: 'pistol' }],
  ['#mehr', { area: 'cockpit' }],
  ['#quatsch', { area: 'cockpit' }],
  ['#training/zz', { area: 'training', view: 'day', day: null }],
  ['#recovery', { area: 'recovery', view: 'today' }],
  ['#recovery/woche', { area: 'recovery', view: 'week' }],
  ['#recovery/zyklus', { area: 'recovery', view: 'cycle' }],
  ['#recovery/mobility', { area: 'recovery', view: 'mobility' }],
  ['#recovery/atmung', { area: 'recovery', view: 'breath', min: 2 }],
  ['#recovery/atmung?5', { area: 'recovery', view: 'breath', min: 5 }],
  ['#recovery/atmung?2', { area: 'recovery', view: 'breath', min: 2 }],
  ['#recovery/atmung?abc', { area: 'recovery', view: 'breath', min: 2 }],
  ['#recovery/quatsch', { area: 'recovery', view: 'today' }],
  ['#ernaehrung', { area: 'food', view: 'today' }],
  ['#ernaehrung/gerichte', { area: 'food', view: 'dishes' }],
  ['#ernaehrung/einkauf', { area: 'food', view: 'shop' }],
  ['#ernaehrung/quatsch', { area: 'food', view: 'today' }],
  ['#routinen', { area: 'routines', view: 'today' }],
  ['#routinen/grandpa', { area: 'routines', view: 'grandpa' }],
  ['#routinen/halterung', { area: 'routines', view: 'holder' }],
  ['#routinen/quatsch', { area: 'routines', view: 'today' }],
];
for (const [hash, want] of cases) {
  test(`parseRoute(${JSON.stringify(hash)})`, () => assert.deepEqual(parseRoute(hash), want));
}

test('body routes', () => {
  assert.deepEqual(parseRoute('#koerper'), { area: 'body', view: 'overview' });
  assert.deepEqual(parseRoute('#koerper/verlauf'), { area: 'body', view: 'history' });
  assert.deepEqual(parseRoute('#koerper/fotos'), { area: 'body', view: 'photos' });
  assert.deepEqual(parseRoute('#koerper/messung?2026-11-20'), { area: 'body', view: 'entry', date: '2026-11-20' });
  assert.deepEqual(parseRoute('#koerper/messung?quatsch'), { area: 'body', view: 'entry', date: null });
  assert.deepEqual(parseRoute('#koerper/xyz'), { area: 'body', view: 'overview' });
});

test('arena routes', () => {
  assert.deepEqual(parseRoute('#arena'), { area: 'arena', view: 'today' });
  assert.deepEqual(parseRoute('#arena/woche'), { area: 'arena', view: 'week' });
  assert.deepEqual(parseRoute('#arena/verlauf'), { area: 'arena', view: 'history' });
  assert.deepEqual(parseRoute('#arena/einladung?abc_-1'), { area: 'arena', view: 'invite', token: 'abc_-1' });
});
