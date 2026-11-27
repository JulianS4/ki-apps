import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { parseRoute } from '../js/core/routes.js';
import { memBackend, mkzip } from './helpers.js';
import { memBlobs } from '../js/areas/body/photos.js';
import * as db from '../js/areas/cockpit/db.js';
import { sideNav, moreList, navKey } from '../js/areas/cockpit/nav.js';
import * as page from '../js/areas/cockpit/imports.js';
import * as finance from '../js/areas/cockpit/finance.js';
import * as notes from '../js/areas/cockpit/notes.js';
import * as integrations from '../js/areas/cockpit/integrations.js';

const R = { area: 'import' };
const mk = () => {
  const ctx = { store: createStore(memBackend()), now: () => new Date(2026, 10, 27, 20, 0), rerender() {}, toast() {}, go() {} };
  page.onNavigate(null, ctx);
  notes.setVaultStore(memBlobs());
  page.setFiles(memBlobs());
  return ctx;
};
const click = dataset => ({ target: { closest: () => ({ dataset }) } });
const FILE = {
  app: 'life-os-import', v: 1, created: '2026-11-27T19:00:00.000Z',
  sources: { notion: { name: 'Notion', at: '2026-11-27T18:58:00.000Z' }, obsidian: { name: 'Obsidian · Second Brain', at: '2026-11-27T18:59:00.000Z' } },
  notion: {
    accounts: [{ id: 'na1', name: 'Girokonto', type: 'giro', cur: 'EUR', hist: [{ d: '2026-10-21', c: 120000 }] }],
    projects: [{ id: 'np1', name: 'Sensito', status: 'aktiv', goal: 'Content' }, { id: 'np2', name: 'Game Dev', status: 'idee', goal: 'M0' }],
    pillars: [{ id: 'nk1', d: '2026-11-22', week: 'KW 47', koerper: 5, karriere: 6, business: 3, fokus: 5, netzwerk: 4 }],
  },
  obsidian: { vault: 'Second Brain', notes: [{ path: 'Ziel A.md', text: 'Text' }], skipped: [{ path: '14 Menschen', why: 'Notizen über Personen – bewusst ausgelassen', n: 7 }] },
};
const jsonFile = (name, obj) => ({ name, size: 10, text: async () => (typeof obj === 'string' ? obj : JSON.stringify(obj)) });

test('Import is its own tab next to the settings, on every screen size', () => {
  assert.deepEqual(parseRoute('#import'), { area: 'import' });
  assert.equal(navKey({ area: 'import' }), 'import');
  assert.match(sideNav('import'), /<div class="sl end"><a href="#import" class="on" aria-current="page">[\s\S]*Import[\s\S]*#einstellungen/);
  assert.match(moreList('cockpit'), /href="#import"/);
});

test('the page says where the data comes from and what stays untouched', () => {
  const html = page.render(R, mk());
  assert.match(html, /<h1>Import<\/h1>/);
  assert.match(html, /Notion[\s\S]*Noch nicht eingespielt[\s\S]*Obsidian[\s\S]*Noch nicht eingespielt/);
  assert.match(html, /Training, Recovery, Ernährung, Routinen, Körper und Arena/);
  assert.match(html, /<input id="lifef"[^>]*type="file"[^>]*accept="\.json/);
  assert.match(html, /<textarea[^>]*data-a="lpaste"/);
  assert.match(html, /Weitere Wege[\s\S]*Bank-Umsätze als CSV[\s\S]*id="csvf"[\s\S]*Obsidian-Vault als ZIP[\s\S]*id="vaultf"/);
});

test('a file: preview first, then import, then the sources show their date', async () => {
  const ctx = mk();
  await page.onChange({ target: { id: 'lifef', files: [jsonFile('life-os-import-2026-11-27.json', FILE)], dataset: {} } }, R, ctx);
  let html = page.render(R, ctx);
  assert.match(html, /Vorschau/);
  assert.match(html, /<td>Konten<\/td><td>1<\/td><td>0<\/td><td>0<\/td>/);
  assert.match(html, /<td>Projekte<\/td><td>1<\/td><td>1<\/td><td>0<\/td>/);
  assert.match(html, /<td>Notizen aus Obsidian<\/td><td>1<\/td>/);
  assert.match(html, /14 Menschen[\s\S]*bewusst ausgelassen/);
  assert.equal(db.list(ctx, 'account').length, 0);
  await page.onClick(click({ a: 'lgo' }), R, ctx);
  html = page.render(R, ctx);
  assert.match(html, /Import fertig/);
  assert.match(html, /Notion[\s\S]*Stand Fr 27\.11\. · 19:58/);
  assert.equal(db.list(ctx, 'account')[0].name, 'Girokonto');
});

test('pasting the text works the same; mistakes are explained', async () => {
  const ctx = mk();
  page.onInput({ target: { dataset: { a: 'lpaste' }, value: '{kaputt' } }, R, ctx);
  page.onClick(click({ a: 'lcheck' }), R, ctx);
  assert.match(page.render(R, ctx), /role="alert">Das ist keine gültige JSON-Datei/);
  page.onInput({ target: { dataset: { a: 'lpaste' }, value: JSON.stringify(FILE) } }, R, ctx);
  page.onClick(click({ a: 'lcheck' }), R, ctx);
  assert.match(page.render(R, ctx), /class="kbq">Vorschau</);
  page.onClick(click({ a: 'lcancel' }), R, ctx);
  assert.doesNotMatch(page.render(R, ctx), /class="kbq">Vorschau</);
});

test('an older Life-OS file still loads here', async () => {
  const ctx = mk();
  await page.onChange({ target: { id: 'lifef', files: [jsonFile('alt.json', { app: 'ki-cockpit', v: 1, data: { exams: [{ id: 'e1', subj: 'BWL', d: '2026-12-02', prep: 'offen' }] } })], dataset: {} } }, R, ctx);
  assert.match(page.render(R, ctx), /Life-OS-Datei übernommen: 1 Einträge/);
  assert.equal(db.list(ctx, 'exam').length, 1);
});

test('bank CSV and the vault ZIP now live here, and nowhere else', async () => {
  const ctx = mk();
  db.upsert(ctx, 'account', { id: 'g', name: 'Giro', type: 'giro', cur: 'EUR', bal: 1, asOf: '2026-11-27' });
  finance.csvLoad(ctx, 'Buchungstag;Betrag;Empfänger\n03.11.2026;-4,50;Bäcker\n', 'umsaetze.csv');
  assert.match(page.render(R, ctx), /umsaetze\.csv · 1 Zeile/);
  page.onChange({ target: { dataset: { a: 'csvacc' }, value: 'g' } }, R, ctx);
  page.onClick(click({ a: 'csvgo' }), R, ctx);
  assert.equal(db.list(ctx, 'tx').length, 1);
  await page.onChange({ target: { id: 'vaultf', files: [{ name: 'V.zip', size: 100, arrayBuffer: async () => mkzip([{ name: 'V/a.md', data: new TextEncoder().encode('x') }]).buffer }], dataset: {} } }, R, ctx);
  assert.match(page.render(R, ctx), /Vorschau: Vault „V“/);
  const fin = finance.render({ area: 'finance', view: 'tx' }, ctx);
  assert.doesNotMatch(fin, /id="csvf"|CSV importieren/);
  const wis = notes.render({ area: 'notes', view: 'list' }, ctx);
  assert.doesNotMatch(wis, /data-a="vopen"|id="vaultf"/);
  assert.match(wis, /href="#import"/);
  assert.doesNotMatch(integrations.render({ area: 'integrations' }, ctx), /id="jsonf"/);
});

test('while the examples are shown, nothing can be imported', () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-27');
  const html = page.render(R, ctx);
  assert.match(html, /Im Beispielmodus ist kein Import möglich/);
  assert.doesNotMatch(html, /id="lifef"|id="csvf"|id="vaultf"/);
});
