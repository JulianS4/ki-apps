import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, importBackup } from '../js/core/backup.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const plan7 = { v: 1, days: ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'].map(id => ({ id, blocks: [] })) };
const mo = { date: '2026-11-23', day: 'mo', sets: { pistol: [{ v: '6', w: '15', ok: true }] } };
const legacy = (extra = {}) => ({ app: 'hybrid-training', v: 1, plan: plan7, sess: { 's_2026-11-23_mo': mo, ...extra } });
const fresh = () => createStore(memBackend());

test('legacy import maps plan and sessions', () => {
  const s = fresh();
  const r = importBackup(legacy(), s);
  assert.deepEqual(r, { kind: 'hybrid-training', sessions: 1 });
  assert.ok(s.get('train.sess')['s_2026-11-23_mo']);
  assert.equal(s.get('train.plan').days.length, 7);
});
test('importBackup keeps sparse legacy sessions', () => {
  const sparse = { date: '2026-11-24', day: 'di', sets: { wpush: [null, { v: '8', ok: true }] } };
  const s = fresh();
  importBackup(legacy({ 's_2026-11-24_di': sparse }), s);
  assert.deepEqual(s.get('train.sess')['s_2026-11-24_di'], sparse);
});
test('import is idempotent', () => {
  const a = fresh(), b = fresh();
  importBackup(legacy(), a);
  importBackup(legacy(), b); importBackup(legacy(), b);
  assert.deepEqual(b.get('train.sess'), a.get('train.sess'));
});
test('merge keeps existing sessions', () => {
  const s = fresh();
  s.set('train.sess', { 's_2026-11-20_fr': { date: '2026-11-20', day: 'fr', sets: {} } });
  importBackup(legacy(), s);
  assert.deepEqual(Object.keys(s.get('train.sess')).sort(), ['s_2026-11-20_fr', 's_2026-11-23_mo']);
});
test('invalid plan is ignored', () => {
  const s = fresh(), mine = { v: 1, days: plan7.days.map(d => ({ ...d, name: 'mine' })) };
  s.set('train.plan', mine);
  importBackup({ ...legacy(), plan: { v: 1, days: [1, 2, 3] } }, s);
  assert.deepEqual(s.get('train.plan'), mine);
});
test('rejects unknown files', () => {
  assert.throws(() => importBackup({ foo: 1 }, fresh()), { message: 'Keine gültige Backup-Datei' });
  assert.throws(() => importBackup(null, fresh()), { message: 'Keine gültige Backup-Datei' });
});
test('roundtrip', () => {
  const a = fresh(), b = fresh();
  importBackup(legacy(), a);
  a.set('meta.lastBackup', '2026-11-25');
  const bk = buildBackup(a, '2026-11-25T10:00:00.000Z');
  assert.equal(bk.app, 'ki-apps');
  assert.equal(bk.v, 1);
  assert.equal(bk.data['meta.lastBackup'], undefined);
  const r = importBackup(JSON.parse(JSON.stringify(bk)), b);
  assert.deepEqual(r, { kind: 'ki-apps', sessions: 1 });
  assert.deepEqual(b.get('train.sess'), a.get('train.sess'));
  assert.deepEqual(b.get('train.plan'), a.get('train.plan'));
});
