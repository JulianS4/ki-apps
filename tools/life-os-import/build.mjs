#!/usr/bin/env node
// Builds a Life-OS-Import file from a Notion snapshot (assembled by Claude through its
// Notion connection) and an Obsidian vault on disk. No data lives in this repository:
// the snapshot, the vault and the output file all stay outside of it.
//
//   node tools/life-os-import/build.mjs --snapshot <notion.json> --vault <dir> --name "Second Brain" \
//        --exclude "14 Menschen" --out <dir>
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- Notion-flavoured Markdown → plain Markdown with [[links]] ----
const unent = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function inline(s) {
  return s
    .replace(/<mention[^>]*>([\s\S]*?)<\/mention>/g, (m, t) => `[[${t.trim()}]]`)
    .replace(/<mention[^>]*\/>/g, '')
    .replace(/<b>([\s\S]*?)<\/b>/g, '**$1**').replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**')
    .replace(/<i>([\s\S]*?)<\/i>/g, '*$1*').replace(/<em>([\s\S]*?)<\/em>/g, '*$1*')
    .replace(/<s>([\s\S]*?)<\/s>/g, '~~$1~~').replace(/<code>([\s\S]*?)<\/code>/g, '`$1`')
    .replace(/<a href="([^"]+)">([\s\S]*?)<\/a>/g, '[$2]($1)')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/?(span|u|p)[^>]*>/g, '')
    .replace(/\\([~*_[\]#`|>-])/g, '$1');
}
function table(html) {
  const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(r => [...r[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(c => inline(c[1]).replace(/\s*\n\s*/g, ' ').trim().replace(/\|/g, '\\|')));
  if (!rows.length) return '';
  const line = r => `| ${r.join(' | ')} |`;
  return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n');
}
export function notionToMd(src) {
  let s = String(src || '').replace(/\r\n?/g, '\n');
  s = s.replace(/<table[^>]*>[\s\S]*?<\/table>/g, t => `\n${table(t)}\n`);
  s = s.replace(/<callout(?:\s+icon="([^"]*)")?[^>]*>\n?([\s\S]*?)\n?<\/callout>/g, (m, icon, body) => `> [!note]${icon ? ' ' + icon : ''}\n${inline(body).trim().split('\n').map(l => `> ${l}`).join('\n')}`);
  s = s.replace(/<toggle heading="h(\d)">\n?([^\n]*)\n?/g, (m, h, title) => `${'#'.repeat(+h)} ${inline(title).trim()}\n`);
  s = s.replace(/<\/?toggle[^>]*>/g, '').replace(/<\/?columns?[^>]*>/g, '').replace(/<colgroup>[\s\S]*?<\/colgroup>/g, '');
  s = s.replace(/<image[^>]*\/?>(?:<\/image>)?/g, '').replace(/<embed source="(https?:[^"]+)"[^>]*\/?>/g, '[Eingebettet]($1)').replace(/<embed[^>]*\/?>/g, '');
  s = s.replace(/<database[^>]*>([\s\S]*?)<\/database>/g, (m, t) => `*(Datenbank „${t.trim() || 'Notion'}“ – Daten kommen über den Life-OS-Import)*`).replace(/<database[^>]*\/>/g, '');
  s = s.replace(/<page[^>]*>([\s\S]*?)<\/page>/g, (m, t) => `[[${t.trim()}]]`);
  s = s.replace(/<empty-block\s*\/>/g, '').replace(/<p\s*\/>/g, '');
  s = s.split('\n').map(inline).join('\n');
  return unent(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---- Notion snapshot → app collections ----
const cents = v => Math.round(Number(v || 0) * 100);
const nid = (p, id) => p + String(id).replace(/[^\w-]/g, '').slice(0, 60);
const slug = s => String(s).toLowerCase().replace(/[äöüß]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c])).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';
const ACC = { Girokonto: 'giro', Tagesgeld: 'tagesgeld', Investment: 'depot' };
const KIND = { Einnahme: 'einnahme', Ausgabe: 'ausgabe', Investition: 'sparen' };
const STATUS = { Aktiv: 'aktiv', Planung: 'idee', Pausiert: 'pausiert', Abgeschlossen: 'abgeschlossen' };
const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);
const euro = c => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(c) + ' €';
const safeName = t => String(t).replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Notion-Seite';

export function fromNotion(snap) {
  const skipped = [], s = snap || {};
  const debt = new Set((s.accounts || []).filter(a => a.kontotyp === 'Verbindlichkeit').map(a => a.id));
  const accounts = (s.accounts || []).map(a => ({
    id: nid('na', a.id), name: a.name, type: ACC[a.kontotyp] || 'sonstiges', cur: 'EUR',
    hist: (s.balances || []).filter(b => b.konto === a.id && isDay(b.stichtag) && Number.isFinite(b.wert)).map(b => ({ d: b.stichtag.slice(0, 10), c: (debt.has(a.id) ? -1 : 1) * cents(b.wert) })),
  })).filter(a => a.hist.length || !skipped.push({ path: a.name, why: 'Konto ohne Kontostand – in Notion eine Bestandsmeldung eintragen' }));
  const known = new Set(accounts.map(a => a.id));
  const cats = [], catId = new Map();
  for (const t of s.transactions || []) {
    if (!KIND[t.typ] || !t.kategorie || catId.has(t.kategorie)) continue;
    const id = 'nc-' + slug(t.kategorie);
    catId.set(t.kategorie, id);
    cats.push({ id, name: t.kategorie, kind: KIND[t.typ] });
  }
  const budgets = {};
  for (const t of s.transactions || []) {
    if (t.status !== 'Geplant' || !(t.typ === 'Ausgabe' || t.typ === 'Investition') || !catId.has(t.kategorie)) continue;
    const id = catId.get(t.kategorie);
    budgets[id] = (budgets[id] || 0) + cents(t.betrag);
  }
  const tx = [];
  for (const t of s.transactions || []) {
    if (t.status !== 'Tatsächlich' || !KIND[t.typ]) continue;
    if (!isDay(t.datum)) { skipped.push({ path: t.beschreibung || 'Buchung', why: 'Buchung ohne Datum – in Notion ein Datum eintragen' }); continue; }
    if (!t.konto || !known.has(nid('na', t.konto))) { skipped.push({ path: t.beschreibung || 'Buchung', why: 'Buchung ohne Konto – in Notion ein Konto zuordnen' }); continue; }
    tx.push({ id: nid('nt', t.id), d: t.datum.slice(0, 10), amt: (t.typ === 'Einnahme' ? 1 : -1) * cents(t.betrag), acc: nid('na', t.konto), cat: catId.get(t.kategorie) || '', payee: t.beschreibung || '', note: t.notizen || '' });
  }
  const projects = (s.projects || []).filter(p => p.bereich).map(p => ({ id: nid('np', p.id), name: p.bereich, status: STATUS[p.status] || 'idee', goal: p.meilenstein || '', ...(p.ziel ? { notes: `Gewinnziel ${euro(p.ziel)} (aus Notion)` } : {}) }));
  const log = (s.log || []).filter(l => isDay(l.datum) && l.bereich).map(l => ({ id: nid('nl', l.id), d: l.datum.slice(0, 10), proj: nid('np', l.bereich), text: l.eintrag || 'Eintrag', min: Math.round(Number(l.stunden || 0) * 60), inc: cents(l.einnahmen), exp: cents(l.ausgaben) }));
  const score = v => (Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : undefined);
  const pillars = (s.pillars || []).filter(p => isDay(p.datum)).map(p => ({ id: nid('nk', p.id), d: p.datum.slice(0, 10), week: p.woche || '', koerper: score(p.koerper), karriere: score(p.karriere), business: score(p.business), fokus: score(p.fokus), netzwerk: score(p.netzwerk), note: p.notiz || '' }));
  const notes = (s.pages || []).filter(p => p.title).map(p => ({ id: nid('nn', p.id), title: p.title, path: `Notion/${safeName(p.title)}.md`, body: notionToMd(p.markdown), tags: ['notion'], topic: 'ohne' }));
  return { notion: { accounts, cats, budgets, tx, projects, log, pillars, notes }, skipped };
}

// ---- Obsidian vault on disk ----
export function readVault(dir, exclude = []) {
  const notes = [], skipped = [], out = new Map();
  const walk = d => {
    for (const name of readdirSync(d).sort((a, b) => a.localeCompare(b))) {
      if (name.startsWith('.')) continue;
      const p = join(d, name), rel = relative(dir, p).split(sep).join('/');
      if (statSync(p).isDirectory()) {
        if (d === dir && exclude.includes(name)) { out.set(name, countMd(p)); continue; }
        walk(p);
      } else if (/\.md$/i.test(name)) notes.push({ path: rel, text: readFileSync(p, 'utf8').replace(/^﻿/, '') });
      else skipped.push({ path: rel, why: 'Anhang – Bilder und PDFs kommen über den Vault-ZIP-Import', n: 1 });
    }
  };
  const countMd = p => readdirSync(p).reduce((n, f) => { const q = join(p, f); return n + (statSync(q).isDirectory() ? countMd(q) : /\.md$/i.test(f) ? 1 : 0); }, 0);
  walk(dir);
  return { notes, skipped: [...[...out].map(([path, n]) => ({ path, why: /menschen|person/i.test(path) ? 'Notizen über Personen – bewusst ausgelassen' : 'bewusst ausgelassen', n })), ...skipped] };
}

export function buildImport({ snapshot, vault, vaultName = 'Vault', exclude = [], now = new Date() }) {
  const { notion, skipped } = fromNotion(snapshot);
  const v = vault ? readVault(vault, exclude) : null;
  return {
    app: 'life-os-import', v: 1, created: now.toISOString(),
    sources: { notion: { name: 'Notion', at: snapshot.at || now.toISOString() }, ...(v ? { obsidian: { name: `Obsidian · ${vaultName}`, at: now.toISOString() } } : {}) },
    notion, skipped,
    ...(v ? { obsidian: { vault: vaultName, notes: v.notes, skipped: v.skipped } } : {}),
  };
}

// ---- command line ----
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = {}, a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 2) (args[a[i].replace(/^--/, '')] = args[a[i].replace(/^--/, '')] || []).push(a[i + 1]);
  const one = k => (args[k] || [])[0];
  if (!one('snapshot') || !one('out')) { console.error('Aufruf: --snapshot <notion.json> --out <ordner> [--vault <ordner> --name <Vault-Name> --exclude <Ordner> …]'); process.exit(1); }
  const now = new Date(), file = buildImport({ snapshot: JSON.parse(readFileSync(one('snapshot'), 'utf8')), vault: one('vault'), vaultName: one('name') || 'Vault', exclude: args.exclude || [], now });
  mkdirSync(one('out'), { recursive: true });
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, target = join(one('out'), `life-os-import-${day}.json`);
  writeFileSync(target, JSON.stringify(file));
  const n = file.notion, o = file.obsidian;
  console.log(`${target}\nNotion: ${n.accounts.length} Konten · ${n.tx.length} Buchungen · ${Object.keys(n.budgets).length} Budgetposten · ${n.projects.length} Projekte · ${n.log.length} Log · ${n.pillars.length} Check-ins · ${n.notes.length} Seiten\nObsidian: ${o ? o.notes.length : 0} Notizen · ausgelassen: ${o ? o.skipped.map(s => `${s.path} (${s.n})`).join(', ') : '-'}\nNicht übernommen: ${file.skipped.length}\nGröße: ${(JSON.stringify(file).length / 1024).toFixed(0)} KB`);
}
