import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';
import * as db from '../js/areas/cockpit/db.js';
import * as home from '../js/areas/cockpit/home.js';
import * as projects from '../js/areas/cockpit/projects.js';

const mk = () => {
  const ctx = { store: createStore(memBackend()), now: () => new Date(2026, 10, 26, 9, 0), rerender() {}, toast() {}, go() {} };
  home.onNavigate(null, ctx);
  projects.onNavigate(null, ctx);
  return ctx;
};
const click = dataset => ({ target: { closest: () => ({ dataset }) } });

test('the overview puts what needs doing first, urgent items marked', () => {
  const ctx = mk();
  ctx.store.set('meta.lastBackup', '2026-11-25');
  db.upsert(ctx, 'ptask', { proj: 'sensito', text: 'Rechnung schicken', due: '2026-11-20', done: false });
  const html = home.render({ area: 'cockpit' }, ctx);
  const agenda = html.split('Jetzt wichtig')[1].split('</ul>')[0];
  assert.match(agenda, /<li class="att"><a class="rowlink" href="#projekte\/p-sensito">[\s\S]*Rechnung schicken[\s\S]*überfällig seit Fr 20\.11\./);
  assert.ok(agenda.indexOf('Rechnung schicken') < agenda.indexOf('Morgen-Check offen'));
  assert.doesNotMatch(agenda, /Backup/);
  assert.match(html, /<h1>Guten Morgen<\/h1>/);
  assert.match(html, /href="#business-log"/);
});

test('details live one tap away: every tile leads to its area', () => {
  const html = home.render({ area: 'cockpit' }, mk());
  for (const href of ['#finanzen', '#heute', '#ausbildung', '#projekte', '#business-log', '#agents', '#wissen']) assert.match(html, new RegExp(`class="wgo" href="${href}"`));
});

test('Business Log: figures, a chart by project with a measure switch, and entries', () => {
  const ctx = mk();
  db.upsert(ctx, 'log', { d: '2026-11-20', proj: 'sensito', text: 'Verkauf', min: 90, inc: 10000, exp: 2000 });
  db.upsert(ctx, 'log', { d: '2026-11-21', proj: 'reselling', text: 'Einkauf', min: 30, inc: 0, exp: 500 });
  const r = { area: 'projects', view: 'log' };
  let html = projects.render(r, ctx);
  assert.match(html, /<h1>Business Log<\/h1>/);
  assert.match(html, /Welches Projekt bringt Umsatz\?/);
  assert.match(html, /data-a="meas" data-chart="log" data-v="min"/);
  assert.match(html, /Eintrag hinzufügen/);
  projects.onClick(click({ a: 'meas', chart: 'log', v: 'min' }), r, ctx);
  html = projects.render(r, ctx);
  assert.match(html, /Wohin gehen die Stunden\?/);
  assert.match(html, /<td>1:30 h<\/td>/);
  projects.onClick(click({ a: 'per', chart: 'log', v: 'woche' }), r, ctx);
  assert.doesNotMatch(projects.render(r, ctx), /Verkauf/);
});
