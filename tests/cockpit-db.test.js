import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { buildBackup, importBackup } from '../js/core/backup.js';
import { memBackend } from './helpers.js';
import { parseItem, cleanItem, toDraft, SCHEMAS } from '../js/areas/cockpit/schema.js';
import * as db from '../js/areas/cockpit/db.js';
import { demoData } from '../js/areas/cockpit/data.js';

const mk = () => ({ store: createStore(memBackend()), now: () => new Date(2026, 10, 26, 9, 0) });

test('a form draft becomes a typed item, bad fields are named', () => {
  const r = parseItem('account', { name: ' Giro ', type: 'giro', cur: 'EUR', bal: '1.234,56', asOf: '2026-11-26' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.item, { name: 'Giro', type: 'giro', cur: 'EUR', bal: 123456, asOf: '2026-11-26' });
  const bad = parseItem('account', { name: '', bal: 'viel', asOf: '' });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['asOf', 'bal', 'name']);
  assert.match(bad.errors.bal, /12,50/);
});

test('durations, grades, tags, links and project picks are parsed', () => {
  assert.equal(parseItem('log', { d: '2026-11-26', proj: 'sensito', text: 'Call', min: '1:15', inc: '', exp: '20' }).item.min, 75);
  assert.equal(parseItem('log', { d: '2026-11-26', proj: 'sensito', text: 'Call', min: '1:15', inc: '', exp: '20' }).item.exp, 2000);
  assert.equal(parseItem('log', { d: '2026-11-26', proj: 'sensito', text: 'x', min: '', inc: '-5', exp: '' }).ok, false);
  assert.equal(parseItem('exam', { subj: 'Mathe', d: '2026-12-03', grade: '2,3' }).item.grade, 2.3);
  assert.equal(parseItem('exam', { subj: 'Mathe', d: '2026-12-03', grade: '7' }).ok, false);
  assert.deepEqual(parseItem('note', { title: 'T', tags: '#ki, agents  ki', topic: 'ki', body: '', projects: ['sensito'] }).item.tags, ['ki', 'agents']);
  assert.deepEqual(parseItem('project', { name: 'Sensito', links: 'Shop https://example.com/a\nnur Text\nhttps://example.org' }).item.links,
    [{ label: 'Shop', url: 'https://example.com/a' }, { label: 'example.org', url: 'https://example.org' }]);
  assert.equal(parseItem('project', { name: 'X', prog: '120' }).ok, false);
});

test('clean drops broken stored items and repairs unknown choices', () => {
  assert.equal(cleanItem('account', null), null);
  assert.equal(cleanItem('account', { id: 'a', name: 'Giro', bal: '12', asOf: '2026-11-01' }), null);
  const a = cleanItem('account', { id: 'a', name: 'Giro', bal: 1200, asOf: '2026-11-01', type: 'yacht', cur: 'EUR', hist: [{ d: '2026-11-01', c: 1200 }, { d: 'x', c: 1 }, 'junk'] });
  assert.equal(a.type, 'giro');
  assert.deepEqual(a.hist, [{ d: '2026-11-01', c: 1200 }]);
  assert.equal(a.src, 'manuell');
  assert.deepEqual(toDraft('account', a).bal, '12,00');
  assert.equal(toDraft('log', { min: 75 }).min, '1:15');
});

test('without stored data the three projects and default categories exist', () => {
  const ctx = mk();
  assert.deepEqual(db.list(ctx, 'project').map(p => [p.name, p.status]), [['Reselling', 'aktiv'], ['Personal Brand', 'aktiv'], ['Sensito', 'aktiv']]);
  assert.ok(db.list(ctx, 'cat').some(c => c.kind === 'sparen'));
  assert.deepEqual(db.list(ctx, 'tx'), []);
});

test('upsert adds and replaces by id, remove deletes, broken lists read as empty', () => {
  const ctx = mk();
  ctx.store.set('cx.exams', 'kaputt');
  assert.deepEqual(db.list(ctx, 'exam'), []);
  const e = db.upsert(ctx, 'exam', { subj: 'Mathe', d: '2026-12-03' });
  assert.ok(e.id);
  db.upsert(ctx, 'exam', { ...e, place: 'Raum 4' });
  assert.deepEqual(db.list(ctx, 'exam').map(x => x.place), ['Raum 4']);
  db.remove(ctx, 'exam', e.id);
  assert.deepEqual(db.list(ctx, 'exam'), []);
});

test('saving an account records its balance history per day', () => {
  const ctx = mk();
  const a = db.upsert(ctx, 'account', { name: 'Giro', type: 'giro', cur: 'EUR', bal: 1000, asOf: '2026-11-01' });
  db.upsert(ctx, 'account', { ...db.find(ctx, 'account', a.id), bal: 1500, asOf: '2026-11-01' });
  db.upsert(ctx, 'account', { ...db.find(ctx, 'account', a.id), bal: 2000, asOf: '2026-11-20' });
  assert.deepEqual(db.find(ctx, 'account', a.id).hist, [{ d: '2026-11-01', c: 1500 }, { d: '2026-11-20', c: 2000 }]);
});

test('budgets keep positive cents per category only', () => {
  const ctx = mk();
  db.setBudget(ctx, 'essen', 30000);
  db.setBudget(ctx, 'abos', null);
  ctx.store.set('cx.budgets', { ...ctx.store.get('cx.budgets'), bad: 'x', neg: -5 });
  assert.deepEqual(db.budgets(ctx), { essen: 30000 });
});

test('demo mode shows only examples and leaves real data untouched', () => {
  const ctx = mk();
  db.upsert(ctx, 'account', { name: 'Mein Konto', type: 'giro', cur: 'EUR', bal: 100, asOf: '2026-11-01' });
  db.startDemo(ctx, '2026-11-26');
  assert.equal(db.isDemo(ctx), true);
  assert.ok(db.list(ctx, 'account').every(a => a.src === 'beispiel' && /Beispiel/.test(a.name)));
  db.upsert(ctx, 'exam', { subj: 'Demo', d: '2026-12-01' });
  db.endDemo(ctx);
  assert.equal(db.isDemo(ctx), false);
  assert.deepEqual(db.list(ctx, 'account').map(a => a.name), ['Mein Konto']);
  assert.deepEqual(db.list(ctx, 'exam'), []);
  assert.deepEqual(ctx.store.keys().filter(k => k.startsWith('demo.')), []);
});

test('the example data is complete, valid and marked as example', () => {
  const d = demoData('2026-11-26');
  for (const name of ['account', 'tx', 'sub', 'dept', 'exam', 'stask', 'project', 'ptask', 'log', 'agent', 'note']) {
    const items = d[SCHEMAS[name].key];
    assert.ok(items.length > 0, name);
    for (const it of items) {
      const c = cleanItem(name, it);
      assert.ok(c, `${name} ${JSON.stringify(it)}`);
      assert.equal(c.src, 'beispiel');
    }
  }
});

test('the app backup leaves the examples out', () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-26');
  assert.deepEqual(Object.keys(buildBackup(ctx.store, 'x').data).filter(k => k.startsWith('demo.')), []);
  const other = mk();
  importBackup({ app: 'ki-apps', v: 1, data: { 'demo.cx.exams': [{ id: 'x', subj: 'A', d: '2026-12-01' }], 'cx.exams': [] } }, other.store);
  assert.deepEqual(other.store.keys(), ['cx.exams']);
});

test('export and import round-trip, import merges by id and is logged', () => {
  const ctx = mk();
  db.upsert(ctx, 'exam', { id: 'e1', subj: 'Mathe', d: '2026-12-03' });
  const out = db.exportData(ctx, '2026-11-26T10:00:00Z');
  assert.equal(out.app, 'ki-cockpit');
  const other = mk();
  db.upsert(other, 'exam', { id: 'e2', subj: 'BWL', d: '2026-12-05' });
  const r = db.importData(other, JSON.parse(JSON.stringify(out)), 'cockpit.json', '2026-11-26');
  assert.equal(r.n, 1 + out.data.cats.length + out.data.projects.length);
  assert.deepEqual(db.list(other, 'exam').map(e => e.id).sort(), ['e1', 'e2']);
  assert.deepEqual(db.list(other, 'import').map(i => [i.kind, i.file, i.at]), [['json', 'cockpit.json', '2026-11-26']]);
  assert.throws(() => db.importData(other, { app: 'x' }, 'f', '2026-11-26'), /Cockpit-Datei/);
});

test('wipe deletes the real cockpit data and nothing else', () => {
  const ctx = mk();
  ctx.store.set('train.sess', { a: 1 });
  db.upsert(ctx, 'exam', { subj: 'Mathe', d: '2026-12-03' });
  db.setBudget(ctx, 'essen', 100);
  db.wipe(ctx);
  assert.deepEqual(ctx.store.keys(), ['train.sess']);
});
