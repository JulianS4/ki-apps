import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';
import { parseItem, toDraft, cleanItem } from '../js/areas/cockpit/schema.js';
import * as db from '../js/areas/cockpit/db.js';
import * as finance from '../js/areas/cockpit/finance.js';

const mk = () => {
  const ctx = { store: createStore(memBackend()), now: () => new Date(2026, 10, 26, 9, 0), rerender() {}, toast(t) { ctx.toasted = t; }, go() {} };
  finance.onNavigate(null, ctx);
  return ctx;
};
const click = dataset => ({ target: { closest: () => ({ dataset }) } });
const typed = (dataset, value) => ({ target: { dataset, value } });

test('a transaction is typed as Ausgabe or Einnahme with a plain amount', () => {
  const base = { d: '2026-11-26', acc: 'g' };
  assert.equal(parseItem('tx', { ...base, dir: 'aus', amt: '12,50' }).item.amt, -1250);
  assert.equal(parseItem('tx', { ...base, dir: 'ein', amt: '12,50' }).item.amt, 1250);
  assert.equal('dir' in parseItem('tx', { ...base, dir: 'ein', amt: '1' }).item, false);
  assert.match(parseItem('tx', { ...base, dir: 'aus', amt: '-5' }).errors.amt, /ohne Minus/);
  assert.deepEqual([toDraft('tx', { amt: -1250 }).dir, toDraft('tx', { amt: -1250 }).amt], ['aus', '12,50']);
  assert.equal(toDraft('tx', { amt: 900 }).dir, 'ein');
  const c = cleanItem('tx', { id: 't', d: '2026-11-26', amt: -1250, acc: 'g' });
  assert.equal(c.amt, -1250);
  assert.equal('dir' in c, false);
});

test('"Ausgabe hinzufügen" opens a form titled that way and saves a negative amount', () => {
  const ctx = mk();
  db.upsert(ctx, 'account', { id: 'g', name: 'Giro', type: 'giro', cur: 'EUR', bal: 1, asOf: '2026-11-26' });
  const r = { area: 'finance', view: 'tx' };
  assert.match(finance.render(r, ctx), /data-a="fnew" data-s="tx"[^>]*>Ausgabe hinzufügen</);
  finance.onClick(click({ a: 'fnew', s: 'tx', title: 'Ausgabe hinzufügen', preset: '{"dir":"aus"}' }), r, ctx);
  const html = finance.render(r, ctx);
  assert.match(html, /<h3>Ausgabe hinzufügen<\/h3>/);
  assert.match(html, /class="fgh full">Zuordnung</);
  for (const [f, v] of Object.entries({ amt: '7,90', payee: 'Kino', acc: 'g' })) finance.onInput(typed({ f }, v), r, ctx);
  finance.onClick(click({ a: 'fsave' }), r, ctx);
  assert.deepEqual(db.list(ctx, 'tx').map(t => [t.amt, t.payee]), [[-790, 'Kino']]);
  assert.equal(ctx.toasted, 'Gespeichert');
});

test('finance has four tabs and old addresses land in the right one', () => {
  const ctx = mk();
  const html = finance.render({ area: 'finance', view: 'overview' }, ctx);
  assert.deepEqual([...html.matchAll(/<a href="#finanzen[^"]*"[^>]*>([^<]+)<\/a>/g)].map(m => m[1]).filter(t => ['Übersicht', 'Buchungen', 'Ausgaben & Budget', 'Ausgaben &amp; Budget', 'Abos'].includes(t)).length, 4);
  assert.match(html, /Wie entwickeln sich Einnahmen, Ausgaben und Zurückgelegtes\?/);
  assert.match(html, /Konto hinzufügen/);
});
