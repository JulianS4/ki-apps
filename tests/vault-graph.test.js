import test from 'node:test';
import assert from 'node:assert/strict';
import { graphData, layout, graphSvg, localGraph } from '../js/areas/cockpit/graph.js';

const note = (id, title, body = '', path) => ({ id, title, body, tags: [], ...(path ? { path } : {}) });
const NOTES = [
  note('a', 'Start', 'Zu [[Ziel]] und [[Ziel|nochmal]], [[Fehlt]], [[Start]] und ![[Bild.png]]', 'Start.md'),
  note('b', 'Ziel', 'Zurück zu [[Start]], weiter zu [[Ende]]', 'Ordner/Ziel.md'),
  note('c', 'Ende', 'ohne Links'),
  note('d', 'Allein', ''),
];

test('every note is a node; each linked pair is one line, whichever way it links', () => {
  const g = graphData(NOTES);
  assert.deepEqual(g.nodes.map(n => [n.id, n.deg]), [['a', 1], ['b', 2], ['c', 1], ['d', 0]]);
  assert.deepEqual(g.links, [[0, 1], [1, 2]]);
  assert.equal(g.nodes[1].folder, 'Ordner');
});

test('the layout is the same every time, stays inside the frame and keeps linked notes close', () => {
  const g = graphData(NOTES), p1 = layout(g), p2 = layout(g);
  assert.deepEqual(p1, p2);
  for (const p of p1) assert.ok(p.x >= 20 && p.x <= 980 && p.y >= 20 && p.y <= 680 && Number.isFinite(p.x + p.y));
  const d = (i, j) => Math.hypot(p1[i].x - p1[j].x, p1[i].y - p1[j].y);
  assert.ok(d(0, 1) < d(0, 3));
  assert.deepEqual(layout({ nodes: [], links: [] }), []);
  assert.deepEqual(layout({ nodes: [{ id: 'x', deg: 0 }], links: [] }), [{ x: 500, y: 350 }]);
});

test('a few hundred notes lay out quickly', () => {
  const many = Array.from({ length: 600 }, (_, i) => note('n' + i, 'N' + i, `[[N${(i * 7) % 600}]] [[N${(i + 1) % 600}]]`));
  const t0 = Date.now(), p = layout(graphData(many));
  assert.equal(p.length, 600);
  assert.ok(Date.now() - t0 < 3000, `took ${Date.now() - t0} ms`);
});

test('the drawing: nodes are links that open the note, with names; hits and the open note are marked', () => {
  const g = graphData(NOTES), html = graphSvg(g, layout(g), { key: 'main', hits: new Set(['b']), focus: 'a' });
  assert.match(html, /<svg class="kg[^"]*"[^>]*role="group"[^>]*aria-label="Wissensgraph: 4 Notizen, 2 Verbindungen/);
  assert.equal((html.match(/<line /g) || []).length, 2);
  assert.match(html, /<a class="gn[^"]*" href="#wissen\/n-b" data-i="1"[^>]*aria-label="Ziel · 2 Verbindungen"/);
  assert.match(html, /<a class="gn[^"]*hit[^"]*" href="#wissen\/n-b"/);
  assert.match(html, /<a class="gn[^"]*cur[^"]*" href="#wissen\/n-a"/);
  assert.match(html, /<a class="gn[^"]*" href="#wissen\/n-d" data-i="3"[^>]*aria-label="Allein · keine Verbindung"/);
  assert.match(html, /<text[^>]*>Ziel<\/text>/);
  assert.match(html, /class="kg[^"]*searching/);
});

test('the local graph shows the note and its direct neighbours', () => {
  const l = localGraph(graphData(NOTES), 'b');
  assert.deepEqual(l.nodes.map(n => n.id), ['a', 'b', 'c']);
  assert.deepEqual(l.links, [[0, 1], [1, 2]]);
  assert.deepEqual(localGraph(graphData(NOTES), 'd').nodes.map(n => n.id), ['d']);
});
