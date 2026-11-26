import test from 'node:test';
import assert from 'node:assert/strict';
import * as arena from '../js/areas/arena/index.js';
import { memServer, memNet } from '../js/areas/arena/net.js';
import { TASKS } from '../js/areas/arena/data.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const CFG = { apiKey: 'a', authDomain: 'b', projectId: 'c', appId: 'd' };
const KEYS = { julian: 'J'.repeat(32), uygar: 'U'.repeat(32) };
const CODE = 'C'.repeat(22);
const TODAY = { area: 'arena', view: 'today' }, WEEK = { area: 'arena', view: 'week' }, HIST = { area: 'arena', view: 'history' };
const click = dataset => ({ target: { closest: () => ({ dataset }) } });
const change = (dataset, value) => ({ target: { dataset, value } });

async function setup({ player = 'julian', now = new Date('2026-11-26T09:00:00+01:00'), offline = false } = {}) {
  const server = memServer({ offline });
  if (!offline) await memNet(server, { cfg: CFG, code: CODE, player: 'julian', key: KEYS.julian }).create({ start: '2026-11-26', tasks: TASKS, keys: KEYS });
  arena.setNetFactory(c => memNet(server, c));
  const store = createStore(memBackend());
  store.set('arena.conn', { cfg: CFG, code: CODE, player, key: KEYS[player] });
  const ctx = { store, now: () => now, status: '', setStatus(t) { ctx.status = t; }, toast() {}, rerender() {}, go(h) { ctx.went = h; } };
  arena.onNavigate(TODAY, ctx);
  arena.render(TODAY, ctx);
  await arena.ready(ctx);
  return { server, ctx };
}

test('ticking and entering values writes the day with points', async () => {
  const { server, ctx } = await setup();
  arena.onClick(click({ a: 'yes', t: 'health' }), TODAY, ctx);
  arena.onChange(change({ a: 'val', t: 'work' }, '7,5'), TODAY, ctx);
  const d = server.day('julian', '2026-11-26');
  assert.deepEqual(d.values, { health: true, work: 7.5 });
  assert.ok(Math.abs(d.total - 1.75) < 1e-9);
  assert.match(arena.render(TODAY, ctx), /Julian 1,8 : 0 Uygar/);
});

test("the other player's points come in live", async () => {
  const { server, ctx } = await setup();
  server.putDayAs('uygar', { player: 'uygar', date: '2026-11-26', values: { skills: true, income: 50 }, points: { skills: 1, income: 1 }, total: 2 });
  assert.match(arena.render(TODAY, ctx), /Julian 0 : 2 Uygar/);
  assert.deepEqual(arena.cacheSummary(ctx), { day: '2026-11-26', julian: 0, uygar: 2 });
});

test('yesterday can be changed, older days are locked', async () => {
  const { server, ctx } = await setup({ now: new Date('2026-12-02T09:00:00+01:00') });
  arena.onClick(click({ a: 'day', d: '2026-12-01' }), TODAY, ctx);
  arena.onClick(click({ a: 'yes', t: 'skills' }), TODAY, ctx);
  assert.equal(server.day('julian', '2026-12-01').values.skills, true);
  arena.onClick(click({ a: 'day', d: '2026-11-30' }), TODAY, ctx);
  arena.onClick(click({ a: 'yes', t: 'skills' }), TODAY, ctx);
  assert.equal(server.day('julian', '2026-11-30'), null);
});

test('suggestions for Julian only, with Übernehmen', async () => {
  const { ctx } = await setup();
  ctx.store.set('rec.morning', { '2026-11-26': { bed: '21:30', wake: '06:00' } });
  ctx.store.set('food.days', { '2026-11-26': { clean: true, water: 3000, meals: [], supps: {} } });
  const html = arena.render(TODAY, ctx);
  assert.match(html, /Vorschlag: Ja/);
  assert.match(html, /data-a="take" data-t="health"/);
  assert.doesNotMatch(html, /data-a="take" data-t="training"/);
  const u = await setup({ player: 'uygar' });
  u.ctx.store.set('rec.morning', { '2026-11-26': { bed: '21:30', wake: '06:00' } });
  assert.doesNotMatch(arena.render(TODAY, u.ctx), /Vorschlag/);
});

test('week and history', async () => {
  const { server, ctx } = await setup({ now: new Date('2026-12-02T09:00:00+01:00') });
  server.putDayAs('julian', { player: 'julian', date: '2026-11-26', values: {}, points: {}, total: 3 });
  server.putDayAs('uygar', { player: 'uygar', date: '2026-11-27', values: {}, points: {}, total: 1.7 });
  arena.onClick(click({ a: 'wk', d: '2026-11-23' }), WEEK, ctx);
  assert.match(arena.render(WEEK, ctx), /Julian führt mit 1,3/);
  arena.onNavigate(HIST, ctx);
  arena.render(HIST, ctx);
  assert.match(arena.render(HIST, ctx), /KW 48[^<]*Sieger Julian/);
});

test('shared task list: add, archive, reset', async () => {
  const { ctx } = await setup();
  arena.onClick(click({ a: 'tedit' }), TODAY, ctx);
  arena.onClick(click({ a: 'tadd' }), TODAY, ctx);
  assert.match(arena.render(TODAY, ctx), /value="Neue Aufgabe"/);
  arena.onClick(click({ a: 'tarch', t: 'skills' }), TODAY, ctx);
  arena.onClick(click({ a: 'tedit' }), TODAY, ctx);
  assert.doesNotMatch(arena.render(TODAY, ctx), /data-t="skills"/);
  arena.onClick(click({ a: 'tedit' }), TODAY, ctx);
  arena.onClick(click({ a: 'treset' }), TODAY, ctx);
  assert.match(arena.render(TODAY, ctx), /Sicher\? Nochmal tippen/);
  arena.onClick(click({ a: 'treset' }), TODAY, ctx);
  arena.onClick(click({ a: 'tedit' }), TODAY, ctx);
  const html = arena.render(TODAY, ctx);
  assert.match(html, /data-t="skills"/);
  assert.doesNotMatch(html, /Neue Aufgabe/);
});

test('without access, offline or denied there is a clear message', async () => {
  const store = createStore(memBackend()), ctx = { store, now: () => new Date('2026-11-26T09:00:00+01:00'), setStatus() {}, toast() {}, rerender() {}, go() {} };
  arena.onNavigate(TODAY, ctx);
  assert.match(arena.render(TODAY, ctx), /Noch keine Arena auf diesem Gerät/);
  store.set('arena.conn', 'kaputt');
  assert.doesNotThrow(() => arena.render(TODAY, ctx));
  const off = await setup({ offline: true }).catch(e => e);
  assert.ok(!(off instanceof Error));
  assert.match(arena.render(TODAY, off.ctx), /Arena braucht beim ersten Mal Netz/);
});

test('the running week leads, finished weeks have a winner', async () => {
  const { server, ctx } = await setup({ now: new Date('2026-11-27T09:00:00+01:00') });
  server.putDayAs('julian', { player: 'julian', date: '2026-11-26', values: {}, points: {}, total: 2 });
  const html = arena.render(HIST, ctx);
  assert.match(html, /KW 48[^<]*Julian führt/);
  assert.doesNotMatch(html, /KW 48[^<]*Sieger/);
});

// ---- final review fixes ----
test('start week: days before the start day can be filled in and stay', async () => {
  const { server, ctx } = await setup();
  arena.onClick(click({ a: 'day', d: '2026-11-25' }), TODAY, ctx);
  arena.onClick(click({ a: 'yes', t: 'skills' }), TODAY, ctx);
  assert.equal(server.day('julian', '2026-11-25').values.skills, true);
  assert.match(arena.render(TODAY, ctx), /Julian 1 : 0 Uygar/);
  assert.match(arena.render(WEEK, ctx), /data-a="open" data-d="2026-11-23"/);
  arena.onClick(click({ a: 'open', d: '2026-11-23' }), WEEK, ctx);
  arena.onNavigate(TODAY, ctx);
  assert.match(arena.render(TODAY, ctx), /23\.11\./);
  arena.onClick(click({ a: 'yes', t: 'health' }), TODAY, ctx);
  assert.equal(server.day('julian', '2026-11-23').values.health, true);
  assert.match(arena.render(WEEK, ctx), /Julian führt mit 2/);
});

test('a failed first start tries again', async () => {
  const { server, ctx } = await setup({ offline: true });
  assert.match(arena.render(TODAY, ctx), /Nochmal versuchen/);
  server.offline = false;
  await memNet(server, { cfg: CFG, code: CODE, player: 'julian', key: KEYS.julian }).create({ start: '2026-11-26', tasks: TASKS, keys: KEYS });
  arena.onClick(click({ a: 'aretry' }), TODAY, ctx);
  await arena.ready(ctx);
  assert.match(arena.render(TODAY, ctx), /Julian 0 : 0 Uygar/);
});

test('a failed start also retries on its own after a while', async () => {
  const { server, ctx } = await setup({ offline: true });
  server.offline = false;
  await memNet(server, { cfg: CFG, code: CODE, player: 'julian', key: KEYS.julian }).create({ start: '2026-11-26', tasks: TASKS, keys: KEYS });
  const t0 = ctx.now();
  ctx.now = () => new Date(+t0 + 10000);
  arena.render(TODAY, ctx);
  await arena.ready(ctx);
  assert.match(arena.render(TODAY, ctx), /Julian 0 : 0 Uygar/);
});

test('task kind and unit can be changed', async () => {
  const { ctx } = await setup();
  arena.onClick(click({ a: 'tedit' }), TODAY, ctx);
  arena.onClick(click({ a: 'tadd' }), TODAY, ctx);
  const id = arena.render(TODAY, ctx).match(/data-a="tn" data-t="([^"]+)" value="Neue Aufgabe"/)[1];
  arena.onChange(change({ a: 'tk', t: id }, 'value'), TODAY, ctx);
  arena.onChange(change({ a: 'tu', t: id }, 'min'), TODAY, ctx);
  arena.onChange(change({ a: 'tg', t: id }, '30'), TODAY, ctx);
  arena.onClick(click({ a: 'tedit' }), TODAY, ctx);
  assert.match(arena.render(TODAY, ctx), new RegExp(`data-a="val" data-t="${id}"[\\s\\S]*?<span>min</span>`));
});

test('the empty arena page takes an invite too', async () => {
  const server = memServer();
  await memNet(server, { cfg: CFG, code: CODE, player: 'julian', key: KEYS.julian }).create({ start: '2026-11-26', tasks: TASKS, keys: KEYS });
  arena.setNetFactory(c => memNet(server, c));
  const store = createStore(memBackend()), ctx = { store, now: () => new Date('2026-11-26T09:00:00+01:00'), setStatus() {}, toast() {}, rerender() {}, go() {} };
  arena.onNavigate(TODAY, ctx);
  assert.match(arena.render(TODAY, ctx), /data-a="ajoin"/);
  const { encodeInvite } = await import('../js/areas/arena/logic.js');
  arena.onInput({ target: { dataset: { a: 'ainv' }, value: '#arena/einladung?' + encodeInvite({ cfg: CFG, code: CODE, player: 'uygar', key: KEYS.uygar }) } }, TODAY, ctx);
  arena.onClick(click({ a: 'ajoin' }), TODAY, ctx);
  assert.equal(store.get('arena.conn').player, 'uygar');
});
