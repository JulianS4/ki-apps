import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

test('set and get roundtrip', () => {
  const b = memBackend(), s = createStore(b);
  assert.equal(s.set('train.plan', { a: 1 }), true);
  assert.deepEqual(s.get('train.plan'), { a: 1 });
  assert.equal(b.getItem('ki.train.plan'), '{"a":1}');
});
test('get missing returns fallback', () => assert.equal(createStore(memBackend()).get('x', 7), 7));
test('get corrupt json returns fallback', () => {
  const s = createStore(memBackend({ 'ki.x': '{oops' }));
  assert.equal(s.get('x', 'f'), 'f');
});
test('set returns false when backend throws', () => {
  const b = memBackend();
  b.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(createStore(b).set('x', 1), false);
});
test('keys lists only prefixed', () => {
  const s = createStore(memBackend({ 'ki.a': '1', 'ki.b': '2', 'tr-sess': '{}' }));
  assert.deepEqual(s.keys().sort(), ['a', 'b']);
});
test('remove deletes the key', () => {
  const b = memBackend({ 'ki.a': '1' }), s = createStore(b);
  s.remove('a');
  assert.equal(b.getItem('ki.a'), null);
});
