// Body curves in the look of the training progress chart. The returned `ch`
// fits bindChart() from the training area, which drives the tooltip.
import { dfmt, dshort } from '../../core/dates.js';
import { esc } from '../../core/html.js';
import { ticks } from '../training/logic.js';
import { fmtNum } from './logic.js';

export function lineChart({ pts, label, unit, fmt = fmtNum, goal = null, band = null, step = 0.5, width }) {
  const W = Math.max(260, Math.round((width || 600) - 28)), H = 190, pl = 44, pr = 16, pt = 28, pb = 26;
  const ys = pts.map(p => p.y), extra = [goal, ...(band || [])].filter(v => v != null);
  let lo = Math.min(...ys, ...extra), hi = Math.max(...ys, ...extra);
  if (lo === hi) { const d = Math.max(step, Math.abs(hi) * 0.05); lo -= d; hi += d; }
  const tk = ticks(lo, hi, step);
  lo = tk[0];
  hi = tk[tk.length - 1];
  const ts = pts.map(p => new Date(p.date + 'T12:00:00').getTime()), a = Math.min(...ts), z = Math.max(...ts);
  const X = t => (z === a ? (pl + W - pr) / 2 : pl + (t - a) / (z - a) * (W - pl - pr)), Y = v => pt + (hi - v) / (hi - lo) * (H - pt - pb);
  const P = pts.map((p, i) => ({ x: +X(ts[i]).toFixed(1), y: +Y(p.y).toFixed(1), p }));
  let g = tk.map(t => { const y = Y(t).toFixed(1); return `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 8}" y="${(+y + 4).toFixed(1)}" text-anchor="end">${esc(fmt(t))}</text>`; }).join('');
  // Goal first, so the curve and its points sit on top of it.
  if (band) {
    const y1 = +Y(band[1]).toFixed(1), y2 = +Y(band[0]).toFixed(1);
    g += `<rect class="band" x="${pl}" y="${y1}" width="${W - pr - pl}" height="${Math.max(1, y2 - y1).toFixed(1)}"/><text class="gl" x="${pl + 4}" y="${(y1 - 4).toFixed(1)}">Ziel ${band.map(fmtNum).join('–')} ${esc(unit)}</text>`;
  }
  if (goal != null) {
    const y = Y(goal).toFixed(1);
    g += `<line class="goal" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/><text class="gl" x="${pl + 4}" y="${(+y - 4).toFixed(1)}">Ziel ${esc(fmt(goal))}</text>`;
  }
  g += `<text x="${pl}" y="${H - 4}">${dshort(pts[0].date)}</text><text x="${W - pr}" y="${H - 4}" text-anchor="end">${dshort(pts[pts.length - 1].date)}</text>`;
  g += `<line class="xh" y1="${pt - 8}" y2="${H - pb}" stroke="var(--mut)" stroke-width="1" style="display:none"/>`;
  g += `<path d="${P.map((q, i) => (i ? 'L' : 'M') + q.x + ' ' + q.y).join('')}" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  g += P.map(q => `<circle cx="${q.x}" cy="${q.y}" r="4" fill="var(--card)" stroke="var(--acc)" stroke-width="2"/>`).join('');
  const L = P[P.length - 1], lastVal = fmt(L.p.y) + ' ' + unit;
  g += `<text class="v" x="${L.x}" y="${(L.y - 12).toFixed(1)}" text-anchor="${L.x > W - pr - 44 ? 'end' : 'middle'}">${esc(lastVal)}</text>`;
  g += `<circle class="hl" r="8" fill="none" stroke="var(--ink)" stroke-width="2" style="display:none"/>`;
  const ch = { W, pts: P.map(q => ({ x: q.x, y: q.y, val: fmt(q.p.y) + ' ' + unit, lines: [dfmt(q.p.date)] })) };
  const html = `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}: ${pts.length} Messungen, zuletzt ${esc(lastVal)}">${g}</svg><div class="tip" aria-hidden="true"></div></div>`;
  return { html, ch };
}
