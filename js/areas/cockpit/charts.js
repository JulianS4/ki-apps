// Interactive bar charts: period picker, legend that hides series, tooltip on
// hover, tap and arrow keys, and every value again as a table.
import { esc } from '../../core/html.js';
import { ticks } from '../training/logic.js';
import { periodRange, addDaysUtc } from './logic.js';

// Per-chart state survives redraws: period, free range, hidden series, measure.
const ST = {}, DEF = { flow: 'jahr' };
export function chartState(id, def = {}) {
  if (!ST[id]) ST[id] = { per: def.per || DEF[id] || 'monat', from: '', to: '', hidden: new Set(), measure: def.measure || '' };
  return ST[id];
}
export const resetCharts = ids => ids.forEach(id => { delete ST[id]; });

export const PICK = [['woche', 'Woche'], ['monat', 'Monat'], ['jahr', 'Jahr'], ['frei', 'Frei']];
// The range a chart shows; a free range that is incomplete or reversed falls back to the month.
export function rangeOf(id, today) {
  const s = chartState(id), r = s.per === 'frei' ? periodRange('frei', today, s) : periodRange(s.per, today);
  return r ? { ...r, ok: true } : { ...periodRange('monat', today), ok: false };
}
export function periodPicker(id, today) {
  const s = chartState(id), r = rangeOf(id, today);
  const seg = `<div class="seg" role="group" aria-label="Zeitraum">${PICK.map(([v, l]) => `<button type="button" data-a="per" data-chart="${id}" data-v="${v}" aria-pressed="${s.per === v}"${s.per === v ? ' class="on"' : ''}>${l}</button>`).join('')}</div>`;
  const free = s.per === 'frei' ? `<div class="cust"><label class="sr" for="${id}-from">Von</label><input class="tx" id="${id}-from" type="date" data-a="pdate" data-chart="${id}" data-k="from" value="${esc(s.from)}"><span>bis</span><label class="sr" for="${id}-to">Bis</label><input class="tx" id="${id}-to" type="date" data-a="pdate" data-chart="${id}" data-k="to" value="${esc(s.to)}"></div>` : '';
  const warn = s.per === 'frei' && !r.ok ? '<p class="err" role="alert">Zeitraum unvollständig oder „von“ liegt nach „bis“ – gezeigt wird der aktuelle Monat.</p>' : '';
  return `<div class="per">${seg}${free}</div>${warn}<p class="note">${esc(r.label)}</p>`;
}
// Clicks and changes the charts own; true when handled (the caller redraws).
export function chartClick(t, today) {
  const id = t.dataset.chart, a = t.dataset.a;
  if (!id || !['per', 'ser', 'meas'].includes(a)) return false;
  const s = chartState(id);
  if (a === 'per') {
    s.per = t.dataset.v;
    if (s.per === 'frei' && !s.from && !s.to) { s.to = today; s.from = addDaysUtc(today, -29); }
  } else if (a === 'ser') { if (s.hidden.has(t.dataset.k)) s.hidden.delete(t.dataset.k); else s.hidden.add(t.dataset.k); }
  else s.measure = t.dataset.v;
  return true;
}
export function chartChange(t) {
  if (t.dataset.a !== 'pdate' || !t.dataset.chart) return false;
  chartState(t.dataset.chart)[t.dataset.k === 'to' ? 'to' : 'from'] = t.value;
  return true;
}

// series: [{ key, name, cls: 's1'..'s4', values }]; missing[i] marks buckets without any entry.
export function barChart({ id, q, qs = '', buckets, series, hidden = new Set(), fmt, axisFmt = fmt, div = 1, stacked = false, missing = [], width = 600, foot = '' }) {
  const legend = `<div class="legend" role="group" aria-label="Datenreihen ein- und ausblenden">${series.map(s => `<button type="button" data-a="ser" data-chart="${id}" data-k="${esc(s.key)}" aria-pressed="${!hidden.has(s.key)}"><i class="c-${s.cls}" aria-hidden="true"></i>${esc(s.name)}</button>`).join('')}</div>`;
  const head = `<p class="q">${esc(q)}</p>${qs ? `<p class="qs">${qs}</p>` : ''}`;
  const table = `<details><summary>Werte als Tabelle</summary><div class="tblw"><table class="tbl"><thead><tr><th>Zeitraum</th>${series.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${buckets.map((b, i) => `<tr><td>${esc(b.long)}</td>${series.map(s => `<td>${esc(fmt(s.values[i]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  const any = series.some(s => s.values.some(v => v !== 0));
  if (!any) return { html: `<div class="ichart" data-chart="${id}">${head}<p class="cempty">Keine Werte in diesem Zeitraum.</p>${foot}</div>`, data: null };
  const vis = series.filter(s => !hidden.has(s.key));
  if (!vis.length) return { html: `<div class="ichart" data-chart="${id}">${head}${legend}<p class="cempty">Alle Reihen ausgeblendet – oben in der Legende wieder einblenden.</p>${table}${foot}</div>`, data: null };

  const W = Math.max(300, Math.round(width - 30)), H = 210, pl = 54, pr = 6, pt = 10, pb = 26, nb = buckets.length, band = (W - pl - pr) / nb;
  let lo = 0, hi = 0;
  buckets.forEach((b, i) => {
    if (stacked) {
      lo = Math.min(lo, vis.reduce((s, x) => s + Math.min(0, x.values[i]), 0));
      hi = Math.max(hi, vis.reduce((s, x) => s + Math.max(0, x.values[i]), 0));
    } else vis.forEach(x => { lo = Math.min(lo, x.values[i]); hi = Math.max(hi, x.values[i]); });
  });
  if (lo === hi) hi = lo + div;
  const tk = ticks(lo / div, hi / div, 1).map(v => v * div), y0 = tk[0], y1 = tk[tk.length - 1];
  const Y = v => pt + (y1 - v) / (y1 - y0) * (H - pt - pb);
  let g = `<g class="grid">${tk.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/>`).join('')}</g>`;
  g += tk.map(t => `<text x="${pl - 6}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${esc(axisFmt(t))}</text>`).join('');
  const step = Math.max(1, Math.ceil(nb / Math.floor((W - pl - pr) / 40)));
  g += buckets.map((b, i) => (i % step ? '' : `<text x="${(pl + band * (i + .5)).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(b.label)}</text>`)).join('');
  g += buckets.map((b, i) => `<rect class="hit" data-i="${i}" x="${(pl + band * i).toFixed(1)}" y="${pt}" width="${band.toFixed(1)}" height="${H - pt - pb}"/>`).join('');
  const rect = (cls, x, w, a, b2) => { const top = Math.min(Y(a), Y(b2)), h = Math.abs(Y(a) - Y(b2)); return h < 0.5 ? '' : `<rect class="bar ${cls}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${Math.max(1, w).toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>`; };
  buckets.forEach((b, i) => {
    const gw = band * 0.7, x0 = pl + band * i + (band - gw) / 2;
    if (stacked) {
      let up = 0, dn = 0;
      vis.forEach(s => { const v = s.values[i]; if (v > 0) { g += rect(s.cls, x0, gw, up, up + v); up += v; } else if (v < 0) { g += rect(s.cls, x0, gw, dn, dn + v); dn += v; } });
    } else {
      const k = vis.length, w = (gw - (k - 1) * 2) / k;
      vis.forEach((s, j) => { if (s.values[i]) g += rect(s.cls, x0 + j * (w + 2), w, 0, s.values[i]); });
    }
    if (missing[i]) g += `<text class="miss" x="${(pl + band * (i + .5)).toFixed(1)}" y="${(Y(0) - 4).toFixed(1)}" text-anchor="middle">–</text>`;
  });
  g += `<line class="base" x1="${pl}" x2="${W - pr}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>`;
  const rows = buckets.map((b, i) => ({ long: b.long, miss: !!missing[i], items: vis.map(s => ({ name: s.name, cls: s.cls, val: fmt(s.values[i]) })), total: stacked && vis.length > 1 ? fmt(vis.reduce((s, x) => s + x.values[i], 0)) : null }));
  const label = `${q} ${buckets.length} Zeiträume. Werte in der Tabelle darunter. Mit Pfeiltasten durch die Zeiträume gehen.`;
  const svg = `<div class="plot" tabindex="0" role="img" aria-label="${esc(label)}" data-chart="${id}"><svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${g}</svg><div class="tip" aria-hidden="true"></div></div><p class="sr" aria-live="polite" data-live="${id}"></p>`;
  return { html: `<div class="ichart" data-chart="${id}">${head}${legend}${svg}${table}${foot}</div>`, data: { W, pl, band, rows } };
}

// Tooltip: pointer (mouse and touch) and arrow keys on the focused chart.
export function bindBars(root, all) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('.ichart .plot').forEach(plot => {
    const d = all[plot.dataset.chart];
    if (!d) return;
    const tip = plot.querySelector('.tip'), svg = plot.querySelector('svg'), live = root.querySelector(`[data-live="${plot.dataset.chart}"]`);
    let cur = -1;
    const show = i => {
      cur = Math.max(0, Math.min(d.rows.length - 1, i));
      const r = d.rows[cur];
      plot.querySelectorAll('.hit').forEach(h => h.classList.toggle('on', +h.dataset.i === cur));
      const b = document.createElement('b');
      b.textContent = r.long;
      tip.replaceChildren(b);
      if (r.miss) { const m = document.createElement('div'); m.textContent = 'keine Einträge'; tip.append(m); }
      r.items.forEach(it => { const line = document.createElement('div'), sw = document.createElement('i'); sw.className = 'c-' + it.cls; line.append(sw, `${it.name}: ${it.val}`); tip.append(line); });
      if (r.total) { const t = document.createElement('div'); t.textContent = `Summe: ${r.total}`; tip.append(t); }
      tip.style.display = 'block';
      const k = svg.getBoundingClientRect().width / d.W, cx = (d.pl + d.band * (cur + 0.5)) * k, tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(plot.clientWidth - tw, cx > plot.clientWidth / 2 ? cx - tw - 12 : cx + 12)) + 'px';
      if (live) live.textContent = `${r.long}: ${r.items.map(it => `${it.name} ${it.val}`).join(', ')}`;
    };
    const hide = () => { tip.style.display = 'none'; plot.querySelectorAll('.hit.on').forEach(h => h.classList.remove('on')); };
    const at = e => { const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * d.W / r.width; return Math.floor((x - d.pl) / d.band); };
    plot.addEventListener('pointermove', e => show(at(e)));
    plot.addEventListener('pointerdown', e => show(at(e)));
    plot.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    plot.addEventListener('blur', hide);
    plot.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(cur < 0 ? (e.key === 'ArrowRight' ? 0 : d.rows.length - 1) : cur + (e.key === 'ArrowRight' ? 1 : -1)); }
      else if (e.key === 'Escape') hide();
    });
  });
}
