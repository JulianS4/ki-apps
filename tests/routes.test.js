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
];
for (const [hash, want] of cases) {
  test(`parseRoute(${JSON.stringify(hash)})`, () => assert.deepEqual(parseRoute(hash), want));
}
