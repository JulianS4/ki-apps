// Findings from the Life OS review, each pinned by a test that failed first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { parseRoute } from '../js/core/routes.js';
import { memBackend } from './helpers.js';
import * as L from '../js/areas/cockpit/logic.js';
import * as db from '../js/areas/cockpit/db.js';
import * as home from '../js/areas/cockpit/home.js';
import * as finance from '../js/areas/cockpit/finance.js';
import * as projects from '../js/areas/cockpit/projects.js';
import * as settings from '../js/areas/settings.js';
import { chartState, chartChange } from '../js/areas/cockpit/charts.js';
import { banner } from '../js/areas/cockpit/ui.js';

const mk = () => {
  const ctx = { store: createStore(memBackend()), now: () => new Date(2026, 10, 26, 9, 0), rerender() { ctx.redrawn = (ctx.redrawn || 0) + 1; }, toast() {}, go() {} };
  finance.onNavigate(null, ctx);
  projects.onNavigate(null, ctx);
  return ctx;
};

test('every Finanzen tab opens its own page', () => {
  const html = finance.render({ area: 'finance', view: 'overview' }, mk());
  const hrefs = [...html.matchAll(/<nav class="csub"[\s\S]*?<\/nav>/g)][0][0].match(/href="([^"]+)"/g).map(h => h.slice(6, -1));
  assert.deepEqual(hrefs.map(h => parseRoute(h).view), ['overview', 'tx', 'costs', 'subs', 'invest']);
});

test('without an account the first action opens the account form', () => {
  const ctx = mk();
  const r = { area: 'finance', view: 'tx' };
  const html = finance.render(r, ctx);
  assert.match(html, /data-a="fnew" data-s="account"[^>]*>Zuerst ein Konto hinzufügen</);
  finance.onClick({ target: { closest: () => ({ dataset: { a: 'fnew', s: 'account', title: 'Zuerst ein Konto hinzufügen' } }) } }, r, ctx);
  assert.match(finance.render(r, ctx), /<h3>Zuerst ein Konto hinzufügen<\/h3>/);
  assert.match(home.render({ area: 'cockpit' }, ctx), /data-a="fnew" data-s="account"/);
});

test('Uygar (arena only) sees no Life OS data sections in the settings', () => {
  const ctx = mk();
  ctx.store.set('arena.conn', { cfg: { apiKey: 'a', authDomain: 'b', projectId: 'c', appId: 'd' }, code: 'C'.repeat(22), player: 'uygar', key: 'U'.repeat(32) });
  const html = settings.render({ area: 'settings' }, ctx);
  assert.doesNotMatch(html, /Integrationen|Einträge löschen|Beispieldaten ansehen/);
  assert.match(html, /Arena/);
});

test('with only foreign-currency accounts the overview never shows NaN', () => {
  const ctx = mk();
  db.upsert(ctx, 'account', { name: 'US', type: 'giro', cur: 'USD', bal: 100, asOf: '2026-11-20' });
  assert.doesNotMatch(home.render({ area: 'cockpit' }, ctx), /NaN/);
});

test('a free range is limited to ten years', () => {
  assert.equal(L.periodRange('frei', '2026-11-26', { from: '0001-01-01', to: '2026-11-26' }), null);
  assert.ok(L.periodRange('frei', '2026-11-26', { from: '2017-01-01', to: '2026-11-26' }));
});

test('typing a date does not throw focus out of the field', () => {
  let blurred = 0;
  globalThis.document = { activeElement: { blur() { blurred++; } }, body: {}, getElementById: () => null };
  try {
    const ctx = mk();
    chartState('tx').per = 'frei';
    finance.onChange({ target: { dataset: { a: 'pdate', chart: 'tx', k: 'from' }, value: '2026-11-01' } }, { area: 'finance', view: 'tx' }, ctx);
    assert.equal(chartState('tx').from, '2026-11-01');
    assert.equal(blurred, 0);
    assert.equal(ctx.redrawn, 1);
    assert.equal(chartChange({ dataset: {} }), false);
  } finally { delete globalThis.document; }
});

test('the Business Log chart explains its empty marks', () => {
  const ctx = mk();
  db.upsert(ctx, 'log', { d: '2026-11-20', proj: 'sensito', text: 'Verkauf', min: 90, inc: 10000, exp: 0 });
  assert.match(projects.render({ area: 'projects', view: 'log' }, ctx), /„–“ = keine Einträge in diesem Abschnitt/);
});

test('the example banner names what is invented', () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-26');
  assert.doesNotMatch(banner(ctx), /Alles hier ist erfunden/);
  assert.match(banner(ctx), /Finanzen, Arbeit &amp; Lernen, Aufgaben &amp; Projekte, Agents, Säulen und Wissen/);
});
