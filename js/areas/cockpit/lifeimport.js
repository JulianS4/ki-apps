// Life-OS-Import: one file that Claude builds from Notion (accounts, budget, projects,
// business log, pillar check-ins, text pages) and Obsidian (notes). Each import replaces
// what the same source brought last time; entries made in the app and the app's own
// areas (training, recovery, food, routines, body, arena) are never touched.
import { ds } from '../../core/dates.js';
import { STORAGE_FAILED } from '../../core/backup.js';
import * as db from './db.js';
import { SCHEMAS, cleanItem } from './schema.js';
import { DEMO_NO_IMPORT } from './ui.js';
import { norm } from './md.js';
import { planVault, applyVault } from './vault.js';

export function readImport(text) {
  let o;
  try { o = JSON.parse(String(text ?? '').replace(/^﻿/, '')); } catch (e) { throw new Error('Das ist keine gültige JSON-Datei – bitte die Datei von Claude unverändert wählen.'); }
  if (o && o.app === 'ki-cockpit') return { legacy: o };
  if (!o || typeof o !== 'object' || o.app !== 'life-os-import') throw new Error('Das ist keine Life-OS-Import-Datei.');
  if (o.v !== 1) throw new Error('Diese Datei hat eine neuere Version – bitte erst die App aktualisieren (schließen und neu öffnen).');
  return { file: o };
}

// In this order: what later collections point to comes first.
export const COLS = [['account', 'accounts', 'Konten'], ['cat', 'cats', 'Kategorien'], ['tx', 'tx', 'Buchungen'], ['project', 'projects', 'Projekte'],
  ['log', 'log', 'Business Log'], ['pillar', 'pillars', 'Säulen-Check-ins'], ['note', 'notes', 'Notizen aus Notion']];
const BY_NAME = { account: 'name', cat: 'name', project: 'name' };

function withHist(item, old) {
  const hist = [...((old && old.hist) || []).filter(p => !(item.hist || []).some(q => q.d === p.d)), ...(item.hist || [])].sort((a, b) => (a.d < b.d ? -1 : 1));
  const last = hist[hist.length - 1];
  return last ? { ...item, hist, bal: last.c, asOf: last.d } : item;
}

// What an import would change, shown before anything is written.
export function planImport(ctx, file, name = 'Life-OS-Import') {
  // A file without a Notion part (only Obsidian) leaves the Notion entries as they are.
  const hasN = !!file.notion && typeof file.notion === 'object';
  const n = file.notion || {}, today = ds(ctx.now()), ids = { account: new Map(), cat: new Map(), project: new Map() }, map = (k, id) => (ids[k] && ids[k].get(id)) || id;
  const rows = [], next = {};
  for (const [k, key, label] of COLS) {
    const existing = db.list(ctx, k), incoming = Array.isArray(n[key]) ? n[key] : [], taken = new Set(), out = [];
    if (!hasN) { next[k] = existing; continue; }
    let add = 0, update = 0, bad = 0;
    for (const raw of incoming) {
      if (!raw || typeof raw !== 'object') { bad++; continue; }
      let item = { ...raw, src: 'notion', upd: today };
      // Already in the app – the same Notion entry from last time (even renamed), or something with the
      // same name: Notion takes its place and keeps its id, so tasks, bookings and log entries stay linked.
      const nameKey = BY_NAME[k], free = e => !taken.has(e.id), nid = raw.id == null ? '' : String(raw.id);
      const same = nameKey && (existing.find(e => free(e) && nid && e.nid === nid) || existing.find(e => free(e) && norm(e[nameKey]) === norm(item[nameKey])));
      if (nameKey && nid) item.nid = nid;
      if (same) { ids[k].set(raw.id, same.id); item = { ...same, ...item, id: same.id }; }
      if (k === 'account') item = withHist({ hist: [], ...item }, same || existing.find(e => e.id === item.id));
      if (k === 'tx') item = { ...item, acc: map('account', item.acc), cat: map('cat', item.cat) };
      if (k === 'log') item = { ...item, proj: map('project', item.proj) };
      if (k === 'note') item = { ...item, projects: (item.projects || []).map(p => map('project', p)), topic: item.topic || 'ohne', tags: item.tags || [] };
      const c = cleanItem(k, item);
      if (!c || taken.has(c.id)) { bad++; continue; }
      if (existing.some(e => e.id === c.id)) update++; else add++;
      taken.add(c.id);
      out.push(c);
    }
    const remove = existing.filter(e => e.src === 'notion' && !taken.has(e.id)).length;
    rows.push({ k, label, add, update, remove, bad, n: out.length });
    next[k] = [...existing.filter(e => e.src !== 'notion' && !taken.has(e.id)), ...out];
  }
  // Budget: the plan amounts per category from Notion replace the ones it brought before.
  const was = new Set(hasN ? db.list(ctx, 'cat').filter(c => c.src === 'notion').map(c => c.id) : []), now = new Set(next.cat.filter(c => c.src === 'notion').map(c => c.id));
  const bud = Object.fromEntries(Object.entries(db.budgets(ctx)).filter(([c]) => !was.has(c)));
  let budgets = 0;
  for (const [c, v] of Object.entries(n.budgets || {})) { const id = map('cat', c); if (now.has(id) && Number.isInteger(v) && v > 0) { bud[id] = v; budgets++; } }
  const o = file.obsidian, vault = o && Array.isArray(o.notes)
    ? planVault({ name: o.vault || 'Obsidian', md: o.notes.filter(x => x && typeof x.path === 'string' && typeof x.text === 'string').map(x => ({ path: x.path, text: x.text })), atts: [], skipped: [] }, ctx, name)
    : null;
  return { name, sources: file.sources || {}, rows, next, bud, budgets, vault, skipped: [...(Array.isArray(file.skipped) ? file.skipped : []), ...((o && o.skipped) || []), ...(vault ? vault.skipped : [])] };
}

export async function applyImport(ctx, plan, files) {
  if (db.isDemo(ctx)) throw new Error(DEMO_NO_IMPORT);
  for (const [k] of COLS) if (!db.setRaw(ctx, SCHEMAS[k].key, plan.next[k])) throw new Error(STORAGE_FAILED);
  if (!db.setRaw(ctx, 'budgets', plan.bud)) throw new Error(STORAGE_FAILED);
  const vault = plan.vault ? await applyVault(ctx, plan.vault, files, { record: false }) : null;
  const notion = plan.rows.reduce((a, r) => a + r.n, 0), today = ds(ctx.now());
  const counts = Object.fromEntries(plan.rows.map(r => [r.k, r.n]));
  // A source the file does not bring keeps its date from last time.
  db.setRaw(ctx, 'sources', {
    ...(db.getRaw(ctx, 'sources', {}) || {}),
    ...(plan.sources.notion ? { notion: { ...plan.sources.notion, counts } } : {}),
    ...(plan.sources.obsidian ? { obsidian: { ...plan.sources.obsidian, notes: plan.vault ? plan.vault.add.length + plan.vault.update.length + plan.vault.same : 0 } } : {}),
  });
  db.upsert(ctx, 'import', { kind: 'claude', file: plan.name, at: today, n: notion + (vault ? vault.added + vault.updated : 0) });
  return { notion, vault, rows: plan.rows };
}
