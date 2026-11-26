import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateToRecovery, runMigrations } from '../js/core/migrate.js';
import { importBackup } from '../js/core/backup.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const mo = () => ({ date: '2026-11-23', day: 'mo', sets: { pistol: [{ v: '6', ok: true }] }, mob: true });
const so = () => ({ date: '2026-11-22', day: 'so', sets: {}, week: { schlaf: 4, energie: 3, gelenke: 5, ziel: 4, note: 'gut' } });
const legacy = () => ({ 's_2026-11-23_mo': mo(), 's_2026-11-22_so': so() });
const emptyRec = () => ({ mobility: {}, weekly: {} });

test('moves mobility flags', () => {
  const r = migrateToRecovery({ 's_2026-11-23_mo': mo() }, emptyRec());
  assert.deepEqual(r.rec.mobility['2026-11-23'], { done: true });
  assert.equal(r.sess['s_2026-11-23_mo'].mob, undefined);
  assert.ok(r.sess['s_2026-11-23_mo'].sets.pistol);
});

test('moves the sunday week check and drops the empty session', () => {
  const r = migrateToRecovery({ 's_2026-11-22_so': so() }, emptyRec());
  assert.deepEqual(r.rec.weekly['2026-11-22'], { schlaf: 4, energie: 3, gelenke: 5, ziel: 4, gut: 'gut', next: '' });
  assert.equal(r.sess['s_2026-11-22_so'], undefined);
});

test('migration keeps a session that still holds typed values', () => {
  const s = { ...so(), sets: { x: [{ v: '10', ok: false }] } };
  const r = migrateToRecovery({ 's_2026-11-22_so': s }, emptyRec());
  assert.ok(r.sess['s_2026-11-22_so']);
  assert.equal(r.sess['s_2026-11-22_so'].week, undefined);
});

test('migration never overwrites recovery entries', () => {
  const rec = { mobility: {}, weekly: { '2026-11-22': { schlaf: 1 } } };
  const r = migrateToRecovery(legacy(), rec);
  assert.deepEqual(r.rec.weekly['2026-11-22'], { schlaf: 1 });
  assert.deepEqual(rec.weekly, { '2026-11-22': { schlaf: 1 } });
});

test('migration works on copies', () => {
  const sess = legacy();
  migrateToRecovery(sess, emptyRec());
  assert.equal(sess['s_2026-11-23_mo'].mob, true);
  assert.ok(sess['s_2026-11-22_so']);
});

test('migration is idempotent', () => {
  const a = migrateToRecovery(legacy(), emptyRec());
  const b = migrateToRecovery(a.sess, a.rec);
  assert.equal(a.moved, 2);
  assert.equal(b.moved, 0);
  assert.deepEqual(b.rec, a.rec);
  assert.deepEqual(b.sess, a.sess);
});

test('runMigrations writes the store', () => {
  const store = createStore(memBackend());
  store.set('train.sess', legacy());
  assert.equal(runMigrations(store), 2);
  assert.deepEqual(store.get('rec.mobility'), { '2026-11-23': { done: true } });
  assert.equal(store.get('rec.weekly')['2026-11-22'].gut, 'gut');
  assert.equal(store.get('train.sess')['s_2026-11-22_so'], undefined);
  assert.equal(runMigrations(store), 0);
});

test('runMigrations leaves an untouched store alone', () => {
  const store = createStore(memBackend());
  assert.equal(runMigrations(store), 0);
  assert.deepEqual(store.keys(), []);
});

// Loading an older backup must not wipe recovery entries made since then.
test('backup import merges recovery entries per date', () => {
  const store = createStore(memBackend());
  store.set('rec.morning', { '2026-11-25': { schlaf: 4, energie: 4, muskeln: 4 } });
  store.set('rec.complaints', [{ id: 'a', place: 'Knie', level: 2, start: '2026-11-20', note: '', resolved: null }]);
  importBackup({ app: 'ki-apps', v: 1, data: {
    'rec.morning': { '2026-11-20': { schlaf: 3, energie: 3, muskeln: 3 } },
    'rec.complaints': [{ id: 'b', place: 'Schulter', level: 3, start: '2026-11-18', note: '', resolved: null }],
    'rec.cycle': { anchor: '2026-11-30' },
  } }, store);
  assert.deepEqual(Object.keys(store.get('rec.morning')).sort(), ['2026-11-20', '2026-11-25']);
  assert.deepEqual(store.get('rec.complaints').map(c => c.id).sort(), ['a', 'b']);
  assert.deepEqual(store.get('rec.cycle'), { anchor: '2026-11-30' });
});

// When storage is full, nothing may leave the sessions before Recovery holds it.
test('runMigrations keeps the old fields when recovery cannot be saved', () => {
  const be = memBackend();
  const set = be.setItem;
  be.setItem = (k, v) => { if (k.startsWith('ki.rec.')) throw new Error('QuotaExceededError'); set(k, v); };
  const store = createStore(be);
  store.set('train.sess', legacy());
  runMigrations(store);
  assert.equal(store.get('rec.weekly'), null);
  assert.equal(store.get('train.sess')['s_2026-11-23_mo'].mob, true);
  assert.ok(store.get('train.sess')['s_2026-11-22_so'].week);
});

test('backup import merges food days and weights per date', () => {
  const store = createStore(memBackend());
  store.set('food.days', { '2026-11-26': { meals: [{ id: 'm1', name: 'Joghurt Bowl', g: 45, slot: 'fr', t: '07:30' }], water: 500 } });
  store.set('body.weight', { '2026-11-26': 85 });
  importBackup({ app: 'ki-apps', v: 1, data: {
    'food.days': { '2026-11-20': { meals: [], water: 3000 } },
    'body.weight': { '2026-11-20': 86 },
  } }, store);
  assert.deepEqual(Object.keys(store.get('food.days')).sort(), ['2026-11-20', '2026-11-26']);
  assert.deepEqual(store.get('body.weight'), { '2026-11-20': 86, '2026-11-26': 85 });
});

test('backup import merges routine days per date', () => {
  const store = createStore(memBackend());
  store.set('rout.days', { '2026-11-26': { morgen: { toilette: true } } });
  importBackup({ app: 'ki-apps', v: 1, data: { 'rout.days': { '2026-11-20': { abend: { box: true } } } } }, store);
  assert.deepEqual(Object.keys(store.get('rout.days')).sort(), ['2026-11-20', '2026-11-26']);
});
