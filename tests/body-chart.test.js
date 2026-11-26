import test from 'node:test';
import assert from 'node:assert/strict';
import { lineChart } from '../js/areas/body/chart.js';
import { fmtTime } from '../js/areas/body/logic.js';

const two = [{ date: '2026-11-01', y: 93 }, { date: '2026-11-20', y: 92.4 }];

test('weight chart draws the goal line below the points', () => {
  const r = lineChart({ pts: two, label: 'Gewicht', unit: 'kg', goal: 90, width: 375 });
  assert.match(r.html, /class="goal"/);
  assert.match(r.html, /Ziel 90/);
  assert.equal(r.ch.pts.length, 2);
  assert.equal(r.ch.pts[1].val, '92,4 kg');
  const yGoal = +r.html.match(/class="goal"[^>]*y1="([\d.]+)"/)[1];
  assert.ok(yGoal > Math.max(...r.ch.pts.map(p => p.y)));
});

test('body fat band and time values', () => {
  const fat = lineChart({ pts: [{ date: '2026-11-01', y: 16 }, { date: '2026-11-20', y: 15 }], label: 'Körperfett', unit: '%', band: [12, 13], width: 375 });
  assert.match(fat.html, /class="band"/);
  assert.match(fat.html, /Ziel 12–13 %/);
  const run = lineChart({ pts: [{ date: '2026-10-01', y: 1500 }, { date: '2026-11-01', y: 1425 }], label: '5 km', unit: 'min', fmt: fmtTime, width: 375 });
  assert.equal(run.ch.pts[1].val, '23:45 min');
  assert.doesNotMatch(run.html, /class="goal"|class="band"/);
});
