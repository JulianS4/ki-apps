import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { parseRoute } from '../js/core/routes.js';
import { memBackend, mkzip } from './helpers.js';
import { memBlobs } from '../js/areas/body/photos.js';
import * as db from '../js/areas/cockpit/db.js';
import { edSave, openEd, ed } from '../js/areas/cockpit/ui.js';
import * as notes from '../js/areas/cockpit/notes.js';

const enc = s => new TextEncoder().encode(s);
const L = { area: 'notes', view: 'list' };
const mk = (backend = memBackend()) => {
  const ctx = { store: createStore(backend), now: () => new Date(2026, 10, 26, 9, 0), rerender() {}, toast() {}, go(h) { ctx.went = h; } };
  notes.onNavigate(null, ctx);
  notes.setVaultStore(memBlobs());
  return ctx;
};
const click = dataset => ({ target: { closest: () => ({ dataset }) } });
const file = (name, bytes) => ({ name, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) });
const pick = (ctx, files) => notes.onChange({ target: { id: 'vaultf', files, dataset: {} } }, L, ctx);

const VAULT = () => mkzip([
  { name: 'Mein Vault/Projekte/Sensito.md', data: enc('---\ntags: [projekt]\nstatus: aktiv\n---\n# Sensito\nSiehe [[Ideen]] und [[Fehlt]].\n![[bild.png]]\n\n## Preise\nÜber 20 €.'), deflate: true, utf8: true },
  { name: 'Mein Vault/Ideen.md', data: enc('Ideen für [[Sensito#Preise|die Preise]] #ideen'), utf8: true },
  { name: 'Mein Vault/Anhänge/bild.png', data: new Uint8Array([137, 80, 78, 71]), utf8: true },
  { name: 'Mein Vault/Audio/ton.mp3', data: new Uint8Array([1]) },
]);

async function imported(ctx) {
  notes.onClick(click({ a: 'vopen' }), L, ctx);
  await pick(ctx, [file('Mein Vault.zip', VAULT())]);
  await notes.onClick(click({ a: 'vapply' }), L, ctx);
  return db.list(ctx, 'note');
}

test('a note can open at a section', () => {
  assert.deepEqual(parseRoute('#wissen/n-abc?h=preise'), { area: 'notes', view: 'note', id: 'abc', h: 'preise' });
  assert.deepEqual(parseRoute('#wissen/n-abc'), { area: 'notes', view: 'note', id: 'abc' });
});

test('the empty tab says how to start: write a note or import a vault', () => {
  const ctx = mk(), html = notes.render(L, ctx);
  assert.match(html, /<h1>Wissen<\/h1>/);
  assert.match(html, /data-a="fnew" data-s="note"[^>]*>Notiz anlegen</);
  assert.match(html, /data-a="vopen"[^>]*>Obsidian-Vault importieren</);
  assert.doesNotMatch(html, /<svg class="kg/);
});

test('import: a preview first that names what comes and what does not, nothing written until confirmed', async () => {
  const ctx = mk();
  notes.onClick(click({ a: 'vopen' }), L, ctx);
  let html = notes.render(L, ctx);
  assert.match(html, /<input id="vaultf"[^>]*type="file"[^>]*accept="\.zip,\.md/);
  assert.match(html, /data-a="vpick"[^>]*>ZIP oder Markdown wählen</);
  await pick(ctx, [file('Mein Vault.zip', VAULT())]);
  html = notes.render(L, ctx);
  assert.match(html, /Vorschau: Vault „Mein Vault“/);
  assert.match(html, /<span>Neu<\/span><b>2<\/b>/);
  assert.match(html, /<span>Anhänge<\/span><b>1<\/b>/);
  assert.match(html, /1 Datei wird nicht übernommen/);
  assert.match(html, /Audio\/ton\.mp3/);
  assert.match(html, /1 Link ohne Ziel/);
  assert.match(html, /„Sensito“ → \[\[Fehlt\]\]/);
  assert.match(html, /data-a="vapply"[^>]*>2 Notizen importieren</);
  assert.equal(db.list(ctx, 'note').length, 0);
  notes.onClick(click({ a: 'vcancel' }), L, ctx);
  assert.doesNotMatch(notes.render(L, ctx), /Vorschau/);
});

test('import errors are explained: not a ZIP, too big, examples shown', async () => {
  const ctx = mk();
  notes.onClick(click({ a: 'vopen' }), L, ctx);
  await pick(ctx, [file('kaputt.zip', enc('nein'))]);
  assert.match(notes.render(L, ctx), /role="alert">Keine ZIP-Datei/);
  await pick(ctx, [{ name: 'riesig.zip', size: 400 * 1024 * 1024, arrayBuffer: async () => { throw new Error('read'); } }]);
  assert.match(notes.render(L, ctx), /größer als 300 MB/);
  db.startDemo(ctx, '2026-11-26');
  notes.onClick(click({ a: 'vopen' }), L, ctx);
  assert.match(notes.render(L, ctx), /Im Beispielmodus ist kein Import möglich/);
  assert.doesNotMatch(notes.render(L, ctx), /id="vaultf"/);
});

test('after the import: graph, folder list and search work together, and it all survives a reload', async () => {
  const backend = memBackend(), ctx = mk(backend), list = await imported(ctx);
  let html = notes.render(L, ctx);
  assert.match(html, /Import fertig: 2 neu, 0 aktualisiert, 0 unverändert · 1 Anhang gespeichert/);
  // the network opens as a 3D brain; the flat graph is one switch away
  assert.match(html, /data-a="gview" data-v="3d" aria-pressed="true"/);
  assert.match(html, /<div class="brain" data-brain="main">[\s\S]*aria-label="Wissensnetz in 3D: 2 Notizen, 1 Verbindung/);
  notes.onClick(click({ a: 'gview', v: '2d' }), L, ctx);
  html = notes.render(L, ctx);
  assert.match(html, /<svg class="kg"[^>]*data-kg="main"/);
  const sens = list.find(n => n.title === 'Sensito'), ideen = list.find(n => n.title === 'Ideen');
  assert.match(html, new RegExp(`<a class="gn[^"]*" href="#wissen/n-${sens.id}"[^>]*aria-label="Sensito · 1 Verbindung"`));
  assert.match(html, /<summary data-a="fold" data-k="Projekte">Projekte <small>1<\/small><\/summary>/);
  assert.match(html, /Vault „Mein Vault“ · importiert 26\.11\./);

  const el = { innerHTML: '' }, svgCls = [];
  globalThis.document = { getElementById: id => (id === 'nres' ? el : null), querySelectorAll: () => [], activeElement: null, body: {} };
  try {
    notes.onInput({ target: { dataset: { a: 'q' }, value: 'preise' } }, L, ctx);
    assert.match(el.innerHTML, /Sensito/);
    assert.match(el.innerHTML, /Projekte\/Sensito\.md/);
    notes.onInput({ target: { dataset: { a: 'q' }, value: '#ideen' } }, L, ctx);
    assert.match(el.innerHTML, /Ideen/);
    assert.doesNotMatch(el.innerHTML, /Sensito\.md/);
  } finally { delete globalThis.document; }
  assert.equal(svgCls.length, 0);
  html = notes.render(L, ctx);
  assert.match(html, new RegExp(`<a class="gn[^"]*hit[^"]*" href="#wissen/n-${ideen.id}"`));

  const again = mk(backend);
  assert.match(notes.render(L, again), /<svg class="kg/);
  assert.equal(db.list(again, 'note').length, 2);
});

test('opening a vault note: its path, properties, Markdown, pictures, local graph and links', async () => {
  const ctx = mk(), list = await imported(ctx), sens = list.find(n => n.title === 'Sensito'), ideen = list.find(n => n.title === 'Ideen');
  const html = notes.render({ area: 'notes', view: 'note', id: sens.id }, ctx);
  assert.match(html, /<p class="k">Projekte<\/p><h1>Sensito<\/h1>/);
  assert.match(html, /Obsidian-Vault · Projekte\/Sensito\.md/);
  assert.match(html, /<summary>Eigenschaften<\/summary>[\s\S]*<dt>status<\/dt><dd>aktiv<\/dd>/);
  assert.match(html, /<h3 id="h-preise">Preise<\/h3>/);
  assert.match(html, /<img class="natt" data-att="Anhänge\/bild\.png"/);
  assert.match(html, /<svg class="kg"[^>]*data-kg="local"/);
  assert.match(html, /Verweise hierher[\s\S]*Ideen/);
  assert.match(html, /data-a="mknote" data-t="Fehlt"/);
  assert.doesNotMatch(html, /In Life OS geändert/);
  assert.match(notes.render({ area: 'notes', view: 'note', id: ideen.id }, ctx), new RegExp(`href="#wissen/n-${sens.id}\\?h=preise">die Preise</a>`));

  openEd(ctx, 'note', sens);
  ed.cur.draft.body = 'Neu geschrieben';
  edSave(ctx);
  assert.match(notes.render({ area: 'notes', view: 'note', id: sens.id }, ctx), /In Life OS geändert/);
});

test('importing again with a note changed on both sides: kept, then the vault version on request', async () => {
  const ctx = mk(), list = await imported(ctx), sens = list.find(n => n.title === 'Sensito');
  openEd(ctx, 'note', sens);
  ed.cur.draft.body = 'Meine Fassung';
  edSave(ctx);
  notes.onClick(click({ a: 'vopen' }), L, ctx);
  await pick(ctx, [file('Mein Vault.zip', mkzip([{ name: 'Mein Vault/Projekte/Sensito.md', data: enc('Vault-Fassung') }, { name: 'Mein Vault/Ideen.md', data: enc('Ideen für [[Sensito#Preise|die Preise]] #ideen') }]))]);
  let html = notes.render(L, ctx);
  assert.match(html, /1 Notiz hast du in Life OS geändert/);
  await notes.onClick(click({ a: 'vapply' }), L, ctx);
  html = notes.render(L, ctx);
  assert.equal(db.find(ctx, 'note', sens.id).body, 'Meine Fassung');
  assert.match(html, new RegExp(`data-a="vtake" data-id="${sens.id}"[^>]*>Vault-Fassung übernehmen<`));
  notes.onClick(click({ a: 'vtake', id: sens.id }), L, ctx);
  assert.equal(db.find(ctx, 'note', sens.id).body, 'Vault-Fassung');
});

test('removing the vault asks first and keeps the notes written in Life OS', async () => {
  const ctx = mk();
  db.upsert(ctx, 'note', { title: 'Eigene', body: '', tags: [], topic: 'privat', projects: [] });
  await imported(ctx);
  notes.onClick(click({ a: 'vcancel' }), L, ctx);
  assert.match(notes.render(L, ctx), /data-a="vremove"[^>]*>Vault-Notizen entfernen</);
  await notes.onClick(click({ a: 'vremove' }), L, ctx);
  assert.match(notes.render(L, ctx), /Sicher\? 2 Notizen und alle Anhänge entfernen/);
  assert.equal(db.list(ctx, 'note').length, 3);
  await notes.onClick(click({ a: 'vremove' }), L, ctx);
  assert.deepEqual(db.list(ctx, 'note').map(n => n.title), ['Eigene']);
  assert.doesNotMatch(notes.render(L, ctx), /data-a="vremove"/);
});
