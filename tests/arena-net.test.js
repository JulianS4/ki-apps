import test from 'node:test';
import assert from 'node:assert/strict';
import { memServer, memNet } from '../js/areas/arena/net.js';
import { TASKS } from '../js/areas/arena/data.js';

const CFG = { apiKey: 'a', authDomain: 'b', projectId: 'c', appId: 'd' };
const KEYS = { julian: 'J'.repeat(32), uygar: 'U'.repeat(32) };
const conn = (player, key = KEYS[player], code = 'C'.repeat(22)) => ({ cfg: CFG, code, player, key });

async function arena() {
  const server = memServer(), j = memNet(server, conn('julian'));
  await j.create({ start: '2026-11-26', tasks: TASKS, keys: KEYS });
  await j.ready;
  return { server, j };
}

test('players write their own days and see each other live', async () => {
  const { server, j } = await arena(), u = memNet(server, conn('uygar'));
  await u.ready;
  let seen = [];
  j.watchDays('2026-11-23', '2026-11-29', d => { seen = d; });
  await u.putDay({ date: '2026-11-26', values: { health: true }, points: { health: 1 }, total: 1 });
  assert.deepEqual(seen.map(d => [d.player, d.total]), [['uygar', 1]]);
  let tasks = [];
  u.watchTasks(t => { tasks = t; });
  assert.equal(tasks.length, 5);
});

test('a wrong key or code gets nowhere', async () => {
  const { server } = await arena();
  await assert.rejects(memNet(server, conn('uygar', 'X'.repeat(32))).ready, /denied/);
  await assert.rejects(memNet(server, conn('uygar', KEYS.uygar, 'D'.repeat(22))).ready, /denied/);
  assert.throws(() => server.putDayAs('julian', { player: 'uygar', date: '2026-11-26', values: {}, points: {}, total: 0 }), /denied/);
});

test('offline first start says so', async () => {
  await assert.rejects(memNet(memServer({ offline: true }), conn('julian')).ready, /offline/);
});
