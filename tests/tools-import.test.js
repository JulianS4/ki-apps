import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { notionToMd, fromNotion, readVault, buildImport } from '../tools/life-os-import/build.mjs';
import { readImport, planImport } from '../js/areas/cockpit/lifeimport.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

test('Notion pages become Markdown: mentions are [[links]], callouts, tables and toggles stay readable', () => {
  const md = notionToMd(`<callout icon="🎯" color="gray_bg">
"Work in silence."
</callout>
<columns>
<column ratio="50">
## 1.000.000 €

Nettovermögen bis <b>2033</b>
</column>
</columns>
<p color="gray">
→ <mention url="https://app.notion.com/p/400">Finance Dashboard</mention> · <mention url="https://app.notion.com/p/31d">Lebensziele</mention>
</p>
<image source="notion-file-block://x?name=a.svg" />
<database url="https://app.notion.com/p/1" data-source-url="collection://1" inline="true">Konten</database>
<toggle heading="h3">
🗓️ Planungsrhythmus

- <b>Täglich:</b> Morgen-Check
</toggle>
<table header-row="true">
<tr>
<td>
Phase
</td>
<td>
Alter
</td>
</tr>
<tr>
<td>
<b>1 · Ausbildung</b>
</td>
<td>
17–20
</td>
</tr>
</table>
<page url="https://app.notion.com/p/365">FD Details und Datenpflege</page>
Entspricht \\~52 % Wachstum<br />pro Jahr`);
  assert.match(md, /> \[!note\] 🎯\n> "Work in silence\."/);
  assert.match(md, /## 1\.000\.000 €\n\nNettovermögen bis \*\*2033\*\*/);
  assert.match(md, /→ \[\[Finance Dashboard\]\] · \[\[Lebensziele\]\]/);
  assert.doesNotMatch(md, /<image|<database|<column|<toggle|<table|<p |<\/p>/);
  assert.match(md, /\*\(Datenbank „Konten“ – Daten kommen über den Life-OS-Import\)\*/);
  assert.match(md, /### 🗓️ Planungsrhythmus\n\n- \*\*Täglich:\*\* Morgen-Check/);
  assert.match(md, /\| Phase \| Alter \|\n\| --- \| --- \|\n\| \*\*1 · Ausbildung\*\* \| 17–20 \|/);
  assert.match(md, /\[\[FD Details und Datenpflege\]\]/);
  assert.match(md, /Entspricht ~52 % Wachstum\npro Jahr/);
});

const SNAP = {
  at: '2026-11-27T19:00:00.000Z',
  accounts: [{ id: 'a1', name: 'Girokonto', kontotyp: 'Girokonto' }, { id: 'a2', name: 'Kredit', kontotyp: 'Verbindlichkeit' }, { id: 'a3', name: 'ETF', kontotyp: 'Investment' }],
  balances: [{ konto: 'a1', stichtag: '2026-10-21', wert: 1200 }, { konto: 'a2', stichtag: '2026-10-21', wert: 1000 }, { konto: 'a3', stichtag: '2026-10-21', wert: 2500.5 }],
  transactions: [
    { id: 't1', beschreibung: 'Essen', betrag: 250, kategorie: 'Essen', typ: 'Ausgabe', status: 'Geplant' },
    { id: 't2', beschreibung: 'ETF', betrag: 300, kategorie: 'ETF-Sparplan', typ: 'Investition', status: 'Geplant' },
    { id: 't3', beschreibung: 'Gehalt', betrag: 950.5, kategorie: 'Lohn', typ: 'Einnahme', status: 'Geplant' },
    { id: 't4', beschreibung: 'Rewe', betrag: 12.5, kategorie: 'Essen', typ: 'Ausgabe', status: 'Tatsächlich', datum: '2026-11-03', konto: 'a1' },
    { id: 't5', beschreibung: 'Umbuchung', betrag: 100, kategorie: 'Umbuchung', typ: 'Übertrag', status: 'Tatsächlich', datum: '2026-11-04', konto: 'a1' },
    { id: 't6', beschreibung: 'ohne Konto', betrag: 5, kategorie: 'Essen', typ: 'Ausgabe', status: 'Tatsächlich', datum: '2026-11-05' },
  ],
  projects: [{ id: 'p1', bereich: 'Sensito', status: 'Aktiv', meilenstein: 'Content', ziel: 1000 }, { id: 'p2', bereich: 'Game Dev', status: 'Planung', meilenstein: 'M0' }],
  log: [{ id: 'l1', eintrag: 'Shop', datum: '2026-11-20', bereich: 'p1', einnahmen: 0, ausgaben: 5, stunden: 1.5 }],
  pillars: [{ id: 'k1', woche: 'KW 47', datum: '2026-11-22', koerper: 5, karriere: 6, business: 3, fokus: 5, netzwerk: 4 }, { id: 'k0' }],
  pages: [{ id: 'g1', title: 'Lebensziele', markdown: 'Siehe <mention url="https://app.notion.com/p/x">5 Säulen des Erfolgs</mention>' }],
};

test('the Notion snapshot maps onto the app: accounts with signed balances, budget from the plan, real bookings only', () => {
  const { notion, skipped } = fromNotion(SNAP);
  assert.deepEqual(notion.accounts.map(a => [a.name, a.type, a.hist[0].c]), [['Girokonto', 'giro', 120000], ['Kredit', 'sonstiges', -100000], ['ETF', 'depot', 250050]]);
  assert.deepEqual(notion.cats.map(c => [c.name, c.kind]), [['Essen', 'ausgabe'], ['ETF-Sparplan', 'sparen'], ['Lohn', 'einnahme']]);
  assert.deepEqual(Object.values(notion.budgets), [25000, 30000]);
  assert.deepEqual(notion.tx.map(t => [t.d, t.amt, t.payee, t.acc]), [['2026-11-03', -1250, 'Rewe', 'naa1']]);
  assert.deepEqual(notion.projects.map(p => [p.name, p.status, p.goal]), [['Sensito', 'aktiv', 'Content'], ['Game Dev', 'idee', 'M0']]);
  assert.match(notion.projects[0].notes, /Gewinnziel 1\.000 €/);
  assert.deepEqual(notion.log.map(l => [l.proj, l.min, l.exp]), [['npp1', 90, 500]]);
  assert.deepEqual(notion.pillars.map(p => [p.week, p.karriere]), [['KW 47', 6]]);
  assert.deepEqual(notion.notes.map(n => [n.title, n.path, n.body]), [['Lebensziele', 'Notion/Lebensziele.md', 'Siehe [[5 Säulen des Erfolgs]]']]);
  assert.deepEqual(skipped.map(s => s.why), ['Buchung ohne Konto – in Notion ein Konto zuordnen']);
});

test('the vault is read from disk; hidden folders and the excluded ones stay out', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vault-'));
  mkdirSync(join(dir, '.obsidian'));
  writeFileSync(join(dir, '.obsidian', 'app.json'), '{}');
  mkdirSync(join(dir, '02 Ziele'));
  writeFileSync(join(dir, '02 Ziele', 'Ziel A.md'), '---\ntyp: ziel\n---\nText');
  mkdirSync(join(dir, '14 Menschen'));
  writeFileSync(join(dir, '14 Menschen', 'Person.md'), 'privat');
  writeFileSync(join(dir, '02 Ziele', 'bild.png'), 'x');
  const v = readVault(dir, ['14 Menschen']);
  assert.deepEqual(v.notes.map(n => n.path), ['02 Ziele/Ziel A.md']);
  assert.deepEqual(v.skipped.map(s => [s.path, s.n]), [['14 Menschen', 1], ['02 Ziele/bild.png', 1]]);
  assert.doesNotMatch(JSON.stringify(v), /privat/);
});

test('the built file is a Life-OS-Import file the app reads and previews', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vault-'));
  writeFileSync(join(dir, 'Notiz.md'), 'Mit [[Lebensziele]]');
  const file = buildImport({ snapshot: SNAP, vault: dir, vaultName: 'Second Brain', exclude: [], now: new Date('2026-11-27T19:30:00Z') });
  const { file: f } = readImport(JSON.stringify(file));
  assert.deepEqual([f.app, f.v, f.sources.notion.at, f.sources.obsidian.name], ['life-os-import', 1, '2026-11-27T19:00:00.000Z', 'Obsidian · Second Brain']);
  const ctx = { store: createStore(memBackend()), now: () => new Date(2026, 10, 27, 20, 0) };
  const plan = planImport(ctx, f);
  assert.equal(plan.rows.find(r => r.k === 'account').add, 3);
  assert.equal(plan.vault.add.length, 1);
});
