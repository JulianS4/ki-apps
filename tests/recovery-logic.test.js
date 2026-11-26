import test from 'node:test';
import assert from 'node:assert/strict';
import { MOBILITY, AMPEL } from '../js/areas/recovery/data.js';
import {
  checkSum, ampel, plannedBed, hoursInBed, cycleInfo, mobilityFor,
  timerState, boxPhase, sundayOf, deloadTriggers,
  clockStart, clockElapsed, clockPause, clockResume,
} from '../js/areas/recovery/logic.js';
import { addDays } from '../js/core/dates.js';

test('checkSum is null until all three values exist', () => {
  assert.equal(checkSum({ schlaf: 4, energie: 3 }), null);
  assert.equal(checkSum(undefined), null);
  assert.equal(checkSum({ schlaf: 4, energie: 3, muskeln: 5 }), 12);
});

test('ampel thresholds', () => {
  assert.deepEqual([15, 12, 11, 9, 8, 3].map(s => ampel(s).key), ['gruen', 'gruen', 'gelb', 'gelb', 'rot', 'rot']);
  assert.equal(ampel(null), null);
  assert.equal(ampel(10).advice, 'Gewichte halten, 1 Wdh mehr im Tank, pro Übung 1 Isolationssatz weniger');
  assert.equal(ampel(10).label, AMPEL.gelb.label);
});

test('plannedBed uses the previous evening', () => {
  assert.deepEqual(plannedBed('2026-11-30'), { bed: '21:30', wake: '06:00' });
  assert.deepEqual(plannedBed('2026-11-28'), { bed: '22:30', wake: '07:00' });
  assert.deepEqual(plannedBed('2026-11-29'), { bed: '22:30', wake: '07:00' });
});

test('hoursInBed handles after-midnight bedtimes', () => {
  assert.equal(hoursInBed('21:30', '06:00'), 8.5);
  assert.equal(hoursInBed('23:15', '06:00'), 6.75);
  assert.equal(hoursInBed('00:30', '06:00'), 5.5);
});

test('cycleInfo follows the notion dates', () => {
  const a = cycleInfo('2026-11-25');
  assert.equal(a.week, 6);
  assert.equal(a.deload, false);
  assert.equal(a.goal, 'Peak');
  assert.equal(a.main, '1');
  assert.equal(a.nextDeload, '2026-11-30');
  const b = cycleInfo('2026-11-30');
  assert.equal(b.week, 7);
  assert.equal(b.deload, true);
  assert.equal(cycleInfo('2026-12-06').week, 7);
  const c = cycleInfo('2026-12-07');
  assert.equal(c.week, 1);
  assert.equal(c.nextDeload, '2027-01-18');
  assert.equal(cycleInfo('2027-01-18').deload, true);
});

test('cycleInfo with a moved anchor', () => {
  const a = cycleInfo('2026-11-25', '2026-11-30');
  assert.equal(a.week, 7);
  assert.equal(a.deload, true);
  assert.equal(cycleInfo('2026-11-30', '2026-11-30').week, 1);
});

test('mobilityFor by weekday', () => {
  assert.deepEqual(mobilityFor('2026-11-23'), { routine: 'B', name: 'Lower', minutes: 15, end: 900 });
  const di = mobilityFor('2026-11-24');
  assert.equal(di.routine, 'A');
  assert.equal(di.minutes, 15);
  assert.deepEqual(mobilityFor('2026-11-28'), { routine: 'B', name: 'Lower', minutes: 20, end: 1200 });
  assert.equal(mobilityFor('2026-11-29').routine, 'A');
});

test('timerState walks through the routine', () => {
  const s = MOBILITY.B.steps;
  const a = timerState(s, 900, 0);
  assert.equal(a.index, 0);
  assert.equal(a.left, 90);
  const b = timerState(s, 900, 575);
  assert.equal(b.index, 6);
  assert.equal(b.step.title, 'Pigeon Stretch');
  assert.equal(b.left, 115);
  assert.equal(b.total, 325);
  assert.equal(timerState(s, 900, 900).done, true);
  assert.equal(timerState(s, 900, 575).done, false);
  const c = timerState(s, 1200, 1000);
  assert.equal(c.index, 8);
  assert.equal(c.left, 200);
});

test('boxPhase cycles every 16 seconds', () => {
  assert.deepEqual(boxPhase(0), { phase: 'Einatmen', left: 4, n: 0 });
  assert.deepEqual(boxPhase(5), { phase: 'Halten', left: 3, n: 1 });
  assert.deepEqual(boxPhase(9), { phase: 'Ausatmen', left: 3, n: 2 });
  assert.deepEqual(boxPhase(13), { phase: 'Halten', left: 3, n: 3 });
  assert.deepEqual(boxPhase(16), { phase: 'Einatmen', left: 4, n: 0 });
});

test('sundayOf', () => {
  assert.equal(sundayOf('2026-11-25'), '2026-11-29');
  assert.equal(sundayOf('2026-11-29'), '2026-11-29');
});

const T = '2026-11-25';
const chk = (schlaf, energie, muskeln, puls = null) => ({ schlaf, energie, muskeln, bed: '21:30', wake: '06:00', puls });
const on = (r, key) => r.items.find(i => i.key === key).on;
const none = { morning: {}, complaints: [], flags: {} };

test('deloadTriggers: two red checks in 7 days', () => {
  const r = deloadTriggers({ ...none, morning: { '2026-11-20': chk(2, 3, 3), '2026-11-24': chk(3, 2, 2) } }, T);
  assert.equal(on(r, 'rot2'), true);
  const old = deloadTriggers({ ...none, morning: { '2026-11-20': chk(2, 3, 3), '2026-11-17': chk(3, 2, 2) } }, T);
  assert.equal(on(old, 'rot2'), false);
});

test('deloadTriggers: three bad nights', () => {
  const morning = { '2026-11-19': chk(2, 4, 4), '2026-11-22': chk(1, 4, 4), '2026-11-25': chk(2, 3, 3) };
  assert.equal(on(deloadTriggers({ ...none, morning }, T), 'schlaf3'), true);
  delete morning['2026-11-25'];
  assert.equal(on(deloadTriggers({ ...none, morning }, T), 'schlaf3'), false);
});

test('deloadTriggers: resting pulse up on 3 days', () => {
  const morning = {};
  for (let i = 0; i < 14; i++) morning[addDays(T, -i)] = chk(4, 4, 4, 50);
  assert.equal(on(deloadTriggers({ ...none, morning }, T), 'puls'), false);
  for (const d of ['2026-11-20', '2026-11-22', '2026-11-25']) morning[d].puls = 56;
  assert.equal(on(deloadTriggers({ ...none, morning }, T), 'puls'), true);
});

test('deloadTriggers: complaint older than 3 days', () => {
  const c = (start, resolved = null) => [{ id: 'x', place: 'Knie', level: 3, start, note: '', resolved }];
  assert.equal(on(deloadTriggers({ ...none, complaints: c('2026-11-22') }, T), 'schmerz'), true);
  assert.equal(on(deloadTriggers({ ...none, complaints: c('2026-11-23') }, T), 'schmerz'), false);
  assert.equal(on(deloadTriggers({ ...none, complaints: c('2026-11-22', '2026-11-24') }, T), 'schmerz'), false);
});

test('deloadTriggers: manual flags and suggestion', () => {
  const flags = { '2026-11-23': { leistung: true } };
  const one = deloadTriggers({ ...none, flags }, T);
  assert.equal(on(one, 'leistung'), true);
  assert.equal(on(one, 'stimmung'), false);
  assert.equal(one.count, 1);
  assert.equal(one.suggest, false);
  const two = deloadTriggers({ ...none, flags, morning: { '2026-11-20': chk(2, 3, 3), '2026-11-24': chk(3, 2, 2) } }, T);
  assert.equal(two.count, 2);
  assert.equal(two.suggest, true);
  assert.deepEqual(two.items.map(i => [i.key, i.auto]), [
    ['rot2', true], ['schlaf3', true], ['puls', true], ['schmerz', true], ['leistung', false], ['stimmung', false],
  ]);
  assert.equal(two.items[3].label, 'Gelenk- oder Sehnenschmerz > 3 Tage');
});

test('timer clock counts real time, also while the app was hidden', () => {
  const c = clockStart(1000);
  assert.equal(clockElapsed(c, 6000), 5);
});

test('timer clock stands still while paused', () => {
  let c = clockPause(clockStart(0), 10000);
  assert.equal(clockElapsed(c, 50000), 10);
  c = clockResume(c, 50000);
  assert.equal(clockElapsed(c, 53000), 13);
  assert.equal(clockPause(clockPause(c, 60000), 70000).pausedAt, 60000);
  assert.equal(clockResume(c, 90000), c);
});

// Review Focus 1: a day with only one or two of the three scores does not count.
test('deloadTriggers ignore incomplete morning checks', () => {
  const nights = { '2026-11-19': { schlaf: 2 }, '2026-11-22': { schlaf: 1 }, '2026-11-25': { schlaf: 2 } };
  assert.equal(on(deloadTriggers({ ...none, morning: nights }, T), 'schlaf3'), false);
  const morning = {};
  for (let i = 0; i < 14; i++) morning[addDays(T, -i)] = { puls: 50 };
  for (const d of ['2026-11-20', '2026-11-22', '2026-11-25']) morning[d] = { puls: 56 };
  assert.equal(on(deloadTriggers({ ...none, morning }, T), 'puls'), false);
});
