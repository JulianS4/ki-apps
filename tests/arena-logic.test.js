import test from 'node:test';
import assert from 'node:assert/strict';
import { TASKS } from '../js/areas/arena/data.js';
import { fmt1, taskPoints, dayPoints, cleanTasks, berlinDay, mondayOf, weekDays, isoWeek, editable, weekSums, history, totalsSince, suggest, parseConfig, randomId, encodeInvite, decodeInvite, cleanConn } from '../js/areas/arena/logic.js';

const CFG = { apiKey: 'AIzaTest', authDomain: 'x.firebaseapp.com', projectId: 'x', appId: '1:2:web:3' };
const conn = (o = {}) => ({ cfg: CFG, code: 'A'.repeat(22), player: 'uygar', key: 'K'.repeat(32), ...o });

test('points: yes is 1, values divide by the goal without a cap', () => {
  const [health, income, , , work] = TASKS;
  assert.equal(taskPoints(health, true), 1);
  assert.equal(taskPoints(health, false), 0);
  assert.equal(taskPoints(income, 100), 2);
  assert.equal(taskPoints(work, 12), 1.2);
  assert.equal(taskPoints(work, 'x'), 0);
  const d = dayPoints(TASKS, { health: true, income: 35, skills: false, training: true, work: 9 });
  assert.deepEqual(d.points, { health: 1, income: 0.7, skills: 0, training: 1, work: 0.9 });
  assert.ok(Math.abs(d.total - 3.6) < 1e-9);
  assert.equal(fmt1(d.total), '3,6');
  assert.equal(fmt1(2), '2');
  assert.equal(fmt1(1.25), '1,3');
});

test('task list is cleaned and sorted', () => {
  assert.deepEqual(cleanTasks([{ id: 'b', name: 'B', kind: 'yes', order: 2 }, { id: 'a', name: 'A', kind: 'value', goal: 5, unit: 'h', order: 1 }, { id: '', kind: 'yes' }, { id: 'c', name: 'C', kind: 'value', goal: 0 }, 'x']).map(t => t.id), ['a', 'b']);
  assert.deepEqual(cleanTasks('x'), []);
});

test('the day follows Berlin, not the device', () => {
  assert.equal(berlinDay(new Date('2026-11-26T22:59:00Z')), '2026-11-26');
  assert.equal(berlinDay(new Date('2026-11-26T23:01:00Z')), '2026-11-27');
  assert.equal(berlinDay(new Date('2026-07-01T22:30:00Z')), '2026-07-02');
});

test('weeks', () => {
  assert.equal(mondayOf('2026-11-29'), '2026-11-23');
  assert.equal(mondayOf('2026-11-23'), '2026-11-23');
  assert.deepEqual(weekDays('2026-11-23'), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
  assert.deepEqual(isoWeek('2026-11-26'), { year: 2026, week: 48 });
  assert.deepEqual(isoWeek('2027-01-01'), { year: 2026, week: 53 });
});

test('today, yesterday and the start week are editable', () => {
  assert.equal(editable('2026-11-26', '2026-11-26', '2026-11-26'), true);
  assert.equal(editable('2026-11-25', '2026-11-26', '2026-11-20'), true);
  assert.equal(editable('2026-11-24', '2026-11-26', '2026-11-20'), false);
  assert.equal(editable('2026-11-23', '2026-11-26', '2026-11-26'), true);
  assert.equal(editable('2026-11-23', '2026-12-01', '2026-11-26'), false);
  assert.equal(editable('2026-11-27', '2026-11-26', '2026-11-26'), false);
});

test('week sums, history and totals', () => {
  const days = [
    { player: 'julian', date: '2026-11-23', total: 3 }, { player: 'uygar', date: '2026-11-23', total: 2.5 },
    { player: 'julian', date: '2026-11-30', total: 1 }, { player: 'uygar', date: '2026-12-01', total: 4 },
    { player: 'julian', date: '2026-12-07', total: 2 }, { player: 'uygar', date: '2026-12-07', total: 2 },
  ];
  assert.deepEqual(weekSums(days, '2026-11-23'), { julian: 3, uygar: 2.5, leader: 'julian', diff: 0.5 });
  const h = history(days, '2026-11-23', '2026-12-08');
  assert.deepEqual(h.map(w => [w.week, w.winner]), [[50, null], [49, 'uygar'], [48, 'julian']]);
  assert.deepEqual(totalsSince(days, '2026-12-08'), { julian: 6, uygar: 8.5, wins: { julian: 1, uygar: 1 } });
});

test('suggestions need all three for health', () => {
  assert.deepEqual(suggest({ sleepH: 8, clean: true, water: 3000, sets: 1 }), { health: true, training: true });
  assert.deepEqual(suggest({ sleepH: 7.5, clean: true, water: 3500, sets: 0 }), { health: false, training: false });
  assert.deepEqual(suggest({ sleepH: 9, clean: false, water: 3500, sets: 0 }).health, false);
  assert.deepEqual(suggest({}), { health: false, training: false });
});

test('config from the console snippet or JSON', () => {
  const snippet = 'const firebaseConfig = {\n  apiKey: "AIzaTest",\n  authDomain: "x.firebaseapp.com",\n  projectId: "x",\n  storageBucket: "x.appspot.com",\n  appId: "1:2:web:3"\n};';
  assert.deepEqual(parseConfig(snippet), { ...CFG, storageBucket: 'x.appspot.com' });
  assert.deepEqual(parseConfig(JSON.stringify(CFG)), CFG);
  assert.equal(parseConfig('{"apiKey":"x"}'), null);
  assert.equal(parseConfig('quatsch'), null);
});

test('invites round-trip and reject anything odd', () => {
  const t = encodeInvite(conn());
  assert.match(t, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeInvite(t), conn());
  assert.deepEqual(decodeInvite(`https://julians4.github.io/ki-apps/#arena/einladung?${t}`), conn());
  assert.deepEqual(decodeInvite(`#arena/einladung?${t}`), conn());
  assert.equal(decodeInvite(encodeInvite(conn({ player: 'max' }))), null);
  assert.equal(decodeInvite(encodeInvite(conn({ code: 'kurz' }))), null);
  assert.equal(decodeInvite('kaputt!'), null);
  assert.match(randomId(16), /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(randomId(16), randomId(16));
});

test('stored access is checked on read', () => {
  assert.deepEqual(cleanConn(conn()), conn());
  assert.equal(cleanConn({ cfg: CFG }), null);
  assert.equal(cleanConn('x'), null);
  const j = conn({ player: 'julian', keys: { julian: 'J'.repeat(32), uygar: 'U'.repeat(32) } });
  assert.deepEqual(cleanConn(j).keys, j.keys);
  assert.equal('keys' in cleanConn(conn({ keys: { julian: 'x' } })), false);
});
