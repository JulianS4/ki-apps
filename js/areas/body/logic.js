// Pure body logic: reading German input, cleaning stored data, series for
// the curves and the quarter check.
import { FIELDS, MEASURES, POSES, QUARTER_ITEMS } from './data.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const r1 = n => Math.round(n * 10) / 10;
const LOG_FIELDS = FIELDS.filter(f => f.id !== 'kg');
const inRange = (f, v) => isNum(v) && v >= f.min && v <= f.max;

// "92,4", " 92.4 " → 92.4; anything else → null.
export function parseNum(s) {
  const t = String(s ?? '').trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? r1(+t) : null;
}
// "23:45" → 1425 s, "45" → 45 s; seconds must stay below 60.
export function parseTime(s) {
  const t = String(s ?? '').trim(), m = /^(\d{1,3}):(\d{2})$/.exec(t);
  if (m) return +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
  return /^\d{1,4}$/.test(t) ? +t : null;
}
export const fmtTime = sec => { const s = Math.round(sec); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const fmtNum = n => String(r1(n)).replace('.', ',');

// The whole form or nothing: the first invalid field names its range.
export function checkForm(raw) {
  const r = isObj(raw) ? raw : {}, values = {};
  for (const f of FIELDS) {
    const s = String(r[f.id] ?? '').trim();
    if (!s) { values[f.id] = null; continue; }
    const v = f.time ? parseTime(s) : parseNum(s);
    if (v === null || !inRange(f, v)) return { ok: false, error: `${f.label}: ${f.hint}` };
    values[f.id] = v;
  }
  values.mob = String(r.mob ?? '').trim() || null;
  return { ok: true, values };
}

// Stored data is checked on every read; these always return fresh copies.
export function cleanWeights(raw) {
  const out = {}, kg = FIELDS[0];
  if (isObj(raw)) for (const [d, v] of Object.entries(raw)) if (isDay(d) && inRange(kg, v)) out[d] = v;
  return out;
}
export function cleanLog(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [d, e] of Object.entries(raw)) {
    if (!isDay(d) || !isObj(e)) continue;
    const x = {};
    for (const f of LOG_FIELDS) if (inRange(f, e[f.id])) x[f.id] = e[f.id];
    if (typeof e.mob === 'string' && e.mob.trim()) x.mob = e.mob;
    if (Object.keys(x).length) out[d] = x;
  }
  return out;
}
export function cleanPhotos(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [d, e] of Object.entries(raw)) {
    if (!isDay(d) || !isObj(e)) continue;
    const x = {};
    for (const p of POSES) if (e[p.id] === true) x[p.id] = true;
    if (Object.keys(x).length) out[d] = x;
  }
  return out;
}
export function cleanTicks(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [q, e] of Object.entries(raw)) {
    if (!/^\d{4}-Q[1-4]$/.test(q) || !isObj(e)) continue;
    const x = {};
    for (const i of QUARTER_ITEMS) if (e[i.id] === true) x[i.id] = true;
    out[q] = x;
  }
  return out;
}

// Every date with a weight or a value, newest first.
export function measureDays(weights, log) {
  return [...new Set([...Object.keys(cleanWeights(weights)), ...Object.keys(cleanLog(log))])].sort().reverse();
}
// One value over time, oldest first.
export function series(weights, log, id) {
  const pts = id === 'kg'
    ? Object.entries(cleanWeights(weights)).map(([date, y]) => ({ date, y }))
    : Object.entries(cleanLog(log)).filter(([, x]) => isNum(x[id])).map(([date, x]) => ({ date, y: x[id] }));
  return pts.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export const quarterOf = day => `${day.slice(0, 4)}-Q${Math.floor((+day.slice(5, 7) - 1) / 3) + 1}`;

// An entry counts for the quarter of its own date; a hand tick adds to it.
export function quarterStatus(q, { weights, log, photos, ticks } = {}) {
  const inQ = d => quarterOf(d) === q, l = Object.entries(cleanLog(log)).filter(([d]) => inQ(d)).map(([, x]) => x);
  const has = {
    weight: Object.keys(cleanWeights(weights)).some(inQ),
    photos: Object.keys(cleanPhotos(photos)).some(inQ),
    measures: l.some(x => MEASURES.some(m => m in x)),
    mob: l.some(x => 'mob' in x), run5k: l.some(x => 'run5k' in x), hang: l.some(x => 'hang' in x),
  };
  const hand = cleanTicks(ticks)[q] || {};
  const items = QUARTER_ITEMS.map(i => {
    const auto = !!(i.auto && has[i.id]), h = hand[i.id] === true;
    return { ...i, auto, hand: h, done: auto || h };
  });
  return { items, done: items.filter(i => i.done).length, total: items.length };
}
