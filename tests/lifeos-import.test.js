import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';
import { memBlobs } from '../js/areas/body/photos.js';
import * as db from '../js/areas/cockpit/db.js';
import { common } from '../js/areas/cockpit/ui.js';
import { readImport, planImport, applyImport } from '../js/areas/cockpit/lifeimport.js';

const mk = () => {
  const ctx = { store: createStore(memBackend()), now: () => new Date(2026, 10, 27, 20, 0), rerender() {}, toast(t, s) { ctx.toasted = [t, s]; }, go() {} };
  return ctx;
};
const FILE = () => ({
  app: 'life-os-import', v: 1, created: '2026-11-27T19:00:00.000Z',
  sources: { notion: { name: 'Notion', at: '2026-11-27T18:58:00.000Z' }, obsidian: { name: 'Obsidian · Second Brain', at: '2026-11-27T18:59:00.000Z' } },
  notion: {
    accounts: [{ id: 'na1', name: 'Girokonto', type: 'giro', cur: 'EUR', hist: [{ d: '2026-10-21', c: 120000 }] }, { id: 'na2', name: 'Tagesgeld', type: 'tagesgeld', cur: 'EUR', hist: [{ d: '2026-10-21', c: 850000 }] }],
    cats: [{ id: 'nc-essen', name: 'Essen', kind: 'ausgabe' }, { id: 'nc-etf', name: 'ETF-Sparplan', kind: 'sparen' }],
    budgets: { 'nc-essen': 25000, 'nc-etf': 30000 },
    tx: [{ id: 'nt1', d: '2026-11-03', amt: -1250, acc: 'na1', cat: 'nc-essen', payee: 'Rewe' }],
    projects: [{ id: 'np1', name: 'Sensito', status: 'aktiv', goal: 'Content planen' }, { id: 'np2', name: 'Game Dev', status: 'idee', goal: 'Prototyp' }],
    log: [{ id: 'nl1', d: '2026-11-20', proj: 'np1', text: 'Shop eingerichtet', min: 90, inc: 0, exp: 500 }],
    pillars: [{ id: 'nk1', d: '2026-11-22', week: 'KW 47', koerper: 5, karriere: 6, business: 3, fokus: 5, netzwerk: 4 }],
    notes: [{ id: 'nn1', title: 'Lebensziele', path: 'Notion/Lebensziele.md', body: '# Ziele\nSiehe [[5 Säulen des Erfolgs]]', tags: ['notion'] }],
  },
  obsidian: { vault: 'Second Brain', notes: [{ path: '02 Ziele/Ziel A.md', text: '---\ntyp: ziel\ntags: [ziel]\n---\nMehr in [[Lebensziele]]' }], skipped: [{ path: '14 Menschen', why: 'Notizen über Personen – bewusst ausgelassen', n: 7 }] },
});

test('a file is checked before anything happens: format, version, and the old Life-OS file', () => {
  assert.equal(readImport(JSON.stringify(FILE())).file.app, 'life-os-import');
  assert.throws(() => readImport('{kaputt'), /keine gültige JSON-Datei/i);
  assert.throws(() => readImport('{"app":"x"}'), /keine Life-OS-Import-Datei/);
  assert.throws(() => readImport(JSON.stringify({ ...FILE(), v: 2 })), /neuere Version/);
  assert.equal(readImport('{"app":"ki-cockpit","data":{}}').legacy.app, 'ki-cockpit');
  assert.equal(readImport('﻿' + JSON.stringify(FILE())).file.v, 1);
});

test('the preview counts what comes from each source and finds projects that already exist', () => {
  const ctx = mk(), plan = planImport(ctx, FILE());
  const row = k => plan.rows.find(r => r.k === k);
  assert.deepEqual([row('account').add, row('tx').add, row('pillar').add, row('log').add], [2, 1, 1, 1]);
  assert.deepEqual([row('project').add, row('project').update], [1, 1]);
  assert.equal(plan.budgets, 2);
  assert.equal(plan.vault.add.length, 1);
  assert.deepEqual(plan.skipped, [{ path: '14 Menschen', why: 'Notizen über Personen – bewusst ausgelassen', n: 7 }]);
  assert.equal(plan.sources.notion.at, '2026-11-27T18:58:00.000Z');
});

test('importing fills the app: accounts with their balance, budget, projects kept linked, notes from both sources', async () => {
  const ctx = mk();
  db.upsert(ctx, 'ptask', { proj: 'sensito', text: 'Feedback', done: false });
  const r = await applyImport(ctx, planImport(ctx, FILE()), memBlobs());
  assert.equal(r.notion, 10);
  const acc = db.list(ctx, 'account').find(a => a.name === 'Girokonto');
  assert.deepEqual([acc.src, acc.bal, acc.asOf], ['notion', 120000, '2026-10-21']);
  const sens = db.list(ctx, 'project').find(p => p.name === 'Sensito');
  assert.deepEqual([sens.id, sens.src, sens.status, sens.goal], ['sensito', 'notion', 'aktiv', 'Content planen']);
  assert.equal(db.list(ctx, 'ptask')[0].proj, 'sensito');
  assert.equal(db.list(ctx, 'log')[0].proj, 'sensito');
  assert.equal(db.list(ctx, 'tx')[0].acc, acc.id);
  assert.deepEqual(db.budgets(ctx), { 'nc-essen': 25000, 'nc-etf': 30000 });
  assert.ok(db.list(ctx, 'cat').some(c => c.id === 'wohnen'), 'the app categories stay');
  assert.deepEqual(db.list(ctx, 'pillar').map(p => [p.d, p.karriere, p.koerper]), [['2026-11-22', 6, 5]]);
  const notes = db.list(ctx, 'note');
  assert.deepEqual(notes.map(n => [n.title, n.src]).sort(), [['Lebensziele', 'notion'], ['Ziel A', 'vault']]);
  assert.deepEqual(db.getRaw(ctx, 'sources').notion.at, '2026-11-27T18:58:00.000Z');
  assert.deepEqual(db.list(ctx, 'import').map(i => [i.kind, i.n]), [['claude', 11]]);
});

test('importing again replaces what came from Notion and leaves your own entries alone', async () => {
  const ctx = mk();
  db.upsert(ctx, 'account', { name: 'Bargeld', type: 'bar', cur: 'EUR', bal: 2000, asOf: '2026-11-01' });
  db.upsert(ctx, 'exam', { subj: 'BWL', d: '2026-12-02', prep: 'offen' });
  ctx.store.set('train.plan', { days: [1, 2, 3, 4, 5, 6, 7] });
  await applyImport(ctx, planImport(ctx, FILE()), memBlobs());
  const f = FILE();
  f.notion.accounts = f.notion.accounts.slice(0, 1);
  f.notion.cats = f.notion.cats.slice(0, 1);
  f.notion.budgets = { 'nc-essen': 25000 };
  f.notion.notes = [];
  const plan = planImport(ctx, f);
  assert.equal(plan.rows.find(r => r.k === 'account').remove, 1);
  await applyImport(ctx, plan, memBlobs());
  assert.deepEqual(db.list(ctx, 'account').map(a => a.name).sort(), ['Bargeld', 'Girokonto']);
  assert.deepEqual(db.budgets(ctx), { 'nc-essen': 25000 });
  assert.deepEqual(db.list(ctx, 'note').map(n => n.title), ['Ziel A']);
  assert.equal(db.list(ctx, 'exam').length, 1);
  assert.deepEqual(ctx.store.get('train.plan'), { days: [1, 2, 3, 4, 5, 6, 7] });
});

test('what comes from Notion is changed in Notion: the app explains instead of opening a form', async () => {
  const ctx = mk();
  await applyImport(ctx, planImport(ctx, FILE()), memBlobs());
  const acc = db.list(ctx, 'account').find(a => a.src === 'notion');
  common({ dataset: { a: 'fedit', s: 'account', id: acc.id } }, ctx);
  assert.match(ctx.toasted.join(' '), /Notion/);
  const { ed } = await import('../js/areas/cockpit/ui.js');
  assert.equal(ed.cur, null);
});

test('no import while the examples are shown', async () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-27');
  await assert.rejects(() => applyImport(ctx, planImport(ctx, FILE()), memBlobs()), /Beispielmodus/);
});
