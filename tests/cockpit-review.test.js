// Findings from the final review, each pinned by a test that failed first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { buildBackup, importBackup } from '../js/core/backup.js';
import { memBackend } from './helpers.js';
import { cleanItem } from '../js/areas/cockpit/schema.js';
import * as L from '../js/areas/cockpit/logic.js';
import * as db from '../js/areas/cockpit/db.js';
import * as home from '../js/areas/cockpit/home.js';
import * as finance from '../js/areas/cockpit/finance.js';
import * as integrations from '../js/areas/cockpit/integrations.js';
import * as school from '../js/areas/cockpit/school.js';
import * as notes from '../js/areas/cockpit/notes.js';

const mk = () => {
  const ctx = { store: createStore(memBackend()), now: () => new Date(2026, 10, 26, 9, 0), rerender() {}, toast() {}, go() {} };
  for (const a of [home, finance, integrations, school, notes]) a.onNavigate(null, ctx);
  return ctx;
};
const click = dataset => ({ target: { closest: () => ({ dataset }) } });
const typed = (dataset, value, extra = {}) => ({ target: { dataset, value, ...extra } });

test('ids that could break out of an attribute are refused', () => {
  assert.equal(cleanItem('project', { id: '"><img src=x onerror=alert(1)>', name: 'X' }), null);
  assert.ok(cleanItem('project', { id: 'personal-brand', name: 'X' }));
  assert.ok(cleanItem('tx', { id: 'bsp-tx0', d: '2026-11-01', amt: 1, acc: 'g' }));
});

test('a file exported in example mode is not taken into real data', () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-26');
  const out = JSON.parse(JSON.stringify(db.exportData(ctx, 'x')));
  db.endDemo(ctx);
  assert.throws(() => db.importData(ctx, out, 'demo.json', '2026-11-26'), /Beispielmodus/);
  assert.deepEqual(db.budgets(ctx), {});
});

test('entering an older balance keeps the newest one as the current balance', () => {
  const ctx = mk();
  const a = db.upsert(ctx, 'account', { name: 'Giro', type: 'giro', cur: 'EUR', bal: 100000, asOf: '2026-11-26' });
  db.upsert(ctx, 'account', { ...a, bal: 80000, asOf: '2026-10-26' });
  const b = db.find(ctx, 'account', a.id);
  assert.equal(b.bal, 100000);
  assert.equal(b.asOf, '2026-11-26');
  assert.deepEqual(b.hist, [{ d: '2026-10-26', c: 80000 }, { d: '2026-11-26', c: 100000 }]);
});

const ING = 'Umsatzanzeige;Datei erstellt am: 26.11.2026 10:00\n\nIBAN;DE00 0000 0000 0000 0000 00\nKontoname;Girokonto\n\nBuchung;Valuta;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung\n03.11.2026;03.11.2026;Bäcker;Lastschrift;Brötchen;100,00;EUR;-4,50;EUR\n';

test('CSV files with lines above the column names are read from the real header', () => {
  const rows = L.parseCsv(ING), h = L.findHeader(rows);
  assert.deepEqual(rows[h].slice(0, 3), ['Buchung', 'Valuta', 'Auftraggeber/Empfänger']);
  assert.deepEqual(L.guessMap(rows[h]), { date: 0, amount: 7, payee: 2, purpose: 4 });
  const ctx = mk();
  db.upsert(ctx, 'account', { id: 'g', name: 'Giro', type: 'giro', cur: 'EUR', bal: 1, asOf: '2026-11-26' });
  finance.csvLoad(ctx, ING, 'ing.csv');
  assert.match(finance.csvSection(ctx), /ing\.csv · 1 Zeile\b/);
  finance.onChange(typed({ a: 'csvacc' }, 'g'), { area: 'finance', view: 'tx' }, ctx);
  finance.onClick(click({ a: 'csvgo' }), { area: 'finance', view: 'tx' }, ctx);
  assert.deepEqual(db.list(ctx, 'tx').map(t => [t.d, t.amt, t.payee]), [['2026-11-03', -450, 'Bäcker']]);
});

test('a full storage is reported, not announced as a finished import', () => {
  const ctx = mk();
  db.upsert(ctx, 'account', { id: 'g', name: 'Giro', type: 'giro', cur: 'EUR', bal: 1, asOf: '2026-11-26' });
  const real = ctx.store.set.bind(ctx.store);
  ctx.store.set = (k, v) => (k === 'cx.tx' || k === 'cx.exams' ? false : real(k, v));
  finance.csvLoad(ctx, 'Datum;Betrag\n03.11.2026;-4,50\n', 'a.csv');
  finance.onChange(typed({ a: 'csvacc' }, 'g'), { area: 'finance', view: 'tx' }, ctx);
  finance.onClick(click({ a: 'csvgo' }), { area: 'finance', view: 'tx' }, ctx);
  const html = finance.csvSection(ctx);
  assert.match(html, /Speichern nicht möglich/);
  assert.doesNotMatch(html, /Import fertig/);
  assert.deepEqual(db.list(ctx, 'import'), []);
  assert.throws(() => db.importData(ctx, { app: 'ki-cockpit', v: 1, data: { exams: [{ id: 'e', subj: 'A', d: '2026-12-01' }] } }, 'f.json', '2026-11-26'), /Speichern nicht möglich/);
});

test('totals built from CSV imports say when the last import was', () => {
  const ctx = mk();
  db.upsert(ctx, 'account', { id: 'g', name: 'Giro', type: 'giro', cur: 'EUR', bal: 1, asOf: '2026-11-26' });
  db.setRaw(ctx, 'tx', [{ id: 't1', d: '2026-11-03', amt: -450, payee: 'Bäcker', cat: '', acc: 'g', note: '', src: 'csv' }]);
  db.upsert(ctx, 'import', { kind: 'csv', file: 'a.csv', at: '2026-11-24', n: 1, acc: 'g' });
  for (const html of [finance.render({ area: 'finance', view: 'tx' }, ctx), finance.render({ area: 'finance', view: 'overview' }, ctx), finance.render({ area: 'finance', view: 'costs' }, ctx), home.render({ area: 'cockpit' }, ctx)]) {
    assert.match(html, /letzter CSV-Import 24\.11\. · evtl\. nicht aktuell/);
  }
});

test('in example mode nothing can be imported', () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-26');
  const fin = finance.csvSection(ctx);
  assert.match(fin, /Im Beispielmodus ist kein Import möglich/);
  assert.doesNotMatch(fin, /id="csvf"/);
  const set = integrations.render({ area: 'integrations' }, ctx);
  assert.doesNotMatch(set, /id="jsonf"/);
});

test('ticking a task or switching a filter lets go of the focused control', () => {
  let blurred = 0;
  const el = { blur() { blurred++; } };
  globalThis.document = { activeElement: el, body: {}, getElementById: () => null };
  try {
    const ctx = mk();
    const t = db.upsert(ctx, 'stask', { subj: 'BWL', text: 'Lesen', done: false });
    school.onChange({ target: { dataset: { a: 'tick', s: 'stask', id: t.id }, checked: true } }, { area: 'school', view: 'overview' }, ctx);
    assert.equal(db.find(ctx, 'stask', t.id).done, true);
    assert.equal(blurred, 1);
    notes.onClick(click({ a: 'ntopic', v: 'ki' }), { area: 'notes', view: 'list' }, ctx);
    assert.equal(blurred, 2);
  } finally { delete globalThis.document; }
});

test('the example-mode switch is neither backed up nor restored', () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-26');
  assert.equal('cx.demo' in buildBackup(ctx.store, 'x').data, false);
  const other = mk();
  importBackup({ app: 'ki-apps', v: 1, data: { 'cx.demo': true, 'cx.exams': [] } }, other.store);
  assert.equal(db.isDemo(other), false);
});
