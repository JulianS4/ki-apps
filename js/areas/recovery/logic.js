// Pure recovery logic: morning-check traffic light, bedtimes, deload cycle,
// mobility/breathing timers and the "Deload vorziehen?" triggers.
import { DAYS, dayIdx, addDays, monday, ds } from '../../core/dates.js';
import { WEEK_ROUTINE } from '../../core/schedule.js';
import { AMPEL, RIR, CYCLE_ANCHOR } from './data.js';

const noon = day => new Date(day + 'T12:00:00');
const mon = day => ds(monday(noon(day)));
export const daysBetween = (a, b) => Math.round((noon(b) - noon(a)) / 86400000);
const mins = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const isNum = v => typeof v === 'number' && Number.isFinite(v);

// Sum of the three 1–5 scores, or null while any of them is missing.
export function checkSum(e) {
  if (!e || ![e.schlaf, e.energie, e.muskeln].every(isNum)) return null;
  return e.schlaf + e.energie + e.muskeln;
}

export function ampel(sum) {
  if (sum == null) return null;
  const key = sum >= 12 ? 'gruen' : sum >= 9 ? 'gelb' : 'rot';
  return { key, ...AMPEL[key] };
}

// The night before `day`: the "Schlafen" block of the previous weekday.
export function plannedBed(day) {
  const prev = DAYS[(dayIdx(noon(day)) + 6) % 7];
  const b = WEEK_ROUTINE[prev].find(x => x.title === 'Schlafen');
  return { bed: b.start, wake: b.end };
}

export const hoursInBed = (bed, wake) => ((mins(wake) - mins(bed) + 1440) % 1440) / 60;

// 6 build weeks + 1 deload week, repeating from the anchor's Monday.
export function cycleInfo(day, anchor = CYCLE_ANCHOR) {
  const start = mon(day);
  const n = Math.floor(daysBetween(mon(anchor), start) / 7);
  const week = ((n % 7) + 7) % 7 + 1;
  const r = RIR[week - 1];
  return {
    week, deload: week === 7, main: r.main, iso: r.iso, goal: r.goal,
    start, nextDeload: addDays(start, 7 * (week === 7 ? 7 : 7 - week)),
  };
}

// Upper (A) on Di, Fr, So; Lower (B) otherwise. Saturday runs 20 minutes.
export function mobilityFor(day) {
  const i = dayIdx(noon(day)), routine = [1, 4, 6].includes(i) ? 'A' : 'B', minutes = i === 5 ? 20 : 15;
  return { routine, name: routine === 'A' ? 'Upper' : 'Lower', minutes, end: minutes * 60 };
}

// Where a guided routine stands `t` seconds after its start.
export function timerState(steps, end, t) {
  if (t >= end) return { index: steps.length - 1, step: steps[steps.length - 1], left: 0, total: 0, done: true };
  let index = 0;
  while (index + 1 < steps.length && steps[index + 1].at <= t) index++;
  const until = index + 1 < steps.length ? steps[index + 1].at : end;
  return { index, step: steps[index], left: until - t, total: end - t, done: false };
}

const PHASES = ['Einatmen', 'Halten', 'Ausatmen', 'Halten'];
export function boxPhase(t) {
  const s = Math.floor(t) % 16, n = Math.floor(s / 4);
  return { phase: PHASES[n], left: 4 - (s % 4), n };
}

// A real 'YYYY-MM-DD' calendar day (values from backups may be anything).
export const validDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && ds(noon(v)) === v;

export const sundayOf = day => addDays(day, 6 - dayIdx(noon(day)));

const median = xs => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const LABELS = [
  ['rot2', '2× Rot in 7 Tagen', true],
  ['schlaf3', '3 Nächte schlecht geschlafen', true],
  ['puls', 'Ruhepuls erhöht', true],
  ['schmerz', 'Gelenk- oder Sehnenschmerz > 3 Tage', true],
  ['leistung', 'Leistung 2 Einheiten in Folge gesunken', false],
  ['stimmung', 'Stimmung mehrere Tage im Keller', false],
];

// "Deload vorziehen?": suggest once two of the six signs are present.
export function deloadTriggers({ morning = {}, complaints = [], flags = {} }, today) {
  // Only complete checks count: a day with one or two scores is not a check yet.
  const last = n => Array.from({ length: n }, (_, i) => morning[addDays(today, -i)]).filter(e => checkSum(e) != null);
  const week = last(7);
  const pulses = last(14).map(e => e.puls).filter(isNum);
  // Median, not mean: the elevated days themselves must not lift the baseline.
  const base = pulses.length ? median(pulses) : null;
  const f = flags[mon(today)] || {};
  const on = {
    rot2: week.filter(e => { const s = checkSum(e); return s != null && s <= 8; }).length >= 2,
    schlaf3: week.filter(e => isNum(e.schlaf) && e.schlaf <= 2).length >= 3,
    puls: base != null && week.filter(e => isNum(e.puls) && e.puls >= base + 5).length >= 3,
    schmerz: complaints.some(c => !c.resolved && c.start && daysBetween(c.start, today) >= 3),
    leistung: !!f.leistung,
    stimmung: !!f.stimmung,
  };
  const items = LABELS.map(([key, label, auto]) => ({ key, label, on: on[key], auto }));
  const count = items.filter(i => i.on).length;
  return { items, count, suggest: count >= 2 };
}

// Timer clock: elapsed seconds come from wall-clock times, so a timer that
// was hidden or suspended is right again the moment it is looked at.
export const clockStart = now => ({ startedAt: now, pausedAt: null, pausedTotal: 0 });
export const clockElapsed = (c, now) => ((c.pausedAt ?? now) - c.startedAt - c.pausedTotal) / 1000;
export const clockPause = (c, now) => (c.pausedAt == null ? { ...c, pausedAt: now } : c);
export const clockResume = (c, now) => (c.pausedAt == null ? c : { ...c, pausedTotal: c.pausedTotal + now - c.pausedAt, pausedAt: null });
