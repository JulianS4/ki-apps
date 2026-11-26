import test from 'node:test';
import assert from 'node:assert/strict';
import { DISHES, SHOP, SUPPS } from '../js/areas/food/data.js';
import {
  latestWeight, proteinTarget, slotAt, suggestions, foodTotals, isLate, cleanStreak,
  dueGroup, trainingBlock, snackHint, dinnerHint, mealprepDay, slug,
} from '../js/areas/food/logic.js';

const THU = '2026-11-26', WED = '2026-11-25', SAT = '2026-11-28', SUN = '2026-11-29';

test('latestWeight picks the newest valid entry', () => {
  assert.deepEqual(latestWeight({ '2026-11-20': 86, '2026-11-25': 85.2, '2026-11-26': 'x' }), { date: '2026-11-25', kg: 85.2 });
  assert.equal(latestWeight({}), null);
  assert.equal(latestWeight(null), null);
  assert.equal(latestWeight({ '2026-11-26': 0 }), null);
});

test('proteinTarget doubles the weight', () => {
  assert.equal(proteinTarget(85), 170);
  assert.equal(proteinTarget(82.4), 165);
});

test('slotAt boundaries', () => {
  assert.deepEqual(['07:30', '10:30', '14:30', '17:00', '18:00'].map(slotAt), ['fr', 'mi', 'sn', 'ab', 'ab']);
});

test('suggestions follow time and weekday', () => {
  const names = (day, t) => suggestions(DISHES, day, t).now.map(d => d.name);
  assert.deepEqual(names(THU, '07:30'), ['Joghurt Bowl', 'Overnight Oats', 'High Protein Wrap']);
  assert.deepEqual(names(SAT, '07:30'), ['Rührei mit Hüttenkäse Toast', 'Lachs Salat']);
  assert.deepEqual(names(THU, '12:00'), ['Aldi']);
  assert.deepEqual(names(THU, '18:00'), ['Lachspfanne mit Süßkartoffeln', 'Hähnchen mit Linsen-Dahl', 'Bolognese']);
  const s = suggestions(DISHES, THU, '07:30');
  assert.equal(s.now.length + s.rest.length, DISHES.length);
  assert.equal(s.rest[0].slot, 'fr');
  assert.equal(s.rest[s.rest.length - 1].slot, 'dr');
});

test('foodTotals', () => {
  assert.deepEqual(foodTotals({ meals: [{ g: 45 }, { g: 30 }], water: 2500 }), { protein: 75, water: 2500 });
  assert.deepEqual(foodTotals(undefined), { protein: 0, water: 0 });
});

test('isLate', () => {
  assert.equal(isLate('19:00'), false);
  assert.equal(isLate('19:01'), true);
});

test('cleanStreak', () => {
  const c = v => ({ clean: v });
  const base = { '2026-11-23': c(true), '2026-11-24': c(true), '2026-11-25': c(true) };
  assert.equal(cleanStreak(base, THU), 3);
  assert.equal(cleanStreak({ ...base, [THU]: c(true) }, THU), 4);
  assert.equal(cleanStreak({ ...base, '2026-11-24': c(false) }, THU), 1);
  const gap = { ...base };
  delete gap['2026-11-24'];
  assert.equal(cleanStreak(gap, THU), 1);
  assert.equal(cleanStreak({ ...base, [THU]: c(false) }, THU), 0);
  assert.equal(cleanStreak({}, THU), 0);
});

test('dueGroup', () => {
  assert.deepEqual(['08:00', '11:00', '16:59', '17:00'].map(dueGroup), ['morgens', 'mittags', 'mittags', 'abends']);
});

test('trainingBlock', () => {
  assert.deepEqual(trainingBlock(THU), { start: '16:15', end: '17:45', title: 'Lower B Training' });
  assert.deepEqual(trainingBlock(WED), { start: '16:15', end: '17:00', title: 'Joggen' });
  assert.equal(trainingBlock(SAT).title, 'Athlete Day');
  assert.equal(trainingBlock(SAT).start, '15:00');
  assert.equal(trainingBlock(SUN), null);
});

test('snackHint', () => {
  const lunch = [{ t: '12:00', slot: 'mi' }];
  assert.equal(snackHint(THU, '14:15', lunch), true);
  assert.equal(snackHint(THU, '14:14', lunch), false);
  assert.equal(snackHint(THU, '16:15', lunch), false);
  assert.equal(snackHint(THU, '14:30', [...lunch, { t: '14:20', slot: 'sn' }]), false);
  assert.equal(snackHint(THU, '14:30', [{ t: '13:30', slot: 'mi' }]), false);
  assert.equal(snackHint(SUN, '14:30', []), false);
});

test('dinnerHint', () => {
  assert.equal(dinnerHint(THU, '18:00', []), true);
  assert.equal(dinnerHint(THU, '17:30', []), false);
  assert.equal(dinnerHint(THU, '19:01', []), false);
  assert.equal(dinnerHint(THU, '18:00', [{ t: '17:55', slot: 'ab' }]), false);
  assert.equal(dinnerHint(SUN, '18:00', []), false);
});

test('mealprepDay', () => {
  assert.equal(mealprepDay(WED), true);
  assert.equal(mealprepDay(SUN), true);
  assert.equal(mealprepDay(THU), false);
});

test('slug', () => {
  assert.equal(slug('Rinderhackfleisch (mager)'), 'rinderhackfleisch-mager');
  assert.equal(slug('Äpfel'), 'aepfel');
  assert.equal(slug('Grüner / Schwarzer Tee'), 'gruener-schwarzer-tee');
});

test('shop ids are unique', () => {
  const ids = SHOP.flatMap(c => c.items.map(i => i.id));
  assert.equal(ids.length, 75);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(SHOP.length, 9);
});

test('dish ids are unique', () => {
  assert.equal(new Set(DISHES.map(d => d.id)).size, DISHES.length);
  assert.equal(new Set(SUPPS.map(s => s.id)).size, SUPPS.length);
  assert.equal(SUPPS.find(s => s.id === 'kreatin').shake, 25);
});
