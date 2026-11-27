import test from 'node:test';
import assert from 'node:assert/strict';
import { DEF } from '../js/areas/training/plan-default.js';
import { weekLoad, muscleFigure, MUSCLES, CAT_MUSCLES } from '../js/areas/training/muscles.js';
import * as training from '../js/areas/training/index.js';
import * as home from '../js/areas/cockpit/home.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

test('every exercise category lights up named muscle groups', () => {
  const names = new Set(MUSCLES.map(m => m[0]));
  for (const c of ['push', 'pull', 'sch', 'quad', 'hk', 'ws', 'core', 'ath']) {
    assert.ok(CAT_MUSCLES[c].length, c);
    for (const m of CAT_MUSCLES[c]) assert.ok(names.has(m), `${c} → ${m}`);
  }
  assert.deepEqual(CAT_MUSCLES.prep, []);
});

test('the week load: done sets against the plan per muscle group, only this week', () => {
  const sess = {
    's_2026-11-23_mo': { day: 'mo', date: '2026-11-23', sets: { pistol: [{ ok: true }, { ok: true }, { ok: true }], nordic: [{ ok: true }, { ok: false }] } },
    's_2026-11-16_mo': { day: 'mo', date: '2026-11-16', sets: { pistol: [{ ok: true }, { ok: true }, { ok: true }] } },
  };
  const w = weekLoad(DEF, sess, '2026-11-23');
  assert.ok(w.groups.quads.plan > 0);
  assert.equal(w.groups.quads.done, 3, 'pistol squats: three quad sets this week, last week does not count');
  assert.equal(w.groups.hamstrings.done, 1);
  assert.ok(w.groups.quads.load > 0 && w.groups.quads.load <= 1);
  assert.equal(w.groups.chest.done, 0);
  assert.equal(w.groups.chest.load, 0);
  assert.equal(w.total.done, 4);
  const none = weekLoad(DEF, {}, '2026-11-23');
  assert.ok(Object.values(none.groups).every(g => g.load === 0));
});

test('the figure: front and back, every group named with its load, a button to turn it', () => {
  const w = weekLoad(DEF, { 's_2026-11-23_mo': { day: 'mo', date: '2026-11-23', sets: { pistol: [{ ok: true }] } } }, '2026-11-23');
  const svg = muscleFigure(w);
  assert.match(svg, /<div class="mfig"[^>]*>/);
  assert.match(svg, /class="mface front"[\s\S]*class="mface back"/);
  assert.match(svg, /data-m="quads"[^>]*style="--l:0\.\d+"[\s\S]*?<title>Quadrizeps: 1 von \d+ Sätzen<\/title>/);
  assert.match(svg, /data-m="chest"[^>]*style="--l:0"/);
  assert.match(svg, /<button type="button" class="btn sm" data-a="mflip"[^>]*>Drehen<\/button>/);
  assert.match(svg, /role="img" aria-label="Muskeln diese Woche:[^"]*Quadrizeps 1\/\d+/);
  const mini = muscleFigure(w, { mini: true });
  assert.doesNotMatch(mini, /data-a="mflip"/);
});

test('the training page and the overview show the figure for this week', () => {
  const store = createStore(memBackend());
  store.set('train.sess', { 's_2026-11-23_mo': { day: 'mo', date: '2026-11-23', sets: { pistol: [{ ok: true }] } } });
  const ctx = { store, now: () => new Date(2026, 10, 25, 9, 0), rerender() {}, toast() {}, go() {} };
  training.reload(ctx);
  const page = training.render({ area: 'training', view: 'day', day: null }, ctx);
  assert.match(page, /<section class="blk mbody">[\s\S]*Muskeln diese Woche[\s\S]*class="mfig"/);
  home.onNavigate(null, ctx);
  const tile = (home.render({ area: 'cockpit' }, ctx).split('data-w="train"')[1] || '').split('<section class="w ')[0];
  assert.match(tile, /class="mfig mini"/);
});
