// Julian's Week Routine (Notion, Stand 24.11.2026) and "what's on now / next".
import { DAYS, dayIdx } from './dates.js';

const B = (start, end, title) => ({ start, end, title });
const workday = training => [
  B('06:00', '07:00', 'Morgenroutine'),
  B('07:00', '07:15', 'Zur Arbeit fahren'),
  B('07:15', '16:00', 'Arbeit + Frühstück, Supps & Mittag'),
  B('16:00', '16:15', 'Heimfahrt'),
  ...training,
];
const evening = (dw, routine, sleep) => [dw, B(routine, sleep, 'Abendroutine'), B(sleep, sleep === '21:30' ? '06:00' : '07:00', 'Schlafen')];
const strength = (name, dwEnd = '20:30', routine = '20:30', sleep = '21:30') => workday([
  B('16:15', '17:45', name + ' Training'),
  ...evening(B('17:45', dwEnd, 'Deep Work + Abendessen & Supps'), routine, sleep),
]);

export const WEEK_ROUTINE = {
  mo: strength('Lower A'),
  di: strength('Upper A'),
  mi: workday([
    B('16:15', '17:00', 'Joggen'),
    ...evening(B('17:00', '20:30', 'Recovery + Abendessen, Mealprep & Supps'), '20:30', '21:30'),
  ]),
  do: strength('Lower B'),
  fr: strength('Upper B', '21:30', '21:30', '22:30'),
  sa: [
    B('07:00', '08:00', 'Morgenroutine'),
    B('08:00', '14:30', 'Deep Work + Frühstück & Supps'),
    B('14:30', '15:00', 'Zum Training fahren'),
    B('15:00', '16:30', 'Athlete Day'),
    B('16:30', '21:00', 'Recovery + Freizeit'),
    B('21:00', '21:30', 'Heimfahrt'),
    B('21:30', '22:30', 'Abendroutine'),
    B('22:30', '07:00', 'Schlafen'),
  ],
  so: [
    B('07:00', '08:00', 'Morgenroutine'),
    B('08:00', '09:30', 'Recovery + Frühstück & Supps'),
    B('09:30', '11:30', 'Kirche'),
    B('12:00', '14:00', 'Sonntag Routine'),
    B('14:00', '20:00', 'Freizeit'),
    B('20:00', '20:30', 'Mealprep & Supplement-Prep'),
    B('20:30', '21:30', 'Abendroutine'),
    B('21:30', '06:00', 'Schlafen'),
  ],
};

const mins = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const crossesMidnight = b => mins(b.end) <= mins(b.start);

export function nowNext(date) {
  const t = date.getHours() * 60 + date.getMinutes();
  const i = dayIdx(date), day = DAYS[i], prev = DAYS[(i + 6) % 7], nextDay = DAYS[(i + 1) % 7];
  const todays = WEEK_ROUTINE[day];
  let now = WEEK_ROUTINE[prev].find(b => crossesMidnight(b) && t < mins(b.end)) || null;
  if (!now) now = todays.find(b => mins(b.start) <= t && t < (crossesMidnight(b) ? 1440 : mins(b.end))) || null;
  const later = todays.find(b => mins(b.start) > t);
  const next = later ? { ...later, day } : { ...WEEK_ROUTINE[nextDay][0], day: nextDay };
  return { now, next };
}
