// Pure routine logic: shifted times per weekday, the step that is on now,
// and progress counting ticked and linked steps.
import { dayIdx, addDays } from '../../core/dates.js';
import { MORNING, EVENING } from './data.js';

const noon = day => new Date(day + 'T12:00:00');
const mins = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const p2 = n => String(n).padStart(2, '0');

export const shiftTime = (hhmm, min) => { const t = mins(hhmm) + min; return p2(Math.floor(t / 60) % 24) + ':' + p2(t % 60); };

// Morning +1 h on Sa/So, evening +1 h on Fr/Sa. `until` is when a step ends:
// its own end, else the next step's start; the last step lasts one minute.
export function routineFor(kind, day) {
  const i = dayIdx(noon(day)), late = kind === 'morgen' ? i >= 5 : i === 4 || i === 5;
  const base = kind === 'morgen' ? MORNING : EVENING, sh = late ? 60 : 0;
  const steps = base.map(s => ({ ...s, from: shiftTime(s.from, sh), ...(s.to ? { to: shiftTime(s.to, sh) } : {}) }));
  return steps.map((s, k) => ({ ...s, until: s.to || (steps[k + 1] ? steps[k + 1].from : shiftTime(s.from, 1)) }));
}

export function activeStep(day, hhmm) {
  for (const kind of ['morgen', 'abend']) {
    const steps = routineFor(kind, day), k = steps.findIndex(s => s.from <= hhmm && hhmm < s.until && s.from < s.until);
    if (k >= 0) return { kind, step: steps[k], next: steps[k + 1] || null };
  }
  const m = routineFor('morgen', day)[0].from, a = routineFor('abend', day)[0].from;
  if (hhmm < m) return { kind: null, upcoming: { kind: 'morgen', day, from: m } };
  if (hhmm < a) return { kind: null, upcoming: { kind: 'abend', day, from: a } };
  const t = addDays(day, 1);
  return { kind: null, upcoming: { kind: 'morgen', day: t, from: routineFor('morgen', t)[0].from } };
}

// Linked steps (mobility, supplements) count from the area that owns them.
export function progress(steps, ticks, linked) {
  const t = ticks || {}, l = linked || {};
  const done = steps.filter(s => (s.link === 'mobility' || s.link === 'supps' ? l[s.link] === true : t[s.id] === true)).length;
  return { done, total: steps.length };
}
