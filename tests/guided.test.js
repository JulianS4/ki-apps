import test from 'node:test';
import assert from 'node:assert/strict';
import { startRun, toggleRun, stopRun, runOf, mountRun, stepTimerView, timerState } from '../js/core/guided.js';
import { GRANDPA, GRANDPA_END } from '../js/areas/routines/data.js';

const ctx = () => ({ rerender() {} });

test('a run follows the clock and calls onDone once', t => {
  let now = 1_000_000, done = 0;
  t.mock.method(Date, 'now', () => now);
  startRun({ kind: 'grandpa', key: '2026-11-26', steps: GRANDPA, end: GRANDPA_END, onDone: () => { done++; } });
  now += 35_000;
  assert.deepEqual({ status: runOf('grandpa').status, t: runOf('grandpa').t }, { status: 'running', t: 35 });
  now += 205_000;
  const c = ctx();
  mountRun('grandpa', c);
  mountRun('grandpa', c);
  assert.equal(done, 1);
  assert.equal(runOf('grandpa').status, 'done');
  stopRun();
});

test('pause holds the time', t => {
  let now = 2_000_000;
  t.mock.method(Date, 'now', () => now);
  startRun({ kind: 'grandpa', key: 'x', steps: GRANDPA, end: GRANDPA_END });
  now += 10_000;
  toggleRun();
  now += 30_000;
  assert.equal(runOf('grandpa').t, 10);
  assert.equal(runOf('grandpa').status, 'paused');
  toggleRun();
  now += 5_000;
  assert.equal(runOf('grandpa').t, 15);
  stopRun();
});

test('runOf with another kind or key is null', () => {
  startRun({ kind: 'breath', key: 2, end: 120 });
  assert.equal(runOf('mobility'), null);
  assert.equal(runOf('breath', 5), null);
  assert.ok(runOf('breath', 2));
  stopRun();
  assert.equal(runOf('breath'), null);
});

test('stepTimerView shows the first step', () => {
  const html = stepTimerView({ label: 'Chinese Grandpa Routine', steps: GRANDPA, end: GRANDPA_END, state: timerState(GRANDPA, GRANDPA_END, 0), status: 'idle', area: 'Routinen', back: '#routinen', doneTitle: 'Geschafft ✓', doneNote: '' });
  assert.match(html, /Lymphatic Hops/);
  assert.match(html, /Als Nächstes: Deep Squat/);
  assert.match(html, /0:30/);
  assert.match(html, /data-a="tstart"/);
  assert.match(html, /Chinese Grandpa Routine · <span id="rtStep">/);
  const done = stepTimerView({ label: 'x', steps: GRANDPA, end: GRANDPA_END, state: timerState(GRANDPA, GRANDPA_END, 240), status: 'done', area: 'Routinen', back: '#routinen', doneTitle: 'Geschafft ✓', doneNote: 'Chinese Grandpa ist abgehakt.' });
  assert.match(done, /href="#routinen">‹ Routinen</);
});
