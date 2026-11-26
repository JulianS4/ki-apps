import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../js/core/routes.js';
import { navKey, sideNav, bottomNav, moreList, NAV } from '../js/areas/cockpit/nav.js';

test('Life OS opens on the overview; old addresses still work', () => {
  assert.deepEqual(parseRoute(''), { area: 'cockpit' });
  assert.deepEqual(parseRoute('#uebersicht'), { area: 'cockpit' });
  assert.deepEqual(parseRoute('#cockpit'), { area: 'cockpit' });
  assert.deepEqual(parseRoute('#heute'), { area: 'heute' });
  assert.deepEqual(parseRoute('#business-log'), { area: 'projects', view: 'log' });
  assert.deepEqual(parseRoute('#projekte/log'), { area: 'projects', view: 'log' });
  assert.deepEqual(parseRoute('#integrationen'), { area: 'settings' });
  assert.deepEqual(parseRoute('#mo'), { area: 'training', view: 'day', day: 'mo' });
});

test('the navigation names the eight areas and marks where you are', () => {
  assert.deepEqual(NAV.map(n => n[2]), ['Übersicht', 'Finanzen', 'Ausbildung', 'Projekte', 'Business Log', 'KI-Agents', 'Wissen', 'Training & Erholung']);
  assert.equal(navKey({ area: 'projects', view: 'log' }), 'log');
  assert.equal(navKey({ area: 'projects', view: 'list' }), 'projects');
  assert.equal(navKey({ area: 'recovery', view: 'today' }), 'health');
  assert.equal(navKey({ area: 'settings' }), 'settings');
  const side = sideNav('log');
  assert.match(side, /href="#business-log"[^>]*aria-current="page"/);
  assert.match(side, /Einstellungen/);
  assert.match(side, /Life OS/);
  assert.doesNotMatch(side, /Cockpit/);
});

test('on the phone: four areas, and "Mehr" carries the rest and shows when one of them is open', () => {
  const b = bottomNav('cockpit');
  assert.equal((b.match(/<a /g) || []).length, 4);
  assert.match(b, /data-nav="more"[^>]*aria-expanded="false"/);
  assert.match(bottomNav('agents'), /class="on"[^>]*data-nav="more"|data-nav="more"[^>]*class="on"/);
  const more = moreList('agents');
  for (const l of ['Projekte', 'Business Log', 'KI-Agents', 'Wissen', 'Einstellungen']) assert.match(more, new RegExp(l));
  assert.match(more, /href="#agents"[^>]*aria-current="page"/);
});
