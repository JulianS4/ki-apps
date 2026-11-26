// Pure arena logic: points, the Berlin day, weeks and history, which days can
// still change, Julian's suggestions, and the invite / config formats.
import { PLAYERS } from './data.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

// Points: shown with one decimal, summed unrounded.
export const fmt1 = n => String(Math.round(n * 10) / 10).replace('.', ',');
export function taskPoints(task, value) {
  if (task.kind === 'yes') return value === true ? 1 : 0;
  return isNum(value) && value >= 0 && task.goal > 0 ? value / task.goal : 0;
}
export function dayPoints(tasks, values) {
  const v = isObj(values) ? values : {}, points = {};
  let total = 0;
  for (const t of tasks) {
    if (!(t.id in v)) continue;
    points[t.id] = taskPoints(t, v[t.id]);
    total += points[t.id];
  }
  return { points, total };
}

export function cleanTasks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(t => isObj(t) && typeof t.id === 'string' && t.id && typeof t.name === 'string'
    && (t.kind === 'yes' || (t.kind === 'value' && isNum(t.goal) && t.goal > 0)))
    .map(t => ({
      id: t.id, name: t.name, kind: t.kind,
      ...(t.kind === 'value' ? { goal: t.goal, unit: typeof t.unit === 'string' ? t.unit : '' } : {}),
      ...(typeof t.hint === 'string' ? { hint: t.hint } : {}),
      order: isNum(t.order) ? t.order : 0, archived: t.archived === true,
    }))
    .sort((a, b) => a.order - b.order);
}

// The arena's day ends at midnight in Germany, wherever the phone is.
const BERLIN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
export const berlinDay = (d = new Date()) => BERLIN.format(d);

// Day strings are computed at noon UTC, so no daylight-saving jumps.
const utc = day => new Date(day + 'T12:00:00Z');
export function plusDays(day, n) {
  const d = utc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const mondayOf = day => plusDays(day, -((utc(day).getUTCDay() + 6) % 7));
export const weekDays = monday => [0, 1, 2, 3, 4, 5, 6].map(i => plusDays(monday, i));
export function isoWeek(day) {
  const thu = utc(plusDays(mondayOf(day), 3)), year = thu.getUTCFullYear();
  return { year, week: Math.floor((thu - utc(`${year}-01-01`)) / 864e5 / 7) + 1 };
}

// Today and yesterday; in the start week also every day of it, for Notion values.
export function editable(day, today, start) {
  if (!isDay(day) || day > today) return false;
  if (day === today || day === plusDays(today, -1)) return true;
  const sm = isDay(start) ? mondayOf(start) : null;
  return !!sm && mondayOf(today) === sm && day >= sm;
}

const cleanDays = days => (Array.isArray(days) ? days : []).filter(d => isObj(d) && d.player in PLAYERS && isDay(d.date) && isNum(d.total));
export function weekSums(days, monday) {
  const wk = new Set(weekDays(monday)), sum = { julian: 0, uygar: 0 };
  for (const d of cleanDays(days)) if (wk.has(d.date)) sum[d.player] += d.total;
  // Equal points are a tie, even when 0,7 + 0,2 sums to 0.8999999999999999.
  const d = sum.julian - sum.uygar, tie = Math.abs(d) < 1e-9;
  return { julian: sum.julian, uygar: sum.uygar, leader: tie ? null : d > 0 ? 'julian' : 'uygar', diff: tie ? 0 : Math.abs(d) };
}
// Weeks from the start week to the current one, newest first.
export function history(days, start, today) {
  const out = [], first = mondayOf(isDay(start) ? start : today);
  for (let m = mondayOf(today), n = 0; m >= first && n < 1000; m = plusDays(m, -7), n++) {
    const s = weekSums(days, m), w = isoWeek(m);
    out.push({ year: w.year, week: w.week, monday: m, julian: s.julian, uygar: s.uygar, winner: s.leader });
  }
  return out;
}
// All points so far; only finished weeks count as wins.
export function totalsSince(days, today) {
  const all = cleanDays(days), sum = { julian: 0, uygar: 0 }, wins = { julian: 0, uygar: 0 };
  for (const d of all) sum[d.player] += d.total;
  const start = all.reduce((a, d) => (d.date < a ? d.date : a), today);
  for (const w of history(all, start, today)) if (w.monday < mondayOf(today) && w.winner) wins[w.winner]++;
  return { ...sum, wins };
}

export function suggest({ sleepH, clean, water, sets } = {}) {
  return {
    health: isNum(sleepH) && sleepH >= 8 && clean === true && isNum(water) && water >= 3000,
    training: isNum(sets) && sets >= 1,
  };
}

// Firebase config: JSON, or the object literal the console shows.
const REQ = ['apiKey', 'authDomain', 'projectId', 'appId'];
function checkCfg(o) {
  if (!isObj(o)) return null;
  const out = {};
  for (const [k, v] of Object.entries(o)) if (typeof v === 'string' && /^[A-Za-z]\w*$/.test(k)) out[k] = v;
  return REQ.every(k => out[k]) ? out : null;
}
export function parseConfig(text) {
  const t = String(text ?? '');
  try { const j = JSON.parse(t); if (isObj(j)) return checkCfg(j); } catch (e) { /* not JSON */ }
  const o = {};
  for (const m of t.matchAll(/(\w+)\s*:\s*["']([^"']*)["']/g)) o[m[1]] = m[2];
  return checkCfg(o);
}

const toB64u = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64u = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)), c => c.charCodeAt(0));
export const randomId = bytes => toB64u(crypto.getRandomValues(new Uint8Array(bytes)));

// The access a device holds; an invite carries the same minus `keys`.
const okKey = k => typeof k === 'string' && k.length >= 32;
export function cleanConn(raw) {
  if (!isObj(raw)) return null;
  const cfg = checkCfg(raw.cfg);
  if (!cfg || typeof raw.code !== 'string' || !/^[A-Za-z0-9_-]{22,}$/.test(raw.code) || !(raw.player in PLAYERS) || !okKey(raw.key)) return null;
  const out = { cfg, code: raw.code, player: raw.player, key: raw.key };
  if (isObj(raw.keys) && okKey(raw.keys.julian) && okKey(raw.keys.uygar)) out.keys = { julian: raw.keys.julian, uygar: raw.keys.uygar };
  return out;
}
export const encodeInvite = c => toB64u(new TextEncoder().encode(JSON.stringify({ cfg: c.cfg, code: c.code, player: c.player, key: c.key })));
export function decodeInvite(text) {
  const t = String(text ?? '').trim(), m = /einladung\?([A-Za-z0-9_-]+)/.exec(t), token = m ? m[1] : t;
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const c = cleanConn(JSON.parse(new TextDecoder().decode(fromB64u(token))));
    return c ? { cfg: c.cfg, code: c.code, player: c.player, key: c.key } : null;
  } catch (e) { return null; }
}
