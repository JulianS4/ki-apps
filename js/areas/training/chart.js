// Progress line chart with crosshair tooltip, and the small sparkline.
import { dshort, dfmt } from '../../core/dates.js';
import { esc } from '../../core/html.js';
import { fmtN, fmtSets, ticks, prKind } from './logic.js';

// Returns the SVG markup plus the point data bindChart() needs for the tooltip.
export function chartSvg(ex, pts, m, marks, width, dayName) {
  const W = Math.max(260, Math.round(width - 28)), H = 210, pl = 40, pr = 16, pt = 28, pb = 26;
  const ys = pts.map(p => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { const d = m.k === 'w' ? (ex.load === 'km' ? 1 : 2.5) : Math.max(1, Math.round(hi * .1)); lo = Math.max(0, lo - d); hi += d; }
  const tk = ticks(lo, hi, m.k === 'w' ? 0 : 1);
  lo = tk[0]; hi = tk[tk.length - 1];
  const ts = pts.map(p => new Date(p.date + 'T12:00:00').getTime()), a = Math.min(...ts), z = Math.max(...ts);
  const X = t => z === a ? (pl + W - pr) / 2 : pl + (t - a) / (z - a) * (W - pl - pr), Y = v => pt + (hi - v) / (hi - lo) * (H - pt - pb);
  const P = pts.map((p, i) => ({ x: +X(ts[i]).toFixed(1), y: +Y(p.y).toFixed(1), p, pr: marks.has(p.s) }));
  let g = tk.map(t => { const y = Y(t).toFixed(1); return `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 8}" y="${(+y + 4).toFixed(1)}" text-anchor="end">${fmtN(t)}</text>`; }).join('');
  g += `<text x="${pl}" y="${H - 4}">${dshort(pts[0].date)}</text><text x="${W - pr}" y="${H - 4}" text-anchor="end">${dshort(pts[pts.length - 1].date)}</text>`;
  g += `<line class="xh" y1="${pt - 8}" y2="${H - pb}" stroke="var(--mut)" stroke-width="1" style="display:none"/>`;
  g += `<path d="${P.map((q, i) => (i ? 'L' : 'M') + q.x + ' ' + q.y).join('')}" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const many = P.length > 40;
  g += P.map((q, i) => many && !q.pr && i < P.length - 1 ? ''
    : q.pr ? `<circle cx="${q.x}" cy="${q.y}" r="5" fill="var(--acc)" stroke="var(--card)" stroke-width="2"/>`
      : `<circle cx="${q.x}" cy="${q.y}" r="4" fill="var(--card)" stroke="var(--acc)" stroke-width="2"/>`).join('');
  const L = P[P.length - 1], mi = ys.lastIndexOf(Math.max(...ys)), M = P[mi];
  const lab = (q, txt) => `<text class="v" x="${q.x}" y="${(q.y - 12).toFixed(1)}" text-anchor="${q.x > W - pr - 44 ? 'end' : q.x < pl + 44 ? 'start' : 'middle'}">${esc(txt)}</text>`;
  g += lab(L, fmtN(L.p.y) + ' ' + m.unit);
  if (mi !== P.length - 1 && Math.abs(M.x - L.x) > 80) g += lab(M, fmtN(M.p.y));
  g += `<circle class="hl" r="8" fill="none" stroke="var(--ink)" stroke-width="2" style="display:none"/>`;
  const ch = {
    W,
    pts: P.map(q => ({
      x: q.x, y: q.y, val: fmtN(q.p.y) + ' ' + m.unit,
      lines: [dfmt(q.p.date) + ' · ' + dayName(q.p.s.day), fmtSets(q.p.s.sets[ex.id], ex), q.pr ? 'Rekord in dieser Einheit' : ''].filter(Boolean),
    })),
  };
  const html = `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m.label)}: ${pts.length} Einheiten, zuletzt ${esc(fmtN(L.p.y) + ' ' + m.unit)}">${g}</svg><div class="tip" aria-hidden="true"></div></div>` +
    (prKind(ex) ? '<p class="key"><span><i class="f"></i>Einheit mit Rekord</span><span><i class="h"></i>ohne Rekord</span></p>' : '');
  return { html, ch };
}

export function bindChart(root, ch) {
  const c = root.querySelector('.chart');
  if (!c || !ch) return;
  const svg = c.querySelector('svg'), tip = c.querySelector('.tip'), xh = c.querySelector('.xh'), hl = c.querySelector('.hl');
  const show = e => {
    const r = svg.getBoundingClientRect(), k = ch.W / r.width, x = (e.clientX - r.left) * k;
    let p = ch.pts[0];
    ch.pts.forEach(q => { if (Math.abs(q.x - x) < Math.abs(p.x - x)) p = q; });
    xh.setAttribute('x1', p.x); xh.setAttribute('x2', p.x); xh.style.display = '';
    hl.setAttribute('cx', p.x); hl.setAttribute('cy', p.y); hl.style.display = '';
    const b = document.createElement('b');
    b.textContent = p.val;
    tip.replaceChildren(b);
    p.lines.forEach(l => { const s = document.createElement('span'); s.textContent = l; tip.append(s); });
    tip.style.display = 'block';
    const px = r.left - c.getBoundingClientRect().left + p.x / k, tw = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(c.clientWidth - tw - 4, px > c.clientWidth / 2 ? px - tw - 16 : px + 16)) + 'px';
  };
  c.addEventListener('pointermove', show);
  c.addEventListener('pointerdown', show);
  c.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') tip.style.display = xh.style.display = hl.style.display = 'none'; });
}

export function spark(pts) {
  if (pts.length < 2) return '<span class="spark" style="width:72px"></span>';
  const W = 72, H = 28, ys = pts.map(p => p.y), lo = Math.min(...ys), hi = Math.max(...ys), n = pts.length;
  const P = pts.map((p, i) => [2 + i * (W - 6) / (n - 1), hi === lo ? H / 2 : H - 4 - (p.y - lo) / (hi - lo) * (H - 8)].map(v => v.toFixed(1)));
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${P.map(q => q.join(',')).join(' ')}" fill="none" stroke="var(--mut)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${P[n - 1][0]}" cy="${P[n - 1][1]}" r="3" fill="var(--acc)"/></svg>`;
}
