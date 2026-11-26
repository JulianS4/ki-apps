import test from 'node:test';
import assert from 'node:assert/strict';
import * as arena from '../js/areas/arena/index.js';
import { memServer, memNet } from '../js/areas/arena/net.js';
import { decodeInvite } from '../js/areas/arena/logic.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const SNIPPET = 'const firebaseConfig = { apiKey: "AIzaTest", authDomain: "x.firebaseapp.com", projectId: "x", appId: "1:2:web:3" };';
const mk = () => {
  const store = createStore(memBackend());
  return { store, now: () => new Date('2026-11-26T09:00:00+01:00'), setStatus() {}, toast() {}, rerender() {}, go() {} };
};

test('Julian sets up an arena and gets both links', async () => {
  const server = memServer();
  arena.setNetFactory(c => memNet(server, c));
  const ctx = mk();
  assert.deepEqual(await arena.setupArena(ctx, 'quatsch'), { ok: false, error: 'Konfiguration nicht erkannt' });
  const r = await arena.setupArena(ctx, SNIPPET);
  assert.equal(r.ok, true);
  const c = ctx.store.get('arena.conn');
  assert.equal(c.player, 'julian');
  assert.match(c.code, /^[A-Za-z0-9_-]{22}$/);
  const inv = decodeInvite(arena.inviteLink(ctx, 'uygar'));
  assert.deepEqual([inv.player, inv.code, inv.key], ['uygar', c.code, c.keys.uygar]);
  const u = mk();
  assert.deepEqual(arena.joinArena(u, arena.inviteLink(ctx, 'uygar')), { ok: true, player: 'uygar' });
  assert.equal('keys' in u.store.get('arena.conn'), false);
  await memNet(server, u.store.get('arena.conn')).ready;
});

test('a broken invite is refused and stores nothing', () => {
  const ctx = mk();
  assert.deepEqual(arena.joinArena(ctx, 'https://julians4.github.io/ki-apps/#arena/einladung?kaputt'), { ok: false });
  assert.equal(ctx.store.get('arena.conn'), null);
});

test('arena-only mode for Uygar until he shows all areas', () => {
  const ctx = mk();
  assert.equal(arena.arenaOnly(ctx.store), false);
  ctx.store.set('arena.conn', { cfg: { apiKey: 'a', authDomain: 'b', projectId: 'c', appId: 'd' }, code: 'C'.repeat(22), player: 'uygar', key: 'U'.repeat(32) });
  assert.equal(arena.arenaOnly(ctx.store), true);
  ctx.store.set('app.full', true);
  assert.equal(arena.arenaOnly(ctx.store), false);
});

test('the invite data leaves the address once the access is stored', () => {
  let replaced = null;
  globalThis.history = { replaceState: (a, b, url) => { replaced = url; } };
  const server = memServer();
  arena.setNetFactory(c => memNet(server, c));
  const j = mk();
  return arena.setupArena(j, SNIPPET).then(() => {
    const token = arena.inviteLink(j, 'uygar').split('?')[1], u = mk(), route = { area: 'arena', view: 'invite', token };
    assert.match(arena.render(route, u), /Du bist Uygar/);
    arena.mount(null, route, u);
    assert.equal(replaced, '#arena');
    assert.equal(u.store.get('arena.conn').player, 'uygar');
  });
});
