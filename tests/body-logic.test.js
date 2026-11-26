import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNum, parseTime, fmtTime, fmtNum, checkForm, cleanLog, cleanPhotos, measureDays, series, quarterOf, quarterStatus } from '../js/areas/body/logic.js';
import { QUARTER_ITEMS, FIELDS } from '../js/areas/body/data.js';

test('numbers and times parse German input', () => {
  assert.equal(parseNum('92,4'), 92.4);
  assert.equal(parseNum(' 92.4 '), 92.4);
  assert.equal(parseNum('x'), null);
  assert.equal(parseNum(''), null);
  assert.equal(parseTime('23:45'), 1425);
  assert.equal(parseTime('1:30'), 90);
  assert.equal(parseTime('45'), 45);
  assert.equal(parseTime('1:75'), null);
  assert.equal(parseTime(''), null);
  assert.equal(fmtTime(1425), '23:45');
  assert.equal(fmtTime(90), '1:30');
  assert.equal(fmtNum(92.44), '92,4');
  assert.equal(fmtNum(15), '15');
});

test('checkForm keeps valid values, empties become null', () => {
  const r = checkForm({ kg: '92,4', fat: '', taille: '84', run5k: '23:45', hang: '1:30', mob: ' Hüfte steif ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.values, { kg: 92.4, fat: null, brust: null, taille: 84, huefte: null, arm: null, bein: null, wade: null, run5k: 1425, hang: 90, mob: 'Hüfte steif' });
});

test('checkForm rejects the whole form and names the field', () => {
  assert.deepEqual(checkForm({ kg: '300' }), { ok: false, error: 'Gewicht: 30–250 kg' });
  assert.deepEqual(checkForm({ kg: '90', run5k: '5:00' }), { ok: false, error: '5 km: 10:00–60:00 min' });
  assert.deepEqual(checkForm({ fat: 'viel' }), { ok: false, error: 'Körperfett: 3–60 %' });
  assert.deepEqual(checkForm({ wade: '5' }), { ok: false, error: 'Wade: 10–250 cm' });
  assert.equal(FIELDS.length, 10);
});

test('cleaning drops bad dates, fields and empty days', () => {
  const raw = { '2026-11-20': { fat: 15, taille: 'x', run5k: 1425, mob: 'ok', foo: 1 }, nope: { fat: 15 }, '2026-11-21': { fat: 99 }, '2026-11-22': 'x' };
  assert.deepEqual(cleanLog(raw), { '2026-11-20': { fat: 15, run5k: 1425, mob: 'ok' } });
  for (const bad of [null, 'x', [], 5]) assert.deepEqual(cleanLog(bad), {});
  assert.deepEqual(cleanPhotos({ '2026-11-02': { vorne: true, oben: true }, '2026-11-03': {}, x: { vorne: true } }), { '2026-11-02': { vorne: true } });
});

test('measure days and series', () => {
  const w = { '2026-11-01': 93, '2026-11-20': 92.4, x: 1, '2026-11-21': 500 }, log = { '2026-11-10': { fat: 15 }, '2026-11-20': { fat: 14.5 } };
  assert.deepEqual(measureDays(w, log), ['2026-11-20', '2026-11-10', '2026-11-01']);
  assert.deepEqual(series(w, log, 'kg'), [{ date: '2026-11-01', y: 93 }, { date: '2026-11-20', y: 92.4 }]);
  assert.deepEqual(series(w, log, 'fat'), [{ date: '2026-11-10', y: 15 }, { date: '2026-11-20', y: 14.5 }]);
});

test('quarters by entry date', () => {
  assert.equal(quarterOf('2026-11-26'), '2026-Q4');
  assert.equal(quarterOf('2026-01-01'), '2026-Q1');
  assert.equal(quarterOf('2026-03-31'), '2026-Q1');
  assert.equal(quarterOf('2026-04-01'), '2026-Q2');
});

test('quarter status: automatic by entry date, hand ticks add up', () => {
  const data = {
    weights: { '2026-10-01': 92, '2026-09-30': 93 },
    log: { '2026-12-31': { hang: 60 }, '2026-09-30': { run5k: 1500, brust: 100 } },
    photos: { '2026-11-02': { vorne: true } },
    ticks: { '2026-Q4': { plan: true, run5k: true }, '2026-Q3': { pain: true } },
  };
  const s = quarterStatus('2026-Q4', data);
  assert.equal(s.items.length, 8);
  assert.deepEqual(s.items.filter(i => i.done).map(i => i.id), ['weight', 'photos', 'run5k', 'plan', 'hang']);
  assert.equal(s.items.find(i => i.id === 'run5k').auto, false);
  assert.equal(s.items.find(i => i.id === 'run5k').hand, true);
  assert.equal(s.items.find(i => i.id === 'weight').auto, true);
  assert.deepEqual([s.done, s.total], [5, 8]);
  assert.doesNotThrow(() => quarterStatus('2026-Q4', { weights: 'x', log: null, photos: [], ticks: 5 }));
  assert.equal(QUARTER_ITEMS[5].label, 'Trainingsplan kritisch überprüfen');
  assert.equal(QUARTER_ITEMS[6].link, '#recovery');
});
