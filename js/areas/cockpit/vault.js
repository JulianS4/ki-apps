// Obsidian vault import: Markdown files become notes (path, front matter and text
// kept exactly), pictures and PDFs go to IndexedDB, everything else is named with
// a reason. Nothing is written before the preview is confirmed, and a note changed
// in Life OS is never overwritten by a later import without asking.
import { ds } from '../../core/dates.js';
import { STORAGE_FAILED } from '../../core/backup.js';
import * as db from './db.js';
import { TOPICS } from './data.js';
import { cleanItem } from './schema.js';
import { DEMO_NO_IMPORT } from './ui.js';
import { listZip, readEntry } from './unzip.js';
import { norm, splitFrontmatter, parseProps, propValues, inlineTags, linkTargets, makeResolver, baseOf, FILE_EXT } from './md.js';

export const MAX_NOTE = 100000;
export const MAX_ATT = 10 * 1024 * 1024;
export const MAX_ATT_TOTAL = 150 * 1024 * 1024;
export const MAX_ZIP = 300 * 1024 * 1024;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp', pdf: 'application/pdf' };
const extOf = p => (/\.([a-z0-9]+)$/i.exec(p) || ['', ''])[1].toLowerCase();
export const isAtt = p => extOf(p) in MIME;
const KIND = { canvas: 'Canvas wird nicht unterstützt', mp3: 'Audio', m4a: 'Audio', wav: 'Audio', ogg: 'Audio', webm: 'Video', mp4: 'Video', mov: 'Video' };
const whyNot = p => (extOf(p) === 'canvas' ? KIND.canvas : `Dateityp ${KIND[extOf(p)] ? KIND[extOf(p)] + ' ' : ''}wird nicht übernommen (nur Notizen, Bilder und PDFs)`);

// Two 32-bit FNV-1a passes: a stable id from the path, a fingerprint of the content.
function fnv(s, h = 0x811c9dc5) {
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
const hash = s => fnv(s) + fnv(s, 0x9747b28c);
const vaultHash = n => hash([n.title, n.fm || '', n.body, (n.tags || []).join(',')].join('\u0001'));
// True when an imported note was changed in Life OS since its import.
export const localChanged = n => !!(n && n.h) && vaultHash(n) !== n.h;

// Paths inside the ZIP: the vault folder itself is dropped, hidden folders skipped.
export function vaultFiles(entries, zipName = '') {
  const skipped = [], files = [];
  let hidden = 0;
  for (const e of entries) {
    const path = String(e.name).replace(/\\/g, '/').replace(/^\/+/, ''), segs = path.split('/');
    if (segs.includes('..')) { skipped.push({ path, why: 'ungültiger Pfad' }); continue; }
    if (segs.some(s => s.startsWith('.') || s === '__MACOSX')) { hidden++; continue; }
    files.push({ ...e, path });
  }
  let name = String(zipName).replace(/\.zip$/i, '').trim();
  const top = files.length ? files[0].path.split('/')[0] : '';
  if (top && files.every(f => f.path.startsWith(top + '/'))) {
    name = top;
    for (const f of files) f.path = f.path.slice(top.length + 1);
  }
  if (hidden) skipped.push({ path: '.obsidian, .trash …', n: hidden, why: `${hidden} ${hidden === 1 ? 'Datei' : 'Dateien'} aus versteckten Ordnern (Obsidian-Einstellungen, Papierkorb) übersprungen` });
  return { files, skipped, name: name || 'Vault' };
}

const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
// One Markdown file → the note's fields, or { skip } with the reason.
export function noteFromFile(path, text, projects) {
  const { fm, body } = splitFrontmatter(text);
  if (body.length > MAX_NOTE) return { skip: 'zu lang (über 100.000 Zeichen)' };
  if (fm.length > 20000) return { skip: 'Eigenschaften zu lang (über 20.000 Zeichen)' };
  const props = parseProps(fm), b = norm(propValues(props, 'bereich')[0] || '');
  const topic = (TOPICS.find(([v, l]) => b && (v === b || norm(l) === b)) || ['ohne'])[0];
  const created = propValues(props, 'erstellt', 'created', 'date').map(v => v.slice(0, 10)).find(isDay);
  const n = {
    title: (propValues(props, 'title')[0] || baseOf(path).replace(/\.md$/i, '')).slice(0, 300) || 'Ohne Titel',
    body, fm, path,
    tags: [...propValues(props, 'tags', 'tag'), ...inlineTags(body)].filter((t, i, a) => a.findIndex(x => norm(x) === norm(t)) === i),
    aliases: propValues(props, 'aliases', 'alias'),
    topic,
    projects: propValues(props, 'projekte', 'projects').map(x => (projects.find(p => norm(p.name) === norm(x)) || {}).id).filter(Boolean),
  };
  if (created) n.created = created;
  n.h = vaultHash(n);
  return n;
}

// The ZIP's notes (as bytes) and supported attachments; everything else with a reason.
export async function readZipVault(bytes, fileName) {
  const { entries, problems } = listZip(bytes);
  const { files, skipped, name } = vaultFiles(entries, fileName);
  skipped.unshift(...problems);
  const md = [], atts = [];
  let total = 0;
  for (const f of files) {
    const isMd = /\.md$/i.test(f.path);
    if (!isMd && !isAtt(f.path)) { skipped.push({ path: f.path, why: whyNot(f.path) }); continue; }
    if (isMd && f.size > MAX_NOTE * 4 + 80000) { skipped.push({ path: f.path, why: 'zu lang (über 100.000 Zeichen)' }); continue; }
    if (!isMd && f.size > MAX_ATT) { skipped.push({ path: f.path, why: 'größer als 10 MB' }); continue; }
    if (!isMd && total + f.size > MAX_ATT_TOTAL) { skipped.push({ path: f.path, why: 'Platz für Anhänge ausgeschöpft (150 MB je Import)' }); continue; }
    let data;
    try { data = await readEntry(bytes, f); } catch (e) { skipped.push({ path: f.path, why: e && /Browser/.test(e.message) ? e.message : 'nicht lesbar (Datei beschädigt)' }); continue; }
    if (isMd) md.push({ path: f.path, bytes: data });
    else { total += data.length; atts.push({ path: f.path, bytes: data, type: MIME[extOf(f.path)], size: data.length }); }
  }
  return { name, md, atts, skipped };
}

const utf8 = new TextDecoder('utf-8', { fatal: true });
function newId(path, taken) {
  let id = 'v' + hash(norm(path)), i = 2;
  while (taken.has(id)) id = 'v' + hash(norm(path) + '#' + i++);
  taken.add(id);
  return id;
}
// Keeps the note's id, creation date, projects (unless the file names some) and area.
function merged(old, n) {
  return { ...old, ...n, id: old.id, created: old.created, src: 'vault', projects: n.projects.length ? n.projects : old.projects, topic: n.topic !== 'ohne' ? n.topic : old.topic };
}

// What an import would do, shown before anything is written.
export function planVault(raw, ctx, file = '') {
  const notes = db.list(ctx, 'note'), projects = db.list(ctx, 'project'), byPath = new Map(notes.filter(n => n.path).map(n => [norm(n.path), n]));
  const taken = new Set(notes.map(n => n.id)), skipped = [...raw.skipped], plan = { name: raw.name, file: String(file).slice(0, 120), add: [], update: [], same: 0, conflicts: [], gone: [], atts: raw.atts, skipped, unresolved: [], twins: [] };
  const seen = new Set();
  for (const m of [...raw.md].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    let text;
    try { text = typeof m.text === 'string' ? m.text : utf8.decode(m.bytes); } catch (e) { skipped.push({ path: m.path, why: 'keine UTF-8-Textdatei – in Obsidian öffnen und neu speichern' }); continue; }
    const n = noteFromFile(m.path, text, projects);
    if (n.skip) { skipped.push({ path: m.path, why: n.skip }); continue; }
    seen.add(norm(m.path));
    const old = byPath.get(norm(m.path));
    if (!old) {
      plan.add.push({ ...n, id: newId(m.path, taken), src: 'vault' });
      if (notes.some(x => !x.path && norm(x.title) === norm(n.title))) plan.twins.push(n.title);
    } else if (old.h === n.h) plan.same++;
    else (localChanged(old) ? plan.conflicts : plan.update).push({ old, note: merged(old, n) });
  }
  plan.gone = notes.filter(n => n.src === 'vault' && n.path && !seen.has(norm(n.path)));
  // Links that point nowhere once this import is done.
  const changed = new Map([...plan.update, ...plan.conflicts].map(u => [u.old.id, u.note]));
  const after = [...notes.map(n => changed.get(n.id) || n), ...plan.add];
  const r = makeResolver(after, [...db.getRaw(ctx, 'vatt', []) || [], ...plan.atts.map(a => a.path)]);
  for (const n of [...plan.add, ...plan.update.map(u => u.note)]) {
    for (const l of linkTargets(n.body)) {
      const isFile = l.embed && FILE_EXT.test(l.t) || FILE_EXT.test(l.t);
      if (isFile ? !r.att(l.t, n.path) : !r.note(l.t, n.path) && !(l.embed && r.att(l.t, n.path))) plan.unresolved.push({ from: n.title, id: n.id, t: l.t });
    }
  }
  return plan;
}

const ATT_DB = { name: 'ki-apps-vault', store: 'files' };
export const ATT_STORE = ATT_DB;

// Writes the preview: notes in one go (all or nothing), then the attachments.
export async function applyVault(ctx, plan, files, { record = true } = {}) {
  if (db.isDemo(ctx)) throw new Error(DEMO_NO_IMPORT);
  const today = ds(ctx.now()), byId = new Map(db.list(ctx, 'note').map(n => [n.id, n]));
  for (const n of plan.add) byId.set(n.id, { ...n, created: n.created || today, upd: today });
  for (const u of plan.update) byId.set(u.old.id, { ...u.note, upd: today });
  const out = [...byId.values()].map(n => cleanItem('note', n)).filter(Boolean);
  if (!db.setRaw(ctx, 'notes', out)) {
    const mb = (JSON.stringify(out).length / 1048576).toFixed(1).replace('.', ',');
    throw new Error(`Der Vault passt nicht in den Speicher dieser App auf diesem Gerät (zusammen ${mb} MB Text). Nichts wurde gespeichert – importiere einzelne Ordner als ZIP.`);
  }
  const index = new Set(db.getRaw(ctx, 'vatt', []) || []);
  let attWritten = 0, attFailed = 0;
  for (const a of plan.atts) {
    try {
      if (!files) throw new Error('no store');
      await files.put(a.path, new Blob([a.bytes], { type: a.type }));
      index.add(a.path);
      attWritten++;
    } catch (e) { attFailed++; }
  }
  db.setRaw(ctx, 'vatt', [...index].sort());
  db.setRaw(ctx, 'vault', { name: plan.name, at: today, file: plan.file });
  if (record) db.upsert(ctx, 'import', { kind: 'vault', file: plan.file, at: today, n: plan.add.length + plan.update.length });
  return { added: plan.add.length, updated: plan.update.length, same: plan.same, conflicts: plan.conflicts.length, attWritten, attFailed };
}

// "Fassung aus dem Vault übernehmen" for one note that was changed on both sides.
export function takeConflict(ctx, plan, id) {
  const i = plan.conflicts.findIndex(c => c.old.id === id);
  if (i < 0) return false;
  const saved = db.upsert(ctx, 'note', { ...plan.conflicts[i].note, id });
  if (!saved) return false;
  plan.conflicts.splice(i, 1);
  return true;
}

// Takes out what came from the vault; notes written in Life OS stay.
export async function removeVault(ctx, files) {
  const notes = db.list(ctx, 'note'), keep = notes.filter(n => n.src !== 'vault');
  if (!db.setRaw(ctx, 'notes', keep)) throw new Error(STORAGE_FAILED);
  for (const k of ['vatt', 'vault']) ctx.store.remove((db.isDemo(ctx) ? 'demo.cx.' : 'cx.') + k);
  if (files) { try { await files.clear(); } catch (e) { /* stays until the next import */ } }
  return notes.length - keep.length;
}

// Opening a blob in a new tab gives it this app's origin: anything that could run
// script there (SVG) opens as plain text instead. PDFs and pictures open as they are.
export const openable = blob => (/svg|html|xml|javascript/i.test(blob.type || '') ? new Blob([blob], { type: 'text/plain' }) : blob);
