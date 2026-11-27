import test from 'node:test';
import assert from 'node:assert/strict';
import { graphData } from '../js/areas/cockpit/graph.js';
import { layout3d, project, pick, brainHtml, BRAINS } from '../js/areas/cockpit/brain.js';

const note = (id, title, body = '') => ({ id, title, body, tags: [] });
const NOTES = [note('a', 'Start', '[[Ziel]] [[Ende]]'), note('b', 'Ziel', '[[Ende]]'), note('c', 'Ende'), note('d', 'Allein'), note('e', 'Rand', '[[Allein]]')];

test('the 3D layout is the same every time, centred, inside a ball, linked notes close', () => {
  const g = graphData(NOTES), p1 = layout3d(g), p2 = layout3d(g);
  assert.deepEqual(p1, p2);
  assert.equal(p1.length, 5);
  for (const p of p1) assert.ok(Number.isFinite(p.x + p.y + p.z) && Math.hypot(p.x, p.y, p.z) <= 1.6, JSON.stringify(p));
  const c = ['x', 'y', 'z'].map(k => p1.reduce((s, p) => s + p[k], 0) / p1.length);
  for (const v of c) assert.ok(Math.abs(v) < 0.05, String(c));
  const d = (i, j) => Math.hypot(p1[i].x - p1[j].x, p1[i].y - p1[j].y, p1[i].z - p1[j].z);
  assert.ok(d(0, 1) < d(0, 3));
  assert.deepEqual(layout3d({ nodes: [], links: [] }), []);
  assert.deepEqual(layout3d({ nodes: [{ id: 'x', deg: 0 }], links: [] }), [{ x: 0, y: 0, z: 0 }]);
});

test('hundreds of notes form their network quickly', () => {
  const many = Array.from({ length: 800 }, (_, i) => note('n' + i, 'N' + i, `[[N${(i * 13) % 800}]] [[N${(i + 1) % 800}]]`));
  const t0 = Date.now(), p = layout3d(graphData(many));
  assert.equal(p.length, 800);
  assert.ok(Date.now() - t0 < 4000, `took ${Date.now() - t0} ms`);
});

test('projection: the centre stays centred, turning moves depth, near points look bigger', () => {
  const cam = { yaw: 0, pitch: 0, zoom: 1, w: 400, h: 300, d: 3 };
  assert.deepEqual(project({ x: 0, y: 0, z: 0 }, cam), { x: 200, y: 150, z: 0, f: 1 });
  const turned = project({ x: 1, y: 0, z: 0 }, { ...cam, yaw: Math.PI / 2 });
  assert.ok(Math.abs(turned.x - 200) < 1e-9 && Math.abs(turned.z + 1) < 1e-9, JSON.stringify(turned));
  assert.ok(project({ x: 0, y: 0, z: -1 }, cam).f > project({ x: 0, y: 0, z: 1 }, cam).f);
  const z2 = project({ x: 1, y: 0, z: 0 }, { ...cam, zoom: 2 }).x - 200;
  assert.ok(Math.abs(z2 - 2 * (project({ x: 1, y: 0, z: 0 }, cam).x - 200)) < 1e-9);
});

test('picking finds the point under the finger, the front one first, or nothing', () => {
  const P = [{ x: 100, y: 100, z: 0.5, f: 1 }, { x: 104, y: 100, z: -0.5, f: 1 }, { x: 300, y: 300, z: 0, f: 1 }];
  assert.equal(pick(P, 102, 100), 1);
  assert.equal(pick(P, 298, 302), 2);
  assert.equal(pick(P, 200, 200), -1);
  assert.equal(pick(P, 320, 300, 24), 2);
});

test('the brain is a labelled, focusable drawing that names its alternative', () => {
  const g = graphData(NOTES), html = brainHtml('main', g, layout3d(g), { hits: new Set(['b']) });
  assert.match(html, /<div class="brain" data-brain="main">/);
  assert.match(html, /<canvas[^>]*role="img"[^>]*aria-label="Wissensnetz in 3D: 5 Notizen, 4 Verbindungen[^"]*Dateiliste[^"]*"[^>]*tabindex="0"/);
  assert.deepEqual([...BRAINS.get('main').hits], ['b']);
  assert.equal(BRAINS.get('main').g.nodes.length, 5);
  assert.match(brainHtml('mini', g, layout3d(g), { mini: true }), /<div class="brain mini" data-brain="mini">[\s\S]*aria-hidden="true"/);
});
