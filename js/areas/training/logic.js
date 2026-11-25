// Training logic without DOM access. Ported from hybrid-training@90dc751;
// the former globals (plan, sess, selD, PR) are parameters now.
import { E, UNIT } from './plan-default.js';

export const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
export const fmtN = n => String(Math.round(n * 100) / 100).replace('.', ',');
export const okSets = a => (a || []).filter(x => x && x.ok);

export function fmtSets(arr, ex) {
  const ok = okSets(arr);
  if (!ok.length) return '';
  const v = ex.unit === 'check' ? ok.length + ' ✓' : ok.map(x => x.v || '–').join(' · ') + (ex.unit === 'reps' ? '' : ' ' + UNIT[ex.unit]);
  const ws = ok.map(x => x.w).filter(Boolean);
  return v + (ws.length && ex.load ? ' @ ' + [...new Set(ws)].map(w => String(w).replace('.', ',')).join('/') + ' ' + ex.load : '');
}

export const target = ex => ex.unit === 'check'
  ? ex.sets + ' ×'
  : ex.sets + ' × ' + (ex.min === ex.max ? ex.min : ex.min + '–' + ex.max) + ' ' + UNIT[ex.unit] + (ex.per ? ' ' + ex.per : '');

/* which sets can be a record: reps/sec, with or without kg; minutes and check-only never */
export const prKind = ex => ex.unit === 'reps' || ex.unit === 'sec' ? (ex.load === 'kg' ? 'wv' : 'v') : null;

export function exDef(plan, sess, id) {
  for (const d of plan.days) for (const b of d.blocks) for (const ex of b.ex) if (ex.id === id) return ex;
  const s = Object.values(sess).find(s => s.sets && s.sets[id]);
  return E(id, (s && s.n && s.n[id]) || id, 'core', 3, 0, 0, { load: s && okSets(s.sets[id]).some(x => x.w) ? 'kg' : '' });
}

const tFirst = s => Math.min(Infinity, ...Object.values(s.sets || {}).flat().filter(x => x && x.t).map(x => x.t));
export const exHist = (sess, id) => Object.values(sess)
  .filter(s => s.sets && okSets(s.sets[id]).length)
  .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (tFirst(a) - tFirst(b)) || 0);

export function lastFor(sess, exId, cutoff) {
  const list = Object.values(sess)
    .filter(s => s.date < cutoff && s.sets && s.sets[exId] && s.sets[exId].some(x => x && x.ok))
    .sort((a, b) => b.date < a.date ? -1 : 1);
  return list[0] ? list[0].sets[exId] : null;
}

/* Which date a plan day logs into: the date picked in the day view,
   else this week's existing session of that day, else today. */
export function dateOf(sess, dayId, selD, todayStr, mondayStr) {
  if (selD[dayId]) return selD[dayId];
  const f = Object.values(sess)
    .filter(s => s.day === dayId && s.date >= mondayStr && s.date <= todayStr)
    .sort((a, b) => a.date < b.date ? 1 : -1)[0];
  return f ? f.date : todayStr;
}

export function totals(day, session) {
  let t = 0, o = 0;
  day.blocks.forEach(b => b.ex.forEach(ex => {
    t += +ex.sets;
    const a = session && session.sets[ex.id];
    if (a) o += a.slice(0, ex.sets).filter(x => x && x.ok).length;
  }));
  return { t, o };
}

export const weekDone = (sess, dayId, mondayStr) => Object.values(sess).some(s =>
  s.day === dayId && s.date >= mondayStr &&
  s.sets && Object.values(s.sets).some(a => a.some(x => x && x.ok)));

/* A set is a record when no earlier set beats or ties it on both weight and reps.
   The first session of an exercise is the baseline and never counts. */
export function prScan(sess, ex) {
  const k = prKind(ex), marks = new Map();
  let front = [], count = 0;
  if (!k) return { marks, front, count };
  const beaten = p => front.some(q => q.w >= p.w && q.v >= p.v);
  exHist(sess, ex.id).forEach(s => {
    const base = front.length > 0, fl = [];
    s.sets[ex.id].forEach((x, i) => {
      if (!x || !x.ok) return;
      const p = { w: k === 'wv' ? num(x.w) : 0, v: num(x.v), date: s.date };
      if (p.v <= 0 || beaten(p)) return;
      if (base) { fl[i] = k === 'wv' && p.w > 0 && front.every(q => q.w < p.w) ? 'w' : 'v'; count++; }
      front = front.filter(q => !(p.w >= q.w && p.v >= q.v)).concat([p]);
    });
    if (fl.length) marks.set(s, fl);
  });
  return { marks, front, count };
}

export function computePRs(sess, plan) {
  const out = new Map(), ids = new Set();
  Object.values(sess).forEach(s => s.sets && Object.keys(s.sets).forEach(id => ids.add(id)));
  ids.forEach(id => prScan(sess, exDef(plan, sess, id)).marks.forEach((fl, s) => {
    if (!out.has(s)) out.set(s, {});
    out.get(s)[id] = fl;
  }));
  return out;
}
export const prOf = (prMap, s, id) => (s && prMap.get(s) && prMap.get(s)[id]) || [];
export const prCount = (prMap, s) => { const o = prMap.get(s); return o ? Object.values(o).reduce((a, f) => a + f.filter(Boolean).length, 0) : 0; };
export const prText = (ex, x) => { const v = fmtN(num(x.v)) + ' ' + UNIT[ex.unit], w = num(x.w); return w > 0 ? fmtN(w) + ' kg × ' + v : v; };

export function metrics(sess, ex) {
  if (ex.unit === 'check') return [];
  const U = UNIT[ex.unit], ms = [];
  const hasW = !!ex.load && exHist(sess, ex.id).some(s => okSets(s.sets[ex.id]).some(x => num(x.w) > 0));
  if (hasW) ms.push({ k: 'w', label: ex.load === 'km' ? 'Strecke' : 'Gewicht', unit: ex.load });
  else if (ex.unit !== 'min') ms.push({ k: 'best', label: ex.unit === 'sec' ? 'Längster Satz' : 'Bester Satz', unit: U });
  ms.push({ k: 'sum', label: ex.unit === 'reps' ? 'Wdh gesamt' : ex.unit === 'sec' ? 'Sekunden gesamt' : 'Minuten', unit: U });
  return ms;
}

export const series = (sess, id, k) => exHist(sess, id).map(s => {
  const a = okSets(s.sets[id]);
  return {
    s, date: s.date,
    y: k === 'w' ? Math.max(0, ...a.map(x => num(x.w))) : k === 'best' ? Math.max(0, ...a.map(x => num(x.v))) : a.reduce((t, x) => t + num(x.v), 0),
  };
});

export function ticks(lo, hi, minStep) {
  const s0 = (hi - lo) / 4, mag = 10 ** Math.floor(Math.log10(s0));
  const st = Math.max(minStep, [1, 2, 2.5, 5, 10].find(f => f * mag >= s0) * mag), t = [];
  for (let v = Math.floor(lo / st) * st; v <= Math.ceil(hi / st) * st + st / 2; v += st) t.push(Math.round(v * 1e6) / 1e6);
  return t;
}
