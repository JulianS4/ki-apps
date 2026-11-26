// Cockpit storage on top of the app store: real data under 'cx.', the example
// set under 'demo.cx.' (never mixed, never in the app backup).
import { ds } from '../../core/dates.js';
import { SCHEMAS, cleanItem } from './schema.js';
import { DEFAULT_CATS, DEFAULT_PROJECTS, demoData } from './data.js';
import { uid } from './logic.js';
import { STORAGE_FAILED } from '../../core/backup.js';

export const isDemo = ctx => ctx.store.get('cx.demo') === true;
const pre = ctx => (isDemo(ctx) ? 'demo.cx.' : 'cx.');
export const getRaw = (ctx, k, fb = null) => ctx.store.get(pre(ctx) + k, fb);
export const setRaw = (ctx, k, v) => ctx.store.set(pre(ctx) + k, v);
const DEFAULTS = { cat: DEFAULT_CATS, project: DEFAULT_PROJECTS };

export function list(ctx, name) {
  const raw = getRaw(ctx, SCHEMAS[name].key);
  const arr = Array.isArray(raw) ? raw : DEFAULTS[name] || [];
  const seen = new Set();
  return arr.map(x => cleanItem(name, x)).filter(x => x && !seen.has(x.id) && seen.add(x.id));
}
export const find = (ctx, name, id) => list(ctx, name).find(x => x.id === id) || null;

// Adds or replaces by id; an account keeps one balance point per day.
export function upsert(ctx, name, item) {
  const items = list(ctx, name), id = item.id || uid(), old = items.find(x => x.id === id);
  const next = { src: 'manuell', ...item, id, upd: ds(ctx.now()) };
  if (name === 'note') next.created = (old && old.created) || item.created || ds(ctx.now());
  if (name === 'account') {
    const hist = ((old && old.hist) || item.hist || []).filter(p => p.d !== next.asOf);
    next.hist = [...hist, { d: next.asOf, c: next.bal }].sort((a, b) => (a.d < b.d ? -1 : 1));
    // An older balance fills in the history; the newest stays the current one.
    const last = next.hist[next.hist.length - 1];
    next.bal = last.c;
    next.asOf = last.d;
  }
  const c = cleanItem(name, next);
  if (!c) return null;
  const out = old ? items.map(x => (x.id === id ? c : x)) : [...items, c];
  return setRaw(ctx, SCHEMAS[name].key, out) ? c : null;
}
export function remove(ctx, name, id) {
  return setRaw(ctx, SCHEMAS[name].key, list(ctx, name).filter(x => x.id !== id));
}

export function budgets(ctx) {
  const raw = getRaw(ctx, 'budgets'), out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw)) if (Number.isInteger(v) && v > 0) out[k] = v;
  return out;
}
export function setBudget(ctx, cat, c) {
  const b = budgets(ctx);
  if (Number.isInteger(c) && c > 0) b[cat] = c; else delete b[cat];
  return setRaw(ctx, 'budgets', b);
}

export function startDemo(ctx, today) {
  endDemo(ctx);
  for (const [k, v] of Object.entries(demoData(today))) ctx.store.set('demo.cx.' + k, v);
  ctx.store.set('cx.demo', true);
}
export function endDemo(ctx) {
  for (const k of ctx.store.keys()) if (k.startsWith('demo.cx.')) ctx.store.remove(k);
  ctx.store.remove('cx.demo');
}

// Deletes the real cockpit entries; the rest of KI-Apps stays.
export function wipe(ctx) {
  let n = 0;
  for (const k of ctx.store.keys()) if (k.startsWith('cx.') && k !== 'cx.demo') { ctx.store.remove(k); n++; }
  return n;
}

const NAMES = Object.keys(SCHEMAS).filter(n => n !== 'import');
export function exportData(ctx, iso) {
  const data = { budgets: budgets(ctx) };
  for (const n of NAMES) data[SCHEMAS[n].key] = list(ctx, n);
  return { app: 'ki-cockpit', v: 1, exported: iso, demo: isDemo(ctx), data };
}

// Merges a ki-cockpit file by id. Examples never enter real data.
export function importData(ctx, obj, file, today) {
  if (!obj || obj.app !== 'ki-cockpit' || !obj.data || typeof obj.data !== 'object') throw new Error('Keine gültige Cockpit-Datei');
  const demo = isDemo(ctx);
  if (obj.demo === true && !demo) throw new Error('Diese Datei stammt aus dem Beispielmodus und wird nicht übernommen.');
  let n = 0;
  for (const name of NAMES) {
    const arr = obj.data[SCHEMAS[name].key];
    if (!Array.isArray(arr)) continue;
    const byId = new Map(list(ctx, name).map(x => [x.id, x]));
    for (const raw of arr) {
      if (!raw || (raw.src === 'beispiel' && !demo)) continue;
      const c = cleanItem(name, { ...raw, src: ['manuell', 'csv', 'beispiel'].includes(raw.src) ? raw.src : 'import' });
      if (c) { byId.set(c.id, c); n++; }
    }
    if (!setRaw(ctx, SCHEMAS[name].key, [...byId.values()])) throw new Error(STORAGE_FAILED);
  }
  const b = obj.data.budgets;
  if (b && typeof b === 'object') for (const [k, v] of Object.entries(b)) if (Number.isInteger(v) && v > 0) setBudget(ctx, k, v);
  upsert(ctx, 'import', { kind: 'json', file: String(file || '').slice(0, 120), at: today, n });
  return { n };
}
