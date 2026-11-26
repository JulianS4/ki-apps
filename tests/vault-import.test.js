import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { memBackend, mkzip } from './helpers.js';
import { memBlobs } from '../js/areas/body/photos.js';
import * as db from '../js/areas/cockpit/db.js';
import { edSave, openEd, ed } from '../js/areas/cockpit/ui.js';
import { notesMarkdown } from '../js/areas/cockpit/zip.js';
import { vaultFiles, noteFromFile, readZipVault, planVault, applyVault, takeConflict, removeVault, localChanged } from '../js/areas/cockpit/vault.js';

const enc = s => new TextEncoder().encode(s);
const mk = (backend = memBackend()) => ({ store: createStore(backend), now: () => new Date(2026, 10, 26, 9, 0), rerender() {}, toast() {}, go() {} });
const PROJECTS = [{ id: 'sensito', name: 'Sensito' }];

test('the vault folder inside the ZIP is dropped from paths; hidden folders are skipped and said so', () => {
  const { files, skipped, name } = vaultFiles([
    { name: 'Mein Vault/Ideen.md' }, { name: 'Mein Vault/Projekte/Sensito.md' }, { name: 'Mein Vault/.obsidian/app.json' },
    { name: 'Mein Vault/.trash/alt.md' }, { name: '__MACOSX/Mein Vault/._Ideen.md' }, { name: 'Mein Vault/../boese.md' },
  ], 'export.zip');
  assert.equal(name, 'Mein Vault');
  assert.deepEqual(files.map(f => f.path), ['Ideen.md', 'Projekte/Sensito.md']);
  assert.deepEqual(skipped.map(s => s.why), ['ungültiger Pfad', '3 Dateien aus versteckten Ordnern (Obsidian-Einstellungen, Papierkorb) übersprungen']);
  assert.equal(vaultFiles([{ name: 'a.md' }, { name: 'Ordner/b.md' }], 'Vault.zip').name, 'Vault');
});

test('a Markdown file becomes a note: file name as title, tags, aliases, area and projects from its properties, text untouched', () => {
  const text = '---\ntags: [lernen]\naliases: [Plan B]\nbereich: Finanzen\nprojekte: [Sensito]\nerstellt: 2026-01-05\n---\nInhalt mit #sparen und [[Link]]\n';
  const n = noteFromFile('Ordner/Mein Plan.md', text, PROJECTS);
  assert.equal(n.title, 'Mein Plan');
  assert.equal(n.body, 'Inhalt mit #sparen und [[Link]]\n');
  assert.equal(n.fm, 'tags: [lernen]\naliases: [Plan B]\nbereich: Finanzen\nprojekte: [Sensito]\nerstellt: 2026-01-05');
  assert.deepEqual([n.tags, n.aliases, n.topic, n.projects, n.created, n.path], [['lernen', 'sparen'], ['Plan B'], 'finanzen', ['sensito'], '2026-01-05', 'Ordner/Mein Plan.md']);
  assert.equal(noteFromFile('x.md', '---\ntitle: "Echter Titel"\n---\n', []).title, 'Echter Titel');
  assert.equal(noteFromFile('x.md', 'ohne alles', []).topic, 'ohne');
  assert.match(noteFromFile('lang.md', 'x'.repeat(100001), []).skip, /zu lang/);
});

function vaultZip(extra = []) {
  return mkzip([
    { name: 'Mein Vault/Projekte/Sensito.md', data: enc('# Sensito\nSiehe [[Ideen]] und [[Fehlt]].\n![[bild.png]] ![[ton.mp3]]'), deflate: true, utf8: true },
    { name: 'Mein Vault/Ideen.md', data: enc('---\ntags: [ideen]\naliases: [Brainstorm]\n---\nIdeen für [[Sensito]]'), utf8: true },
    { name: 'Mein Vault/Anhänge/bild.png', data: new Uint8Array([137, 80, 78, 71]), utf8: true },
    { name: 'Mein Vault/Audio/ton.mp3', data: new Uint8Array([1, 2, 3]) },
    { name: 'Mein Vault/alt.md', data: new Uint8Array([0x48, 0xe4, 0x6c]) },
    { name: 'Mein Vault/.obsidian/app.json', data: enc('{}') },
    ...extra,
  ]);
}

test('reading a vault ZIP: notes and pictures come in, the rest is named with a reason', async () => {
  const ctx = mk(), raw = await readZipVault(vaultZip(), 'Mein Vault.zip');
  const plan = planVault(raw, ctx, 'Mein Vault.zip');
  assert.equal(plan.name, 'Mein Vault');
  assert.deepEqual(plan.add.map(n => n.path).sort(), ['Ideen.md', 'Projekte/Sensito.md']);
  assert.deepEqual(plan.atts.map(a => [a.path, a.type]), [['Anhänge/bild.png', 'image/png']]);
  const why = Object.fromEntries(plan.skipped.map(s => [s.path, s.why]));
  assert.match(why['Audio/ton.mp3'], /Dateityp/);
  assert.match(why['alt.md'], /UTF-8/);
  assert.ok(plan.skipped.some(s => /versteckten Ordnern/.test(s.why)));
  assert.deepEqual(plan.unresolved.map(u => [u.from, u.t]), [['Sensito', 'Fehlt'], ['Sensito', 'ton.mp3']]);
});

test('importing keeps notes and pictures after a reload, and logs the import', async () => {
  const backend = memBackend(), ctx = mk(backend), files = memBlobs();
  db.upsert(ctx, 'note', { id: 'own', title: 'Eigene Notiz', body: 'aus Life OS', tags: [], topic: 'privat', projects: [] });
  const plan = planVault(await readZipVault(vaultZip(), 'v.zip'), ctx, 'v.zip');
  const r = await applyVault(ctx, plan, files);
  assert.deepEqual([r.added, r.updated, r.attWritten, r.attFailed], [2, 0, 1, 0]);
  const again = mk(backend), notes = db.list(again, 'note');
  assert.deepEqual(notes.map(n => n.title).sort(), ['Eigene Notiz', 'Ideen', 'Sensito']);
  const s = notes.find(n => n.title === 'Sensito');
  assert.equal(s.src, 'vault');
  assert.equal(s.body, '# Sensito\nSiehe [[Ideen]] und [[Fehlt]].\n![[bild.png]] ![[ton.mp3]]');
  assert.deepEqual(db.getRaw(again, 'vatt'), ['Anhänge/bild.png']);
  assert.ok(await files.get('Anhänge/bild.png'));
  assert.deepEqual(db.getRaw(again, 'vault'), { name: 'Mein Vault', at: '2026-11-26', file: 'v.zip' });
  assert.deepEqual(db.list(again, 'import').map(i => [i.kind, i.file, i.n]), [['vault', 'v.zip', 2]]);
});

test('no import while the examples are shown', async () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-26');
  const plan = planVault(await readZipVault(vaultZip(), 'v.zip'), ctx, 'v.zip');
  await assert.rejects(() => applyVault(ctx, plan, memBlobs()), /Beispielmodus/);
});

test('importing again: same stays, changed files update, edits made in Life OS are never overwritten unasked', async () => {
  const ctx = mk(), files = memBlobs();
  await applyVault(ctx, planVault(await readZipVault(vaultZip(), 'v.zip'), ctx, 'v.zip'), files);
  const ideen = db.list(ctx, 'note').find(n => n.title === 'Ideen');
  db.upsert(ctx, 'note', { ...ideen, projects: ['sensito'] });
  const sens = db.list(ctx, 'note').find(n => n.title === 'Sensito');
  assert.equal(localChanged(sens), false);
  openEd(ctx, 'note', sens);
  ed.cur.draft.body = 'In Life OS geändert';
  edSave(ctx);
  const edited = db.find(ctx, 'note', sens.id);
  assert.deepEqual([edited.path, edited.src, localChanged(edited)], ['Projekte/Sensito.md', 'vault', true]);

  const z2 = mkzip([
    { name: 'Mein Vault/Projekte/Sensito.md', data: enc('Neu aus Obsidian') },
    { name: 'Mein Vault/Ideen.md', data: enc('---\ntags: [ideen]\naliases: [Brainstorm]\n---\nIdeen, überarbeitet') },
    { name: 'Mein Vault/Neu.md', data: enc('Ganz neu') },
  ]);
  const plan = planVault(await readZipVault(z2, 'v.zip'), ctx, 'v.zip');
  assert.deepEqual([plan.add.length, plan.update.length, plan.same, plan.conflicts.length, plan.gone.length], [1, 1, 0, 1, 0]);
  const r = await applyVault(ctx, plan, files);
  assert.equal(r.conflicts, 1);
  const after = db.list(ctx, 'note');
  assert.equal(after.find(n => n.id === ideen.id).body, 'Ideen, überarbeitet');
  assert.deepEqual(after.find(n => n.id === ideen.id).projects, ['sensito']);
  assert.equal(after.find(n => n.id === sens.id).body, 'In Life OS geändert');
  assert.ok(takeConflict(ctx, plan, sens.id));
  assert.equal(db.find(ctx, 'note', sens.id).body, 'Neu aus Obsidian');
  assert.equal(localChanged(db.find(ctx, 'note', sens.id)), false);
  assert.equal(plan.conflicts.length, 0);

  const z3 = mkzip([{ name: 'Mein Vault/Neu.md', data: enc('Ganz neu') }]);
  const p3 = planVault(await readZipVault(z3, 'v.zip'), ctx, 'v.zip');
  assert.deepEqual([p3.same, p3.gone.map(n => n.title).sort()], [1, ['Ideen', 'Sensito']]);
  await applyVault(ctx, p3, files);
  assert.equal(db.list(ctx, 'note').length, 3);
});

test('removing the vault takes only imported notes and pictures', async () => {
  const ctx = mk(), files = memBlobs();
  db.upsert(ctx, 'note', { id: 'own', title: 'Eigene Notiz', body: '', tags: [], topic: 'privat', projects: [] });
  await applyVault(ctx, planVault(await readZipVault(vaultZip(), 'v.zip'), ctx, 'v.zip'), files);
  assert.equal(await removeVault(ctx, files), 2);
  assert.deepEqual(db.list(ctx, 'note').map(n => n.id), ['own']);
  assert.deepEqual(await files.keys(), []);
  assert.equal(db.getRaw(ctx, 'vatt'), null);
  assert.equal(db.getRaw(ctx, 'vault'), null);
});

test('Markdown export writes vault notes back to their path, unchanged', () => {
  const files = notesMarkdown([
    { title: 'Plan', path: 'Ordner/Plan.md', fm: 'tags: [a]', body: 'Text [[X]]\n', tags: ['a'], topic: 'ohne', projects: [] },
    { title: 'Ordner/Plan', body: 'eigene', tags: [], topic: 'privat', projects: [] },
  ], []);
  assert.deepEqual(files.map(f => f.name), ['Ordner/Plan.md', 'Ordner Plan.md']);
  assert.equal(new TextDecoder().decode(files[0].data), '---\ntags: [a]\n---\nText [[X]]\n');
});
