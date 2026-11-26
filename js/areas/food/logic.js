// Pure nutrition logic: protein target, dish suggestions, totals, the clean-day
// streak, due supplements and the training-day hints from Recovery.
import { DAYS, dayIdx, addDays } from '../../core/dates.js';
import { WEEK_ROUTINE } from '../../core/schedule.js';
import { SLOT_ORDER, LAST_MEAL } from './data.js';
export { slug } from '../../core/html.js';

const noon = day => new Date(day + 'T12:00:00');
const mins = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const isNum = v => typeof v === 'number' && Number.isFinite(v);

// Newest plausible weight (30–250 kg) on a real 'YYYY-MM-DD' key.
export function latestWeight(weights) {
  const ok = Object.entries(weights && typeof weights === 'object' ? weights : {})
    .filter(([d, kg]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && isNum(kg) && kg >= 30 && kg <= 250)
    .sort(([a], [b]) => (a < b ? 1 : -1));
  return ok.length ? { date: ok[0][0], kg: ok[0][1] } : null;
}

export const proteinTarget = kg => Math.round(2 * kg);

export const slotAt = hhmm => (hhmm < '10:30' ? 'fr' : hhmm < '14:30' ? 'mi' : hhmm < '17:00' ? 'sn' : 'ab');

const weekend = day => dayIdx(noon(day)) >= 5;
const fits = (d, day) => d.days === 'all' || (d.days === 'we') === weekend(day);

// Dishes for now (slot and weekday) first; everything else in slot order.
export function suggestions(dishes, day, hhmm) {
  const slot = slotAt(hhmm), now = dishes.filter(d => d.slot === slot && fits(d, day));
  const rest = dishes.filter(d => !now.includes(d)).sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  return { now, rest };
}

export function foodTotals(entry) {
  const meals = entry && Array.isArray(entry.meals) ? entry.meals : [];
  return { protein: meals.reduce((a, m) => a + (m && isNum(m.g) ? m.g : 0), 0), water: entry && isNum(entry.water) ? entry.water : 0 };
}

export const isLate = t => t > LAST_MEAL;

// Clean days in a row. Today only counts once decided; while it is open the
// streak runs up to yesterday. A broken or missing day ends it.
export function cleanStreak(days, today) {
  const all = days || {}, t = all[today];
  if (t && t.clean === false) return 0;
  let d = t && t.clean === true ? today : addDays(today, -1), n = 0;
  while (all[d] && all[d].clean === true && n < 10000) { n++; d = addDays(d, -1); }
  return n;
}

export const dueGroup = hhmm => (hhmm < '11:00' ? 'morgens' : hhmm < '17:00' ? 'mittags' : 'abends');

const TRAINING = /^(.+ Training|Joggen|Athlete Day)$/;
export function trainingBlock(day) {
  const b = WEEK_ROUTINE[DAYS[dayIdx(noon(day))]].find(x => TRAINING.test(x.title));
  return b ? { start: b.start, end: b.end, title: b.title } : null;
}

// "Kohlenhydrat-Snack, wenn das Mittagessen länger als 3 h her ist":
// in the 2 h before training, when nothing was eaten in the 3 h before it.
export function snackHint(day, hhmm, meals) {
  const b = trainingBlock(day);
  if (!b) return false;
  const s = mins(b.start), t = mins(hhmm);
  if (t < s - 120 || t >= s) return false;
  return !(meals || []).some(m => m && m.t && mins(m.t) >= s - 180 && mins(m.t) <= t);
}

// "Abendessen 30–40 g Protein + Kohlenhydrate" after training, until 19:00.
export function dinnerHint(day, hhmm, meals) {
  const b = trainingBlock(day);
  if (!b || hhmm < b.end || hhmm > LAST_MEAL) return false;
  return !(meals || []).some(m => m && m.slot === 'ab');
}

export const mealprepDay = day => [2, 6].includes(dayIdx(noon(day)));
