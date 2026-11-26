import test from 'node:test';
import assert from 'node:assert/strict';
import { PACK, GRANDPA, GRANDPA_END, EVENING } from '../js/areas/routines/data.js';
import { shiftTime, routineFor, activeStep, progress, cleanSteps, cleanPack } from '../js/areas/routines/logic.js';

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

test('cleanSteps keeps valid steps sorted and drops the rest', () => {
  const raw = [
    { id: 'b', from: '06:10', to: '06:05', title: 'B', link: 'nope' },
    { id: 'a', from: '06:00', to: '06:05', title: 'A', link: 'water' },
    { id: 'a', from: '07:00', title: 'Doppelt' },
    { id: '', from: '06:00', title: 'x' }, { id: 'c', from: '6:00', title: 'x' }, { id: 'd', from: '24:00', title: 'x' },
    { id: 'e', from: '06:00' }, 'x', null,
  ];
  assert.deepEqual(cleanSteps(raw, EVENING), [
    { id: 'a', from: '06:00', to: '06:05', title: 'A', link: 'water' },
    { id: 'b', from: '06:10', title: 'B' },
  ]);
  for (const bad of [undefined, 'x', {}, [], [{ id: 1 }]]) assert.equal(cleanSteps(bad, EVENING), EVENING);
});

test('cleanPack keeps valid groups and items', () => {
  assert.deepEqual(cleanPack([{ cat: 'Tasche', items: [{ id: 'a', name: 'A' }, { id: '', name: 'x' }, 'x'] }, { cat: 5, items: [] }], PACK),
    [{ cat: 'Tasche', items: [{ id: 'a', name: 'A' }] }]);
  for (const bad of [null, 'x', [], [{ cat: 'T' }]]) assert.equal(cleanPack(bad, PACK), PACK);
});

test('routineFor and activeStep use edited lists', () => {
  const morgen = [{ id: 'x', from: '05:30', to: '05:45', title: 'Früh' }], abend = [{ id: 'y', from: '22:00', title: 'Spät' }];
  assert.deepEqual(routineFor('morgen', SAT, morgen).map(s => [s.from, s.until]), [['06:30', '06:45']]);
  assert.equal(activeStep(THU, '05:40', { morgen, abend }).step.title, 'Früh');
  assert.deepEqual(activeStep(THU, '05:00', { morgen, abend }).upcoming, { kind: 'morgen', day: THU, from: '05:30' });
  assert.equal(activeStep(FRI, '23:00', { morgen, abend }).step.title, 'Spät');
  // Review Focus 3: same start time, both stay; the holder shows the one that lasts
  const twin = cleanSteps([{ id: 'p', from: '06:00', title: 'P' }, { id: 'q', from: '06:00', to: '06:10', title: 'Q' }], EVENING);
  assert.deepEqual(twin.map(s => s.id), ['p', 'q']);
  assert.equal(activeStep(THU, '06:00', { morgen: twin, abend }).step.id, 'q');
  // Review Focus 4: Fr +1 h pushes 23:30 past midnight, nothing throws
  const late = { morgen, abend: [{ id: 'z', from: '23:30', title: 'Sehr spät' }] };
  assert.equal(routineFor('abend', FRI, late.abend)[0].from, '00:30');
  assert.doesNotThrow(() => activeStep(FRI, '00:10', late));
  assert.doesNotThrow(() => activeStep(FRI, '23:59', late));
});
