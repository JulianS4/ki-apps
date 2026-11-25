import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fmtSets, fmtN, lastFor, dateOf, prScan, computePRs, metrics, ticks, totals, weekDone, prText, target,
} from '../js/areas/training/logic.js';
import { DEF } from '../js/areas/training/plan-default.js';

const set = (v, w) => ({ v: String(v), w: String(w), ok: true });
const mon = (date, w, reps) => ({ date, day: 'mo', sets: { pistol: reps.map(r => set(r, w)) }, n: {}, warm: {}, week: {} });
const sess = {
  's_2026-11-02_mo': mon('2026-11-02', '5', [6]),
  's_2026-11-09_mo': mon('2026-11-09', '5', [7]),
  's_2026-11-16_mo': mon('2026-11-16', '7.5', [5]),
  's_2026-11-23_mo': mon('2026-11-23', '7.5', [5]),
  's_2026-11-24_di': { date: '2026-11-24', day: 'di', sets: { wpush: [set(10, 15)] } },
};
const pistol = { id: 'pistol', unit: 'reps', load: 'kg' };

test('fmtSets uses decimal comma', () => {
  assert.equal(fmtSets([{ v: '8', w: '12.5', ok: true }, { v: '7', w: '12.5', ok: true }, {}], { unit: 'reps', load: 'kg' }), '8 · 7 @ 12,5 kg');
});
test('fmtN rounds to two decimals', () => {
  assert.equal(fmtN(12.5), '12,5');
  assert.equal(fmtN(2.4000001), '2,4');
});
test('lastFor respects cutoff', () => {
  assert.equal(lastFor(sess, 'pistol', '2026-11-23')[0].w, '7.5');
  assert.equal(lastFor(sess, 'pistol', '2026-11-02'), null);
});
test("dateOf picks this week's session, else today, else selection", () => {
  assert.equal(dateOf(sess, 'di', {}, '2026-11-25', '2026-11-23'), '2026-11-24');
  assert.equal(dateOf(sess, 'fr', {}, '2026-11-25', '2026-11-23'), '2026-11-25');
  assert.equal(dateOf(sess, 'fr', { fr: '2026-11-20' }, '2026-11-25', '2026-11-23'), '2026-11-20');
});
test('prScan flags weight and rep records, never the first session', () => {
  const r = prScan(sess, pistol);
  assert.equal(r.count, 2);
  assert.deepEqual(r.marks.get(sess['s_2026-11-09_mo']), ['v']);
  assert.deepEqual(r.marks.get(sess['s_2026-11-16_mo']), ['w']);
  assert.equal(r.marks.has(sess['s_2026-11-02_mo']), false);
  assert.equal(r.marks.has(sess['s_2026-11-23_mo']), false);
});
test('prScan ignores minute and check exercises', () => {
  assert.equal(prScan(sess, { id: 'jog', unit: 'min', load: 'km' }).count, 0);
});
test('computePRs on empty sess', () => assert.equal(computePRs({}, DEF).size, 0));
test('computePRs maps sessions to exercise flags', () => {
  const m = computePRs(sess, DEF);
  assert.deepEqual(m.get(sess['s_2026-11-16_mo']).pistol, ['w']);
});
test('metrics by exercise type', () => {
  assert.deepEqual(metrics(sess, pistol).map(x => x.k), ['w', 'sum']);
  const bw = { id: 'hspu', unit: 'reps', load: '' };
  assert.deepEqual(metrics({ s: { date: '2026-11-24', day: 'di', sets: { hspu: [{ v: '5', ok: true }] } } }, bw).map(x => x.k), ['best', 'sum']);
  assert.deepEqual(metrics(sess, { id: 'spr10', unit: 'check' }), []);
});
test('ticks are nice', () => {
  assert.deepEqual(ticks(5, 15, 0), [5, 7.5, 10, 12.5, 15]);
  assert.deepEqual(ticks(9, 11, 1), [9, 10, 11]);
});
test('totals counts checked sets up to the planned count', () => {
  const day = { blocks: [{ ex: [{ id: 'pistol', sets: 3 }] }] };
  assert.deepEqual(totals(day, sess['s_2026-11-23_mo']), { t: 3, o: 1 });
  assert.deepEqual(totals(day, undefined), { t: 3, o: 0 });
});
test('weekDone sees this week only', () => {
  assert.equal(weekDone(sess, 'mo', '2026-11-23'), true);
  assert.equal(weekDone(sess, 'fr', '2026-11-23'), false);
});
test('prText and target', () => {
  assert.equal(prText(pistol, { v: '6', w: '17.5' }), '17,5 kg × 6 Wdh');
  assert.equal(target({ unit: 'reps', sets: 3, min: 5, max: 8, per: '/Seite' }), '3 × 5–8 Wdh /Seite');
});
