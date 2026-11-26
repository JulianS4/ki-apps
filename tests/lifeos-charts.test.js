import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/areas/cockpit/logic.js';
import { barChart } from '../js/areas/cockpit/charts.js';

test('week, month, year and a free range', () => {
  assert.deepEqual(L.periodRange('woche', '2026-11-26'), { from: '2026-11-23', to: '2026-11-29', label: 'Woche 23.11.–29.11.' });
  assert.deepEqual(L.periodRange('frei', '2026-11-26', { from: '2026-10-05', to: '2026-11-02' }), { from: '2026-10-05', to: '2026-11-02', label: '5.10.2026–2.11.2026' });
  assert.equal(L.periodRange('frei', '2026-11-26', { from: '2026-11-02', to: '2026-10-05' }), null);
  assert.equal(L.periodRange('frei', '2026-11-26', { from: '', to: '2026-10-05' }), null);
});

test('buckets: days for a week, weeks for a month, months for a year', () => {
  const w = L.buckets(L.periodRange('woche', '2026-11-26'));
  assert.equal(w.length, 7);
  assert.deepEqual(w[0], { from: '2026-11-23', to: '2026-11-23', label: 'Mo', long: 'Mo 23.11.' });
  const m = L.buckets(L.periodRange('monat', '2026-11-26'));
  assert.deepEqual(m.map(b => [b.from, b.to]), [['2026-11-01', '2026-11-01'], ['2026-11-02', '2026-11-08'], ['2026-11-09', '2026-11-15'], ['2026-11-16', '2026-11-22'], ['2026-11-23', '2026-11-29'], ['2026-11-30', '2026-11-30']]);
  assert.equal(m[1].long, '2.11.–8.11.');
  const y = L.buckets(L.periodRange('jahr', '2026-11-26'));
  assert.equal(y.length, 12);
  assert.deepEqual(y[10], { from: '2026-11-01', to: '2026-11-30', label: 'Nov', long: 'November 2026' });
  assert.equal(L.buckets({ from: '2024-01-01', to: '2026-12-31' }).length, 36);
});

const CATS = [{ id: 'essen', kind: 'ausgabe', name: 'Essen' }, { id: 'gehalt', kind: 'einnahme', name: 'Gehalt' }, { id: 'sparen', kind: 'sparen', name: 'Sparen' }];

test('money flow per bucket, with the number of transactions behind each', () => {
  const tx = [{ d: '2026-11-03', amt: 100000, cat: 'gehalt' }, { d: '2026-11-04', amt: -2500, cat: 'essen' }, { d: '2026-11-20', amt: -5000, cat: 'sparen' }];
  const b = L.buckets(L.periodRange('monat', '2026-11-26')), f = L.flowSeries(tx, CATS, b);
  assert.deepEqual(f.inc, [0, 100000, 0, 0, 0, 0]);
  assert.deepEqual(f.exp, [0, 2500, 0, 0, 0, 0]);
  assert.deepEqual(f.save, [0, 0, 0, 5000, 0, 0]);
  assert.deepEqual(f.n, [0, 2, 0, 1, 0, 0]);
});

test('business log per project: the biggest three by name, the rest as "Weitere"', () => {
  const ps = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }];
  const log = [
    { d: '2026-11-02', proj: 'a', inc: 1000, exp: 0, min: 60 }, { d: '2026-11-03', proj: 'b', inc: 500, exp: 700, min: 30 },
    { d: '2026-11-10', proj: 'c', inc: 300, exp: 0, min: 0 }, { d: '2026-11-11', proj: 'd', inc: 100, exp: 0, min: 15 },
  ];
  const b = L.buckets(L.periodRange('monat', '2026-11-26'));
  const s = L.logSeries(log, ps, b, 'inc');
  assert.deepEqual(s.map(x => [x.key, x.name]), [['a', 'A'], ['b', 'B'], ['c', 'C'], ['_rest', 'Weitere']]);
  assert.deepEqual(s[0].values.slice(0, 3), [0, 1000, 0]);
  assert.deepEqual(s[3].values.slice(0, 3), [0, 0, 100]);
  assert.deepEqual(L.logSeries(log, ps, b, 'profit')[1].values.slice(0, 2), [0, -200]);
  assert.deepEqual(L.logSeries(log, ps, b, 'min').map(x => x.key), ['a', 'b', 'd']);
  assert.deepEqual(L.logSeries([], ps, b, 'inc'), []);
});

test('the chart lists every value as a table, hides toggled series, and says when there is nothing', () => {
  const buckets = [{ label: 'Okt', long: 'Oktober 2026' }, { label: 'Nov', long: 'November 2026' }];
  const series = [{ key: 'inc', name: 'Einnahmen', cls: 's1', values: [100000, 0] }, { key: 'exp', name: 'Ausgaben', cls: 's2', values: [2500, 5000] }];
  const fmt = c => (c / 100).toFixed(2).replace('.', ',') + ' €';
  const { html } = barChart({ id: 'flow', q: 'Wie entwickeln sich Einnahmen und Ausgaben?', buckets, series, hidden: new Set(['exp']), fmt, width: 600 });
  assert.match(html, /Wie entwickeln sich Einnahmen und Ausgaben\?/);
  assert.match(html, /data-a="ser" data-chart="flow" data-k="exp" aria-pressed="false"/);
  assert.match(html, /<td>Oktober 2026<\/td><td>1000,00 €<\/td><td>25,00 €<\/td>/);
  assert.equal((html.match(/class="bar s2"/g) || []).length, 0);
  assert.equal((html.match(/class="bar s1"/g) || []).length, 1);
  const none = barChart({ id: 'x', q: 'Q', buckets, series: series.map(s => ({ ...s, values: [0, 0] })), hidden: new Set(), fmt, width: 600 });
  assert.match(none.html, /Keine Werte in diesem Zeitraum/);
});
