import test from 'node:test';
import assert from 'node:assert/strict';
import { PACK, GRANDPA, GRANDPA_END, EVENING } from '../js/areas/routines/data.js';
import { shiftTime, routineFor, activeStep, progress } from '../js/areas/routines/logic.js';

const THU = '2026-11-26', FRI = '2026-11-27', SAT = '2026-11-28', SUN = '2026-11-29';

test('shiftTime', () => {
  assert.equal(shiftTime('06:00', 60), '07:00');
  assert.equal(shiftTime('21:28', 60), '22:28');
  assert.equal(shiftTime('06:55', 5), '07:00');
});

test('times shift on weekends and fridays', () => {
  assert.equal(routineFor('morgen', THU)[0].from, '06:00');
  assert.equal(routineFor('morgen', SAT)[0].from, '07:00');
  assert.equal(routineFor('morgen', FRI)[0].from, '06:00');
  assert.equal(routineFor('abend', FRI)[0].from, '21:30');
  assert.equal(routineFor('abend', SUN)[0].from, '20:30');
  const sat = routineFor('abend', SAT);
  assert.deepEqual([sat[sat.length - 1].id, sat[sat.length - 1].from], ['schlafen', '22:30']);
  assert.equal(routineFor('morgen', THU).find(s => s.id === 'wasser').until, '06:05');
  assert.equal(routineFor('morgen', THU)[0].until, '06:00');
});

test('activeStep', () => {
  assert.equal(activeStep(THU, '06:00').step.id, 'wasser');
  const g = activeStep(THU, '06:07');
  assert.deepEqual([g.kind, g.step.id, g.next.id], ['morgen', 'grandpa', 'toilette']);
  assert.equal(activeStep(SAT, '07:07').step.id, 'grandpa');
  assert.equal(activeStep(THU, '21:15').step.id, 'lesen');
  assert.deepEqual(activeStep(FRI, '21:15'), { kind: null, upcoming: { kind: 'abend', day: FRI, from: '21:30' } });
  assert.deepEqual(activeStep(THU, '22:00'), { kind: null, upcoming: { kind: 'morgen', day: FRI, from: '06:00' } });
  assert.deepEqual(activeStep(FRI, '23:00'), { kind: null, upcoming: { kind: 'morgen', day: SAT, from: '07:00' } });
  assert.deepEqual(activeStep(THU, '05:30'), { kind: null, upcoming: { kind: 'morgen', day: THU, from: '06:00' } });
});

test('progress counts ticks and linked steps', () => {
  assert.deepEqual(progress(EVENING, { shutdown: true, box: true }, { mobility: true, supps: false }), { done: 3, total: 7 });
  assert.deepEqual(progress(EVENING, { mobility: true, lesen: true }, {}), { done: 0, total: 7 });
});

test('pack ids are unique and grandpa has 8 steps', () => {
  const ids = PACK.flatMap(c => c.items.map(i => i.id));
  assert.equal(ids.length, 15);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(GRANDPA.map(s => s.at), [0, 30, 60, 90, 120, 150, 180, 210]);
  assert.equal(GRANDPA_END, 240);
});
