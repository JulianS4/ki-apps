// What the body areas report to the overview: today's training, recovery, nutrition,
// routines and body. Each one can be swapped (tests, or an area with a better summary),
// and the overview reads each on its own, so bad data in one never blanks the page.
import { ds, dayIdx } from '../core/dates.js';
import { DEF } from './training/plan-default.js';
import { totals } from './training/logic.js';
import { summary } from './recovery/index.js';
import { summary as foodSum } from './food/index.js';
import { summary as routSum } from './routines/index.js';
import { summary as bodySum } from './body/index.js';

// Computed here until the training area hands in its own summary.
export let trainingSummary = (store, now) => {
  const plan = store.get('train.plan') || DEF, day = plan.days[dayIdx(now)];
  const s = (store.get('train.sess', {}) || {})['s_' + ds(now) + '_' + day.id];
  const { t, o } = totals(day, s);
  return { name: day.name, type: day.type, done: o, total: t };
};
export const setTrainingSummary = fn => { trainingSummary = fn; };
export let recoverySummary = ctx => summary(ctx);
export const setRecoverySummary = fn => { recoverySummary = fn; };
export let foodSummary = ctx => foodSum(ctx);
export const setFoodSummary = fn => { foodSummary = fn; };
export let routinesSummary = ctx => routSum(ctx);
export const setRoutinesSummary = fn => { routinesSummary = fn; };
export let bodySummary = ctx => bodySum(ctx);
export const setBodySummary = fn => { bodySummary = fn; };
