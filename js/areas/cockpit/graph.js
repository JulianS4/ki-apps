// Wissensgraph: notes are points, [[links]] are lines. The layout is computed once
// per set of notes and frame (same input, same picture) and drawn as SVG; moving
// and zooming only changes a transform, so the page never re-lays it out.
import { esc } from '../../core/html.js';
import { linkTargets, makeResolver } from './md.js';

export const W = 1000, H = 700;
const PAD = 20;
const dirOf = p => p.slice(0, Math.max(0, p.lastIndexOf('/')));

export function graphData(notes, r = makeResolver(notes)) {
  const idx = new Map(notes.map((n, i) => [n.id, i])), seen = new Set(), links = [], deg = notes.map(() => 0);
  notes.forEach((n, i) => {
    for (const l of linkTargets(n.body)) {
      const t = r.note(l.t, n.path), j = t ? idx.get(t.id) : undefined;
      if (j === undefined || j === i) continue;
      const k = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (seen.has(k)) continue;
      seen.add(k);
      links.push(i < j ? [i, j] : [j, i]);
      deg[i]++; deg[j]++;
    }
  });
  links.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { nodes: notes.map((n, i) => ({ id: n.id, title: n.title, deg: deg[i], folder: n.path ? dirOf(n.path) : '' })), links };
}

// Force layout (Fruchterman–Reingold with a grid for repulsion and a pull to the
// middle so loose notes stay in view). No randomness: hubs start in the centre.
export function layout(g, { w = W, h = H } = {}) {
  const n = g.nodes.length;
  if (!n) return [];
  if (n === 1) return [{ x: w / 2, y: h / 2 }];
  const X = new Float64Array(n), Y = new Float64Array(n), DX = new Float64Array(n), DY = new Float64Array(n), k = 1.5, C = 3 * k;
  g.nodes.map((x, i) => i).sort((a, b) => g.nodes[b].deg - g.nodes[a].deg || a - b)
    .forEach((i, rank) => { const a = rank * 2.399963, r = 1.6 * Math.sqrt(rank + 0.5); X[i] = r * Math.cos(a); Y[i] = r * Math.sin(a); });
  const iters = n <= 150 ? 300 : n <= 600 ? 160 : 90;
  let t = Math.max(2, Math.sqrt(n) / 2);
  for (let it = 0; it < iters; it++) {
    DX.fill(0); DY.fill(0);
    const grid = new Map(), cellOf = i => `${Math.floor(X[i] / C)},${Math.floor(Y[i] / C)}`;
    for (let i = 0; i < n; i++) { const c = cellOf(i), l = grid.get(c); if (l) l.push(i); else grid.set(c, [i]); }
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(X[i] / C), cy = Math.floor(Y[i] / C);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const l = grid.get(`${cx + ox},${cy + oy}`);
        if (!l) continue;
        for (const j of l) {
          if (j === i) continue;
          let dx = X[i] - X[j], dy = Y[i] - Y[j], d2 = dx * dx + dy * dy;
          if (d2 > C * C) continue;
          if (d2 < 1e-6) { dx = 0.01 * (i - j); dy = 0.01; d2 = dx * dx + dy * dy; }
          const f = (k * k) / d2;
          DX[i] += dx * f; DY[i] += dy * f;
        }
      }
    }
    for (const [a, b] of g.links) {
      const dx = X[a] - X[b], dy = Y[a] - Y[b], f = Math.sqrt(dx * dx + dy * dy) / k;
      DX[a] -= dx * f; DY[a] -= dy * f; DX[b] += dx * f; DY[b] += dy * f;
    }
    for (let i = 0; i < n; i++) {
      DX[i] -= 0.06 * X[i]; DY[i] -= 0.06 * Y[i];
      const d = Math.hypot(DX[i], DY[i]);
      if (d > 0) { const s = Math.min(d, t) / d; X[i] += DX[i] * s; Y[i] += DY[i] * s; }
    }
    t = Math.max(0.02, t * 0.975);
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); y0 = Math.min(y0, Y[i]); y1 = Math.max(y1, Y[i]); }
  const s = Math.min((w - 2 * PAD) / Math.max(x1 - x0, 1e-9), (h - 2 * PAD) / Math.max(y1 - y0, 1e-9), 60);
  const ox = (w - (x1 - x0) * s) / 2, oy = (h - (y1 - y0) * s) / 2, r1 = v => Math.round(v * 10) / 10;
  return Array.from({ length: n }, (_, i) => ({ x: r1(ox + (X[i] - x0) * s), y: r1(oy + (Y[i] - y0) * s) }));
}

// The last layout is kept: drawing the page again costs nothing.
let memo = { key: '', g: null, pos: null };
export function cachedGraph(notes, frame, r) {
  const key = `${frame.w}x${frame.h}|` + notes.map(n => `${n.id}:${n.title}:${n.path || ''}:${n.upd || ''}:${n.body.length}`).join('|');
  if (memo.key !== key) { const g = graphData(notes, r); memo = { key, g, pos: layout(g, frame) }; }
  return memo;
}

export function localGraph(g, id) {
  const i = g.nodes.findIndex(n => n.id === id);
  if (i < 0) return { nodes: [], links: [] };
  const keep = new Set([i]);
  for (const [a, b] of g.links) { if (a === i) keep.add(b); if (b === i) keep.add(a); }
  const idx = [...keep].sort((a, b) => a - b), at = new Map(idx.map((x, j) => [x, j]));
  return { nodes: idx.map(x => g.nodes[x]), links: g.links.filter(([a, b]) => keep.has(a) && keep.has(b)).map(([a, b]) => [at.get(a), at.get(b)]) };
}

const radius = d => Math.min(14, 5 + 2 * Math.sqrt(d)).toFixed(1);
const short = t => (t.length > 28 ? t.slice(0, 27) + '…' : t);
const conn = d => (d === 0 ? 'keine Verbindung' : d === 1 ? '1 Verbindung' : `${d} Verbindungen`);
export function graphSvg(g, pos, { key = 'main', hits = null, focus = '', w = W, h = H, allLabels = false } = {}) {
  const n = g.nodes.length, ids = g.nodes.map((x, i) => i);
  const named = new Set(allLabels || n <= 30 ? ids : ids.filter(i => g.nodes[i].deg > 0).sort((a, b) => g.nodes[b].deg - g.nodes[a].deg || a - b).slice(0, 15));
  const lines = g.links.map(([a, b]) => `<line x1="${pos[a].x}" y1="${pos[a].y}" x2="${pos[b].x}" y2="${pos[b].y}" data-s="${a}" data-t="${b}"/>`).join('');
  const nodes = g.nodes.map((x, i) => {
    const cls = ['gn', named.has(i) && 'lb', hits && hits.has(x.id) && 'hit', x.id === focus && 'cur'].filter(Boolean).join(' '), r = radius(x.deg);
    return `<a class="${cls}" href="#wissen/n-${esc(x.id)}" data-i="${i}" aria-label="${esc(x.title)} · ${conn(x.deg)}"><circle cx="${pos[i].x}" cy="${pos[i].y}" r="${r}"/><text x="${pos[i].x}" y="${(pos[i].y + +r + 14).toFixed(1)}">${esc(short(x.title))}</text></a>`;
  }).join('');
  return `<svg class="kg${hits ? ' searching' : ''}" viewBox="0 0 ${w} ${h}" role="group" aria-label="Wissensgraph: ${n} ${n === 1 ? 'Notiz' : 'Notizen'}, ${g.links.length} ${g.links.length === 1 ? 'Verbindung' : 'Verbindungen'}. Jeder Punkt öffnet eine Notiz; die Dateiliste enthält dieselben Notizen." tabindex="0" data-kg="${esc(key)}"><g class="vp"><g class="ed">${lines}</g><g class="nd">${nodes}</g></g></svg>`;
}

// ---- moving around: drag, pinch, Ctrl/⌘ + wheel, buttons and keys ----
const VIEW = new Map();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function viewOf(key) { if (!VIEW.has(key)) VIEW.set(key, { k: 1, x: 0, y: 0 }); return VIEW.get(key); }
export const resetViews = () => VIEW.clear();
function apply(svg) {
  const v = viewOf(svg.dataset.kg), vp = svg.querySelector('.vp');
  if (vp) vp.setAttribute('transform', `translate(${v.x.toFixed(1)} ${v.y.toFixed(1)}) scale(${v.k.toFixed(3)})`);
  svg.classList.toggle('zl', v.k >= 1.8);
}
function zoomAt(svg, cx, cy, f) {
  const v = viewOf(svg.dataset.kg), nk = clamp(v.k * f, 0.5, 6);
  v.x = cx - (cx - v.x) * (nk / v.k); v.y = cy - (cy - v.y) * (nk / v.k); v.k = nk;
  apply(svg);
}
// Toolbar: data-a="gz" data-k=<graph> data-v="in|out|fit".
export function graphZoom(key, how) {
  const svg = typeof document !== 'undefined' && document.querySelector(`svg.kg[data-kg="${key}"]`);
  if (!svg) return false;
  const vb = svg.viewBox.baseVal;
  if (how === 'fit') { VIEW.set(key, { k: 1, x: 0, y: 0 }); apply(svg); } else zoomAt(svg, vb.width / 2, vb.height / 2, how === 'in' ? 1.4 : 1 / 1.4);
  return true;
}
export function bindGraphs(root) {
  for (const svg of root.querySelectorAll('svg.kg')) {
    apply(svg);
    const v = () => viewOf(svg.dataset.kg), vb = svg.viewBox.baseVal;
    const toView = (cx, cy) => { const r = svg.getBoundingClientRect(), u = vb.width / (r.width || vb.width); return [(cx - r.left) * u, (cy - r.top) * u]; };
    const pts = new Map();
    let moved = false, start = null, pinch = null;
    const two = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m: toView((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; };
    svg.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      moved = false;
      start = { x: e.clientX, y: e.clientY, vx: v().x, vy: v().y };
      if (pts.size === 2) { const t = two(); pinch = { d: t.d, k: v().k, c: [(t.m[0] - v().x) / v().k, (t.m[1] - v().y) / v().k] }; }
    });
    svg.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size === 2) {
        const t = two(), s = v(), nk = clamp(pinch.k * t.d / pinch.d, 0.5, 6);
        s.k = nk; s.x = t.m[0] - pinch.c[0] * nk; s.y = t.m[1] - pinch.c[1] * nk; moved = true;
        return apply(svg);
      }
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) { moved = true; try { svg.setPointerCapture(e.pointerId); } catch (er) { /* older browsers */ } }
      const u = vb.width / (svg.getBoundingClientRect().width || vb.width), s = v();
      s.x = start.vx + dx * u; s.y = start.vy + dy * u;
      apply(svg);
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const [p] = pts.values(); start = { x: p[0], y: p[1], vx: v().x, vy: v().y }; }
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    // a drag that started on a point does not open it
    svg.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    svg.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const [cx, cy] = toView(e.clientX, e.clientY);
      zoomAt(svg, cx, cy, Math.exp(-clamp(e.deltaY, -60, 60) * 0.01));
    }, { passive: false });
    svg.addEventListener('keydown', e => {
      if (e.target !== svg) return;
      const s = v(), step = 40, keys = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (keys[e.key]) { s.x += keys[e.key][0]; s.y += keys[e.key][1]; apply(svg); }
      else if (e.key === '+' || e.key === '=') graphZoom(svg.dataset.kg, 'in');
      else if (e.key === '-') graphZoom(svg.dataset.kg, 'out');
      else if (e.key === '0') graphZoom(svg.dataset.kg, 'fit');
      else return;
      e.preventDefault();
    });
    // pointing at or focusing a note lights up its neighbours
    const lines = [...svg.querySelectorAll('.ed line')], nodes = [...svg.querySelectorAll('.gn')];
    const hl = i => {
      svg.classList.toggle('hov', i != null);
      for (const el of svg.querySelectorAll('.hl')) el.classList.remove('hl');
      if (i == null) return;
      nodes[i].classList.add('hl');
      for (const l of lines) if (+l.dataset.s === i || +l.dataset.t === i) { l.classList.add('hl'); nodes[+l.dataset.s === i ? +l.dataset.t : +l.dataset.s].classList.add('hl'); }
    };
    const nodeOf = el => (el && el.closest ? el.closest('.gn') : null);
    svg.addEventListener('pointerover', e => { if (e.pointerType !== 'touch') { const a = nodeOf(e.target); hl(a ? +a.dataset.i : null); } });
    svg.addEventListener('pointerleave', () => hl(null));
    svg.addEventListener('focusin', e => { const a = nodeOf(e.target); hl(a ? +a.dataset.i : null); });
    svg.addEventListener('focusout', () => hl(null));
  }
}
// Search marks: hits stay bright, the rest fades (no new layout).
export function markHits(root, ids) {
  for (const svg of root.querySelectorAll('svg.kg[data-kg="main"]')) {
    svg.classList.toggle('searching', !!ids);
    for (const a of svg.querySelectorAll('.gn')) a.classList.toggle('hit', !!ids && ids.has(a.getAttribute('href').slice(10)));
  }
}
