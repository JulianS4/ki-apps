import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../js/core/routes.js';

const cases = [
  ['', { area: 'heute' }],
  ['#', { area: 'heute' }],
  ['#heute', { area: 'heute' }],
  ['#training', { area: 'training', view: 'day', day: null }],
  ['#training/mo', { area: 'training', view: 'day', day: 'mo' }],
  ['#training/verlauf', { area: 'training', view: 'hist' }],
  ['#training/x-pistol', { area: 'training', view: 'ex', ex: 'pistol' }],
  ['#einstellungen', { area: 'settings' }],
  ['#mo', { area: 'training', view: 'day', day: 'mo' }],
  ['#verlauf', { area: 'training', view: 'hist' }],
  ['#x-pistol', { area: 'training', view: 'ex', ex: 'pistol' }],
  ['#mehr', { area: 'heute' }],
  ['#quatsch', { area: 'heute' }],
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
];
for (const [hash, want] of cases) {
  test(`parseRoute(${JSON.stringify(hash)})`, () => assert.deepEqual(parseRoute(hash), want));
}
