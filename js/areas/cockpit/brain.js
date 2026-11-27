// Wissen als Gehirn: the note graph laid out in 3D and drawn on a canvas as a slowly
// turning, glowing network with impulses running along the links. The pure parts
// (layout, projection, picking) are tested; the drawing loop runs only while the
// canvas is on screen, and stands still for people who ask for reduced motion.
import { esc } from '../../core/html.js';

// ---- layout: 3D force layout, hubs start in the middle, no randomness ----
export function layout3d(g) {
  const n = g.nodes.length;
  if (!n) return [];
  if (n === 1) return [{ x: 0, y: 0, z: 0 }];
  const X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n), DX = new Float64Array(n), DY = new Float64Array(n), DZ = new Float64Array(n);
  const k = 1.5, C = 3 * k;
  g.nodes.map((x, i) => i).sort((a, b) => g.nodes[b].deg - g.nodes[a].deg || a - b).forEach((i, rank) => {
    const t = (rank + 0.5) / n, phi = Math.acos(1 - 2 * t), th = rank * 2.399963, r = 1.4 * Math.cbrt(rank + 1);
    X[i] = r * Math.sin(phi) * Math.cos(th); Y[i] = r * Math.cos(phi); Z[i] = r * Math.sin(phi) * Math.sin(th);
  });
  const iters = n <= 150 ? 260 : n <= 600 ? 140 : 80;
  let temp = Math.max(2, Math.cbrt(n));
  for (let it = 0; it < iters; it++) {
    DX.fill(0); DY.fill(0); DZ.fill(0);
    const grid = new Map(), key = (a, b, c) => `${a},${b},${c}`;
    for (let i = 0; i < n; i++) { const c = key(Math.floor(X[i] / C), Math.floor(Y[i] / C), Math.floor(Z[i] / C)), l = grid.get(c); if (l) l.push(i); else grid.set(c, [i]); }
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(X[i] / C), cy = Math.floor(Y[i] / C), cz = Math.floor(Z[i] / C);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const l = grid.get(key(cx + a, cy + b, cz + c));
        if (!l) continue;
        for (const j of l) {
          if (j === i) continue;
          let dx = X[i] - X[j], dy = Y[i] - Y[j], dz = Z[i] - Z[j], d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > C * C) continue;
          if (d2 < 1e-6) { dx = 0.01 * (i - j); dy = 0.01; dz = 0.01 * ((i + j) % 3 - 1); d2 = dx * dx + dy * dy + dz * dz; }
          const f = (k * k) / d2;
          DX[i] += dx * f; DY[i] += dy * f; DZ[i] += dz * f;
        }
      }
    }
    for (const [a, b] of g.links) {
      const dx = X[a] - X[b], dy = Y[a] - Y[b], dz = Z[a] - Z[b], f = Math.sqrt(dx * dx + dy * dy + dz * dz) / k;
      DX[a] -= dx * f; DY[a] -= dy * f; DZ[a] -= dz * f; DX[b] += dx * f; DY[b] += dy * f; DZ[b] += dz * f;
    }
    for (let i = 0; i < n; i++) {
      DX[i] -= 0.06 * X[i]; DY[i] -= 0.06 * Y[i]; DZ[i] -= 0.06 * Z[i];
      const d = Math.hypot(DX[i], DY[i], DZ[i]);
      if (d > 0) { const s = Math.min(d, temp) / d; X[i] += DX[i] * s; Y[i] += DY[i] * s; Z[i] += DZ[i] * s; }
    }
    temp = Math.max(0.02, temp * 0.975);
  }
  // centre it and scale so that nine in ten notes sit inside the unit ball
  let mx = 0, my = 0, mz = 0;
  for (let i = 0; i < n; i++) { mx += X[i]; my += Y[i]; mz += Z[i]; }
  mx /= n; my /= n; mz /= n;
  const radii = Array.from({ length: n }, (_, i) => Math.hypot(X[i] - mx, Y[i] - my, Z[i] - mz)).sort((a, b) => a - b);
  const r90 = radii[Math.min(n - 1, Math.floor(n * 0.9))] || 1, s = 1 / Math.max(r90, 1e-9), r3 = v => Math.round(v * 1000) / 1000;
  const out = Array.from({ length: n }, (_, i) => ({ x: (X[i] - mx) * s, y: (Y[i] - my) * s, z: (Z[i] - mz) * s }));
  // far-off loners are pulled onto a shell just outside, so the whole brain stays in view
  for (const p of out) { const r = Math.hypot(p.x, p.y, p.z); if (r > 1.45) { const q = 1.45 / r; p.x *= q; p.y *= q; p.z *= q; } }
  return out.map(p => ({ x: r3(p.x), y: r3(p.y), z: r3(p.z) }));
}

// ---- camera: turn (yaw, pitch), perspective, zoom ----
export function project(p, c) {
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy, y2 = p.y * cp - z1 * sp, z2 = p.y * sp + z1 * cp;
  const f = c.d / (c.d + z2), s = Math.min(c.w, c.h) * 0.36 * c.zoom;
  return { x: c.w / 2 + x1 * f * s, y: c.h / 2 + y2 * f * s, z: z2, f };
}
// The point under (x, y) within r pixels; of several, the one nearest the viewer.
export function pick(P, x, y, r = 14) {
  let best = -1;
  for (let i = 0; i < P.length; i++) {
    if (Math.hypot(P[i].x - x, P[i].y - y) > r) continue;
    if (best < 0 || P[i].z < P[best].z) best = i;
  }
  return best;
}

// ---- markup; the data for the drawing loop is kept by key ----
export const BRAINS = new Map();
let memo = { key: '', pos: null };
// Same graph, same brain: the layout is computed once per set of notes and links.
export function cachedLayout(g) {
  const key = g.nodes.map(n => n.id).join('|') + '#' + g.links.map(l => l.join(':')).join('|');
  if (memo.key !== key) memo = { key, pos: layout3d(g) };
  return memo.pos;
}
export function brainHtml(key, g, pos, { hits = null, mini = false } = {}) {
  BRAINS.set(key, { g, pos, hits, mini });
  const n = g.nodes.length, l = g.links.length;
  const label = `Wissensnetz in 3D: ${n} ${n === 1 ? 'Notiz' : 'Notizen'}, ${l} ${l === 1 ? 'Verbindung' : 'Verbindungen'}. Ziehen dreht, Punkte öffnen Notizen; dieselben Notizen stehen in der Dateiliste und im 2D-Netz.`;
  return mini
    ? `<div class="brain mini" data-brain="${esc(key)}"><canvas aria-hidden="true"></canvas></div>`
    : `<div class="brain" data-brain="${esc(key)}"><canvas role="img" aria-label="${esc(label)}" tabindex="0"></canvas><div class="btip" aria-hidden="true" hidden></div><p class="bhud" aria-hidden="true"><span>Netz</span><b>${n}</b> Knoten · <b>${l}</b> Synapsen</p></div>`;
}

// ---- the drawing loop (browser only) ----
const VIEW = new Map(), LIVE = new Map();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function sprite(color, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), r = size / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, color); grd.addColorStop(0.18, color); grd.addColorStop(0.32, color.replace(/[\d.]+\)$/, '0.45)')); grd.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return c;
}
// Toolbar: data-a="bz" data-k=<brain> data-v="in|out|fit|spin".
export function brainCmd(key, v) {
  const s = VIEW.get(key), live = LIVE.get(key);
  if (!s) return false;
  if (v === 'in') s.zoom = clamp(s.zoom * 1.25, 0.5, 4);
  else if (v === 'out') s.zoom = clamp(s.zoom / 1.25, 0.5, 4);
  else if (v === 'fit') { s.zoom = 1; s.pitch = -0.25; }
  else if (v === 'spin') s.spin = !s.spin;
  if (live) live.touch();
  return s.spin;
}
export const brainSpinning = key => !!(VIEW.get(key) && VIEW.get(key).spin);
// Search: hits glow, the rest dims; no new layout.
export function brainHits(key, ids) {
  const b = BRAINS.get(key), live = LIVE.get(key);
  if (b) b.hits = ids;
  if (live) live.touch();
}

export function bindBrains(root) {
  if (typeof window === 'undefined') return;
  for (const box of root.querySelectorAll('.brain[data-brain]')) {
    const key = box.dataset.brain, data = BRAINS.get(key), cv = box.querySelector('canvas');
    if (data && cv) run(box, cv, key, data);
  }
}

function run(box, cv, key, data) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const old = LIVE.get(key);
  if (old) old.stop();
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches), mini = data.mini;
  if (!VIEW.has(key)) VIEW.set(key, { yaw: 0.7, pitch: -0.25, zoom: 1, spin: !reduce });
  const st = VIEW.get(key), { g, pos } = data, n = g.nodes.length, tip = box.querySelector('.btip');
  const adj = g.nodes.map(() => new Set());
  for (const [a, b] of g.links) { adj[a].add(b); adj[b].add(a); }
  const top = new Set(g.nodes.map((x, i) => i).filter(i => g.nodes[i].deg > 0).sort((a, b) => g.nodes[b].deg - g.nodes[a].deg).slice(0, mini ? 0 : 10));
  const SAGE = sprite('rgba(142,182,155,1)'), MINT = sprite('rgba(218,241,222,1)');
  const sparks = reduce || !g.links.length ? [] : Array.from({ length: Math.min(g.links.length, mini ? 24 : 140) }, (_, i) => ({ e: (i * 7919) % g.links.length, t: (i * 0.137) % 1, sp: 0.00018 + ((i * 31) % 17) / 40000 }));
  let w = 0, h = 0, dpr = 1, P = [], hover = -1, down = null, moved = false, resume = 0, raf = 0, dirty = true, visible = true, stopped = false, last = 0;
  const pts = new Map();
  let pinch = null;
  const size = () => {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1); w = r.width; h = r.height;
    cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
    dirty = true;
  };
  size();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
  if (ro) ro.observe(cv);
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) { dirty = true; } }) : null;
  if (io) io.observe(cv);
  const cam = () => ({ yaw: st.yaw, pitch: st.pitch, zoom: st.zoom, w, h, d: 3.2 });

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const c = cam(), R = Math.min(w, h) * 0.36 * st.zoom, cx = w / 2, cy = h / 2;
    // holographic frame: rings and a turning tick ring
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(142,182,155,0.10)';
    for (const m of [1.18, 1.42]) { ctx.beginPath(); ctx.arc(cx, cy, R * m, 0, Math.PI * 2); ctx.stroke(); }
    if (!mini) {
      const a0 = reduce ? 0 : now * 0.00008;
      ctx.strokeStyle = 'rgba(142,182,155,0.28)';
      ctx.beginPath();
      for (let i = 0; i < 72; i++) { const a = a0 + i * Math.PI / 36, r1 = R * 1.3, r2 = R * (i % 6 ? 1.33 : 1.37); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(218,241,222,0.22)';
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.42, -a0 * 2, -a0 * 2 + 0.9); ctx.stroke();
    }
    P = pos.map(p => project(p, c));
    const hits = data.hits, lit = hover >= 0 ? new Set([hover, ...adj[hover]]) : null;
    // links, fainter with depth
    for (let i = 0; i < g.links.length; i++) {
      const [a, b] = g.links[i], A = P[a], B = P[b], on = lit && lit.has(a) && lit.has(b) && (a === hover || b === hover);
      const depth = clamp(((A.f + B.f) / 2 - 0.72) * 1.6, 0.05, 1);
      ctx.strokeStyle = on ? 'rgba(218,241,222,0.9)' : `rgba(142,182,155,${((lit || hits ? 0.08 : 0.22) * depth + 0.04).toFixed(3)})`;
      ctx.lineWidth = on ? 1.6 : 0.8;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    }
    // impulses along the links
    for (const s of sparks) {
      const [a, b] = g.links[s.e], A = P[a], B = P[b], x = A.x + (B.x - A.x) * s.t, y = A.y + (B.y - A.y) * s.t, f = A.f + (B.f - A.f) * s.t, r = 7 * f;
      ctx.globalAlpha = 0.85 * clamp(Math.sin(s.t * Math.PI) * 1.4, 0, 1);
      ctx.drawImage(MINT, x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    // notes, far ones first
    const order = P.map((p, i) => i).sort((i, j) => P[j].z - P[i].z);
    for (const i of order) {
      const p = P[i], deg = g.nodes[i].deg, hit = hits && hits.has(g.nodes[i].id), base = (mini ? 1.4 : 2.2) + Math.sqrt(deg) * (mini ? 0.9 : 1.4), r = base * p.f * 3.2;
      const dim = (lit && !lit.has(i)) || (hits && !hit);
      ctx.globalAlpha = (dim ? 0.18 : 1) * clamp((p.f - 0.6) * 1.5, 0.25, 1);
      ctx.drawImage(hit || i === hover || (lit && lit.has(i)) ? MINT : SAGE, p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    // names: the biggest hubs, and what you point at
    if (!mini) {
      ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      const named = lit ? [...lit] : hits ? [...top, ...g.nodes.map((x, i) => i).filter(i => hits.has(g.nodes[i].id))] : [...top];
      for (const i of new Set(named)) {
        const p = P[i], t = g.nodes[i].title, s = t.length > 26 ? t.slice(0, 25) + '…' : t;
        ctx.globalAlpha = i === hover ? 1 : clamp((p.f - 0.7) * 2.2, 0.25, 0.85);
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,31,32,0.9)'; ctx.strokeText(s, p.x, p.y - 10 * p.f - 6);
        ctx.fillStyle = i === hover || (lit && lit.has(i)) ? '#DAF1DE' : '#8EB69B';
        ctx.fillText(s, p.x, p.y - 10 * p.f - 6);
      }
      ctx.globalAlpha = 1;
    }
  }
  function frame(now) {
    if (stopped) return;
    if (!cv.isConnected) { stop(); return; }
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = now; return; }
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    const moving = !reduce && (st.spin && !down && now > resume);
    if (moving) st.yaw += dt * 0.00011;
    if (!reduce) for (const s of sparks) { s.t += dt * s.sp; if (s.t > 1) { s.t = 0; s.e = (s.e + 37) % g.links.length; } }
    if (moving || sparks.length || dirty) { draw(now); dirty = false; }
  }
  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    if (io) io.disconnect();
    if (LIVE.get(key) && LIVE.get(key).stop === stop) LIVE.delete(key);
  }
  LIVE.set(key, { stop, touch: () => { dirty = true; resume = performance.now() + 3500; } });
  raf = requestAnimationFrame(frame);
  if (mini || !n) return;

  // ---- moving it: drag turns, two fingers or Ctrl/⌘ + wheel zoom, keys, tap opens ----
  const at = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const showTip = i => {
    if (!tip) return;
    if (i < 0) { tip.hidden = true; return; }
    const p = P[i], d = g.nodes[i].deg;
    tip.innerHTML = `<b>${esc(g.nodes[i].title)}</b><small>${d === 0 ? 'keine Verbindung' : d === 1 ? '1 Verbindung' : `${d} Verbindungen`} · öffnen</small>`;
    tip.style.left = `${Math.round(p.x)}px`; tip.style.top = `${Math.round(p.y)}px`;
    tip.hidden = false;
  };
  cv.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, at(e));
    down = { x: e.clientX, y: e.clientY, yaw: st.yaw, pitch: st.pitch };
    moved = false;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: st.zoom }; }
  });
  cv.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, at(e));
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; st.zoom = clamp(pinch.z * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d), 0.5, 4); moved = true; dirty = true; return; }
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) { moved = true; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* older browsers */ } }
      st.yaw = down.yaw + dx * 0.008; st.pitch = clamp(down.pitch + dy * 0.008, -1.3, 1.3);
      hover = -1; showTip(-1); dirty = true;
      return;
    }
    if (e.pointerType === 'touch') return;
    const [x, y] = at(e), i = pick(P, x, y, 14);
    if (i !== hover) { hover = i; dirty = true; cv.style.cursor = i >= 0 ? 'pointer' : ''; showTip(i); }
  });
  const up = e => {
    const wasDown = !!down, tap = wasDown && !moved && pts.size <= 1;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) down = null;
    resume = performance.now() + 3500;
    if (tap && e.type === 'pointerup') {
      const [x, y] = at(e), i = pick(P, x, y, e.pointerType === 'touch' ? 24 : 14);
      if (i >= 0) location.hash = '#wissen/n-' + g.nodes[i].id;
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (!down) { hover = -1; showTip(-1); dirty = true; } });
  cv.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    st.zoom = clamp(st.zoom * Math.exp(-clamp(e.deltaY, -60, 60) * 0.01), 0.5, 4);
    resume = performance.now() + 3500; dirty = true;
  }, { passive: false });
  cv.addEventListener('keydown', e => {
    const k = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
    if (k) { st.yaw += k[0]; st.pitch = clamp(st.pitch + k[1], -1.3, 1.3); }
    else if (e.key === '+' || e.key === '=') st.zoom = clamp(st.zoom * 1.25, 0.5, 4);
    else if (e.key === '-') st.zoom = clamp(st.zoom / 1.25, 0.5, 4);
    else if (e.key === '0') { st.zoom = 1; st.pitch = -0.25; }
    else if (e.key === ' ') st.spin = !st.spin;
    else return;
    e.preventDefault();
    resume = performance.now() + 3500; dirty = true;
  });
}
