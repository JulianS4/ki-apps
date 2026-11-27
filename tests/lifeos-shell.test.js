import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../js/core/routes.js';
import { navKey, sideNav, bottomNav, moreList, NAV, GROUPS } from '../js/areas/cockpit/nav.js';

test('Life OS opens on the overview; old addresses still work', () => {
  assert.deepEqual(parseRoute(''), { area: 'cockpit' });
  assert.deepEqual(parseRoute('#uebersicht'), { area: 'cockpit' });
  assert.deepEqual(parseRoute('#cockpit'), { area: 'cockpit' });
  assert.deepEqual(parseRoute('#heute'), { area: 'cockpit' });
  assert.deepEqual(parseRoute('#business-log'), { area: 'projects', view: 'log' });
  assert.deepEqual(parseRoute('#projekte/log'), { area: 'projects', view: 'log' });
  assert.deepEqual(parseRoute('#integrationen'), { area: 'settings' });
  assert.deepEqual(parseRoute('#mo'), { area: 'training', view: 'day', day: 'mo' });
});

test('the new areas have their own addresses, and the new names have aliases', () => {
  assert.deepEqual(parseRoute('#aufgaben'), { area: 'projects', view: 'tasks' });
  assert.deepEqual(parseRoute('#kalender'), { area: 'calendar', week: null });
  assert.deepEqual(parseRoute('#kalender/2026-11-30'), { area: 'calendar', week: '2026-11-30' });
  assert.deepEqual(parseRoute('#kalender/kaputt'), { area: 'calendar', week: null });
  assert.deepEqual(parseRoute('#ziele'), { area: 'goals' });
  assert.deepEqual(parseRoute('#finanzen/investments'), { area: 'finance', view: 'invest' });
  assert.deepEqual(parseRoute('#arbeit'), { area: 'school', view: 'overview' });
  assert.deepEqual(parseRoute('#gesundheit'), { area: 'body', view: 'overview' });
  assert.deepEqual(parseRoute('#gesundheit/verlauf'), { area: 'body', view: 'history' });
});

test('the navigation names the areas in groups and marks where you are', () => {
  assert.deepEqual(NAV.map(n => n[2]), ['Übersicht', 'Aufgaben & Projekte', 'Kalender & Routinen', 'Ziele & Rückblicke', 'Finanzen & Investments', 'Arbeit & Lernen',
    'Ernährung', 'Gesundheit', 'Training', 'Recovery', 'Arena', 'Wissen', 'KI-Agents']);
  assert.deepEqual(GROUPS.map(g => g[0]), ['', 'Planen', 'Geld & Arbeit', 'Körper', 'Kopf & KI']);
  const keys = { projects: 'tasks', routines: 'calendar', calendar: 'calendar', goals: 'goals', body: 'health', food: 'food', training: 'training', recovery: 'recovery', arena: 'arena', school: 'school', settings: 'settings', notes: 'notes' };
  for (const [area, key] of Object.entries(keys)) assert.equal(navKey({ area, view: 'log' }), key, area);
  const side = sideNav('tasks');
  assert.match(side, /href="#aufgaben"[^>]*aria-current="page"/);
  for (const g of ['Planen', 'Geld &amp; Arbeit', 'Körper', 'Kopf &amp; KI']) assert.match(side, new RegExp(`<p class="sg">${g}</p>`));
  assert.match(side, /class="sl end"[\s\S]*Import[\s\S]*Einstellungen/);
  assert.match(side, /Life OS/);
  assert.doesNotMatch(side, /Training &amp; Erholung|Business Log/);
});

test('on the phone: Übersicht, Aufgaben, Kalender, Training, and "Mehr" carries the rest', () => {
  const b = bottomNav('cockpit');
  assert.deepEqual([...b.matchAll(/<a href="([^"]+)"/g)].map(m => m[1]), ['#uebersicht', '#aufgaben', '#kalender', '#training']);
  assert.match(b, /<span>Aufgaben<\/span>[\s\S]*<span>Kalender<\/span>/);
  assert.match(b, /data-nav="more"[^>]*aria-expanded="false"/);
  assert.match(bottomNav('agents'), /class="on"[^>]*data-nav="more"|data-nav="more"[^>]*class="on"/);
  const more = moreList('health');
  for (const l of ['Ziele', 'Finanzen', 'Arbeit', 'Ernährung', 'Gesundheit', 'Recovery', 'Arena', 'Wissen', 'KI-Agents', 'Import', 'Einstellungen']) assert.match(more, new RegExp(l));
  assert.match(more, /href="#koerper"[^>]*aria-current="page"/);
  assert.match(more, /<p class="sg">Körper<\/p>/);
});
