// Training screens: week day, history, exercise progress. Pure string rendering
// from the area state `st` ({plan, sess, selD, edit, exM, allEx, PR, CH}).
import { DAYS, DN, ds, dayIdx, monday, addDays, dfmt } from '../../core/dates.js';
import { esc } from '../../core/html.js';
import { CATS, UNIT } from './plan-default.js';
import { recoveryFor } from '../recovery/index.js';
import { DELOAD_RULES } from '../recovery/data.js';
import {
  num, fmtN, okSets, fmtSets, target, prKind, exDef, exHist, lastFor, dateOf, totals, weekDone,
  prScan, prOf, prCount, prText, metrics, series,
} from './logic.js';
import { chartSvg, spark } from './chart.js';

export const getDay = (st, id) => st.plan.days.find(d => d.id === id);
export const clock = ctx => { const now = ctx.now(); return { now, td: ds(now), mo: ds(monday(now)), ti: dayIdx(now) }; };
export const dateFor = (st, id, ctx) => { const c = clock(ctx); return dateOf(st.sess, id, st.selD, c.td, c.mo); };
export const keyFor = (st, id, ctx) => 's_' + dateFor(st, id, ctx) + '_' + id;
export const cur = (st, id, ctx) => st.sess[keyFor(st, id, ctx)];
export const todayId = ctx => DAYS[clock(ctx).ti];

const L = { day: id => '#training/' + id, ex: id => '#training/x-' + id };

function strip(st, sel, ctx) {
  const c = clock(ctx);
  return '<nav class="week" aria-label="Wochentage">' + DAYS.map((id, i) => {
    const d = new Date(c.mo + 'T12:00:00');
    d.setDate(d.getDate() + i);
    // Sunday is done once its week check in Recovery is filled in.
    const done = id === 'so' ? recoveryFor(ctx, addDays(c.mo, 6)).weeklyDone : weekDone(st.sess, id, c.mo);
    return `<a href="${L.day(id)}" class="${id === sel ? 'sel' : ''} ${i === c.ti ? 'today' : ''} ${done ? 'done' : ''}" aria-current="${id === sel ? 'page' : 'false'}"><b>${DN[id]}</b><span>${d.getDate()}.</span></a>`;
  }).join('') + '</nav>';
}

export function dayView(st, id, ctx) {
  const d = getDay(st, id), s = cur(st, id, ctx), { t, o } = totals(d, s), pct = t ? Math.round(o / t * 100) : 0;
  const c = clock(ctx), isToday = id === DAYS[c.ti];
  const ring = d.type === 'ruhe' ? '' : `<div class="ring" aria-label="${o} von ${t} Sätzen"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--line)" stroke-width="4"/><circle class="p" cx="20" cy="20" r="17" fill="none" stroke="var(--acc)" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 - pct}"/></svg><div class="n"><b${(o + '/' + t).length > 4 ? ' class="sm"' : ''}>${o}/${t}</b><span>Sätze</span></div></div>`;
  const dt = dateFor(st, id, ctx), past = dt !== c.td, rec = recoveryFor(ctx, dt), cy = rec.cycle, trains = d.type !== 'ruhe';
  const cyLine = !trains ? '' : cy.deload ? ' · Deload-Woche' : ` · Woche ${cy.week} · RIR ${cy.main}`;
  const opts = [...Array(14)].map((_, i) => { const k = addDays(c.td, -i); return `<option value="${k}"${k === dt ? ' selected' : ''}>${i === 0 ? 'Heute · ' : i === 1 ? 'Gestern · ' : ''}${dfmt(k)}</option>`; }).join('');
  const dsel = `<label class="dsel${past ? ' past' : ''}"><select data-a="date" aria-label="Datum dieser Einheit">${opts}</select></label>`;
  let h = strip(st, id, ctx) + `<div class="hero"><div><p class="k">${DN[id]}${isToday ? ' · heute' : ''}</p><h1>${esc(d.name)}</h1><p class="m">${esc(d.meta)}${cyLine}</p><div class="tools">${dsel}${d.type !== 'ruhe' ? `<button class="btn ${st.edit ? 'pri' : ''}" data-a="edit" type="button">${st.edit ? 'Fertig mit Bearbeiten' : 'Plan bearbeiten'}</button>` : ''}</div></div>${ring}</div>`;
  // Morning-check advice only for today's session; deload rules for the whole week.
  if (trains && !past && rec.ampel && rec.ampel.key !== 'gruen') h += `<div class="amp ${rec.ampel.key}" role="status"><p class="k"><i class="dot" aria-hidden="true"></i>Morgen-Check: ${rec.ampel.label}</p><b>${esc(rec.ampel.advice)}</b><a class="more" href="#recovery">Recovery ›</a></div>`;
  if (trains && cy.deload) h += `<div class="amp deload"><p class="k"><i class="dot" aria-hidden="true"></i>Deload-Woche · RIR ${cy.main}</p><ul>${DELOAD_RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
  if (d.warm && d.warm.length) h += `<section class="blk"><div class="bh"><h2>Warm-up</h2><p>${d.type === 'athletik' ? '10' : d.warm.length > 5 ? '8' : '5'} min</p></div><ul class="list">${d.warm.map((w, i) => `<li><label><input type="checkbox" data-a="warm" data-i="${i}" ${s && s.warm && s.warm[i] ? 'checked' : ''}>${esc(w)}</label></li>`).join('')}</ul></section>`;
  if (d.type === 'ruhe') h += `<section class="blk"><div class="cards"><a class="card" href="#recovery/woche"><p class="k">Wochen-Check → Recovery</p><b>${rec.weeklyDone ? 'Erledigt ✓' : 'Noch offen'}</b><span>Schlaf, Energie, Gelenke, Ziel · 15 min ›</span></a></div></section>`;
  d.blocks.forEach((b, bi) => {
    const kind = b.kind === 'super' ? 'Supersatz · abwechselnd' : b.kind === 'circuit' ? 'Zirkel' : '';
    h += `<section class="blk"><div class="bh"><h2>${esc(b.kind === 'single' ? b.label : 'Block ' + b.label)}</h2><p>${[kind, b.rest ? b.rest + ' s Pause' : ''].filter(Boolean).join(' · ')}</p></div>`;
    b.ex.forEach((ex, ei) => { h += exView(st, ex, b, bi, ei, s, dt); });
    if (st.edit) h += `<button class="add" data-a="add" data-b="${bi}" type="button">+ Übung zu ${esc(b.label)}</button>`;
    h += '</section>';
  });
  if (o > 0 && d.type !== 'ruhe') {
    h += d.type === 'cardio' ? `<div class="health"><p>Läufe landen schon über Strava bzw. Google Health in Apple Health. Nicht doppelt eintragen.</p></div>`
      : s.health ? `<div class="health"><p><b>✓ An Apple Health gesendet</b> · ${esc(s.health)}</p>${past ? '' : '<button class="btn" data-a="health" type="button">Nochmal senden</button>'}</div>`
        : past ? `<div class="health"><p><b>Einheit vom ${dfmt(dt)}</b> · An Apple Health senden geht nur am selben Tag, weil die Dauer aus den Uhrzeiten der Sätze kommt. Trag sie bei Bedarf direkt in der Health-App ein.</p></div>`
          : `<div class="health"><p><b>Fertig?</b> Training mit Dauer an Apple Health senden. Google Health übernimmt es von dort.</p><button class="btn pri" data-a="health" type="button">An Apple Health</button></div>`;
  }
  // The routine follows the weekday shown; done/open only when the session's
  // date falls on that weekday (a previewed later day has no status yet).
  const own = DAYS[dayIdx(new Date(dt + 'T12:00:00'))] === id;
  const m = own ? rec.mobility : recoveryFor(ctx, addDays(c.mo, DAYS.indexOf(id))).mobility;
  const mst = own ? (m.done ? 'erledigt' : 'offen ›') : '›';
  h += `<section class="blk"><div class="bh"><h2>Mobility</h2><p>in Recovery</p></div><ul class="list"><li><a class="go" href="#recovery"><span class="ck${own && m.done ? ' on' : ''}" aria-hidden="true">${own && m.done ? '✓' : ''}</span><span class="t">Mobility · Routine ${m.routine} · ${m.name} · ${m.minutes} min</span><span class="s">${mst}</span></a></li></ul></section>`;
  if (st.edit) h += `<section class="blk"><button class="btn red" data-a="reset" type="button">Ganzen Plan auf Notion-Stand zurücksetzen</button></section>`;
  return h;
}

function exView(st, ex, b, bi, ei, s, dt) {
  const tag = b.kind === 'single' ? String(ei + 1) : b.label + (ei + 1), last = lastFor(st.sess, ex.id, dt);
  const arr = (s && s.sets[ex.id]) || [], prs = prOf(st.PR, s, ex.id), pi = prs.reduce((a, f, i) => f ? i : a, -1);
  const up = last && ex.unit !== 'check' && last.filter(x => x && x.ok).length >= ex.sets && last.slice(0, ex.sets).every(x => x && x.ok && +x.v >= ex.max);
  let rows = '';
  for (let i = 0; i < ex.sets; i++) {
    const x = arr[i] || {}, lx = (last && last[i]) || {};
    const pv = lx.v || (ex.unit === 'check' ? '' : ex.max), pw = lx.w || '';
    const ld = ex.load ? `<label>${ex.load}<input id="i-${esc(ex.id)}-${i}-w" inputmode="decimal" data-f="w" data-e="${esc(ex.id)}" data-i="${i}" value="${esc(x.w)}" placeholder="${esc(pw || '0')}" aria-label="${ex.load} Satz ${i + 1}"></label>` : '<span class="sp"></span>';
    const vl = ex.unit !== 'check' ? `<label><input id="i-${esc(ex.id)}-${i}-v" inputmode="numeric" data-f="v" data-e="${esc(ex.id)}" data-i="${i}" value="${esc(x.v)}" placeholder="${esc(pv)}" aria-label="${UNIT[ex.unit]} Satz ${i + 1}">${UNIT[ex.unit]}</label>` : '<span class="sp"></span>';
    rows += `<div class="set ${x.ok ? 'ok' : ''} ${prs[i] ? 'pr' : ''}"><span class="no">${prs[i] ? 'PR' : i + 1}</span>${ex.load ? ld : vl}${ex.load ? vl : '<span class="sp"></span>'}<button class="chk" type="button" data-a="chk" data-e="${esc(ex.id)}" data-i="${i}" data-b="${bi}" aria-pressed="${!!x.ok}" aria-label="Satz ${i + 1} erledigt">✓</button></div>`;
  }
  return `<article class="ex" style="--c:var(--k-${esc(ex.cat)})"><div class="exh"><span class="tag">${esc(tag)}</span><h3><a class="exl" href="${L.ex(esc(ex.id))}">${esc(ex.name)}</a></h3>${st.edit ? `<button class="ed" data-a="exedit" data-b="${bi}" data-x="${ei}" type="button">Ändern</button>` : ''}</div>
  <p class="tgt">${esc(target(ex))}${ex.eq ? ` <i>· ${esc(ex.eq)}</i>` : ''}</p>${ex.note ? `<p class="note">${esc(ex.note)}</p>` : ''}
  <p class="last">${last ? 'Letztes Mal: <b>' + esc(fmtSets(last, ex)) + '</b>' : '<span class="note">Noch kein Eintrag</span>'}</p>${up ? `<span class="up">Alle Sätze oben – ${ex.load ? 'mehr Gewicht' : 'schwerere Variante'}</span>` : ''}${pi >= 0 ? `<span class="up pr">Rekord · ${esc(prText(ex, arr[pi]))}</span>` : ''}
  <div class="sets">${rows}</div></article>`;
}

function exList(st) {
  const ids = [];
  st.plan.days.forEach(d => d.blocks.forEach(b => b.ex.forEach(ex => { if (!ids.includes(ex.id)) ids.push(ex.id); })));
  Object.values(st.sess).forEach(s => s.sets && Object.keys(s.sets).forEach(id => { if (!ids.includes(id)) ids.push(id); }));
  const rows = ids.map(id => ({ id, h: exHist(st.sess, id) })).filter(o => o.h.length)
    .sort((a, b) => { const x = a.h[a.h.length - 1].date, y = b.h[b.h.length - 1].date; return x < y ? 1 : x > y ? -1 : 0; })
    .map(({ id, h }) => {
      const ex = exDef(st.plan, st.sess, id), ms = metrics(st.sess, ex), pts = ms.length ? series(st.sess, id, ms[0].k).slice(-12) : [];
      return `<li class="ln"><a href="${L.ex(esc(id))}"><span class="nm"><b>${esc(ex.name)}</b><small>Zuletzt ${esc(fmtSets(h[h.length - 1].sets[id], ex))}</small></span>${spark(pts)}<span class="chev" aria-hidden="true">›</span></a></li>`;
    });
  if (!rows.length) return '';
  return `<section class="blk"><div class="bh"><h2>Übungen</h2><p>Antippen für Fortschritt</p></div><ul class="rows">${(st.allEx ? rows : rows.slice(0, 6)).join('')}</ul>${rows.length > 6 ? `<button class="btn morebtn" data-a="exall" type="button">${st.allEx ? 'Weniger anzeigen' : 'Alle ' + rows.length + ' Übungen'}</button>` : ''}</section>`;
}

export function histView(st, ctx) {
  const c = clock(ctx);
  const all = Object.values(st.sess).filter(s => s.sets && Object.values(s.sets).some(a => a.some(x => x && x.ok)));
  const byDate = {};
  all.forEach(s => { const n = s.sets ? Object.values(s.sets).reduce((a, b) => a + b.filter(x => x && x.ok).length, 0) : 0; byDate[s.date] = Math.max(byDate[s.date] || 0, n >= 12 ? 2 : 1); });
  let g = '<div class="h"></div>' + DAYS.map(d => `<div class="h">${DN[d]}</div>`).join('');
  for (let w = 11; w >= 0; w--) {
    const st0 = addDays(c.mo, -w * 7), sd = new Date(st0 + 'T12:00:00');
    g += `<div class="w">${sd.getDate()}.${sd.getMonth() + 1}.</div>`;
    for (let i = 0; i < 7; i++) { const k = addDays(st0, i); g += `<div class="c ${byDate[k] ? 'f' + byDate[k] : ''} ${k === c.td ? 't' : ''}" title="${k}"></div>`; }
  }
  const m4 = addDays(c.mo, -27);
  const thisW = all.filter(s => s.date >= c.mo && s.day !== 'so').length, last4 = all.filter(s => s.date >= m4 && s.day !== 'so').length;
  const setsTot = all.reduce((a, s) => a + (s.sets ? Object.values(s.sets).reduce((x, y) => x + y.filter(z => z && z.ok).length, 0) : 0), 0);
  const pr4 = all.filter(s => s.date >= m4).reduce((a, s) => a + prCount(st.PR, s), 0);
  const list = all.sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 40).map(s => {
    const d = getDay(st, s.day), ents = Object.entries(s.sets || {}).filter(([, a]) => a.some(x => x && x.ok));
    const n = prCount(st.PR, s);
    const sum = ents.reduce((a, [, x]) => a + x.filter(z => z && z.ok).length, 0) + ' Sätze' + (n ? ' · ' + n + ' PR' : '');
    const items = ents.map(([id, a]) => { const ex = exDef(st.plan, st.sess, id); return `<li>${esc((s.n && s.n[id]) || ex.name)}<span>${esc(fmtSets(a, ex))}</span></li>`; }).join('');
    return `<details class="ses"><summary><b>${esc(d ? d.name : s.day)}</b><span>${dfmt(s.date)} · ${esc(sum)}</span></summary><ul>${items}</ul></details>`;
  }).join('');
  return `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">Letzte 12 Wochen</p><h1>Verlauf</h1></div></div>
  <div class="stats"><div><b>${thisW}</b><span>Einheiten diese Woche</span></div><div><b>${last4}</b><span>Einheiten in 4 Wochen</span></div><div><b>${setsTot}</b><span>Sätze gesamt</span></div><div><b>${pr4}</b><span>Rekorde in 4 Wochen</span></div></div>
  <div class="grid" aria-label="Trainingskalender">${g}</div>${exList(st)}
  <section class="blk"><div class="bh"><h2>Einheiten</h2><p>Antippen für Details</p></div>${list || '<p class="empty">Noch nichts eingetragen. Hake im Wochenplan deinen ersten Satz ab, dann erscheint er hier.</p>'}</section>`;
}

export function exDetail(st, id, width) {
  const ex = exDef(st.plan, st.sess, id), hist = exHist(st.sess, id), scan = prScan(st.sess, ex), ms = metrics(st.sess, ex);
  const m = ms.find(x => x.k === st.exM[id]) || ms[0], k = prKind(ex), U = UNIT[ex.unit] || '';
  let h = `<button class="back" data-a="back" type="button">‹ Zurück</button><div class="hero" style="grid-template-columns:1fr"><div><p class="k">Fortschritt${CATS[ex.cat] ? ' · ' + CATS[ex.cat] : ''}</p><h1>${esc(ex.name)}</h1><p class="m">${esc(target(ex))}${ex.eq ? ' · ' + esc(ex.eq) : ''}</p></div></div>`;
  if (!hist.length) return h + '<p class="empty">Noch kein Eintrag. Hake den ersten Satz dieser Übung ab, dann siehst du hier deinen Verlauf.</p>';
  const all = hist.flatMap(s => okSets(s.sets[id])), maxW = Math.max(0, ...all.map(x => num(x.w))), maxV = Math.max(0, ...all.map(x => num(x.v))), tiles = [];
  if (ex.unit === 'check') tiles.push([all.length, '', 'Sätze']);
  else if (ex.unit === 'min') { tiles.push([fmtN(all.reduce((a, x) => a + num(x.v), 0)), 'min', 'Gesamt']); if (maxW > 0) tiles.push([fmtN(maxW), ex.load, 'Weiteste']); }
  else if (maxW > 0) tiles.push([fmtN(maxW), 'kg', 'Höchstgewicht']);
  else tiles.push([fmtN(maxV), U, 'Bester Satz']);
  tiles.push([hist.length, '', 'Einheiten']);
  if (k) tiles.push([scan.count, '', 'Rekorde']);
  h += `<div class="stats s${tiles.length}">${tiles.map(([v, u, l]) => `<div><b>${esc(v)}${u ? `<small> ${esc(u)}</small>` : ''}</b><span>${l}</span></div>`).join('')}</div>`;
  if (m) {
    if (ms.length > 1) h += `<div class="seg" role="group" aria-label="Kennzahl">${ms.map(x => `<button type="button" data-a="metric" data-m="${x.k}" class="${x === m ? 'on' : ''}" aria-pressed="${x === m}">${x.label}</button>`).join('')}</div>`;
    const pts = series(st.sess, id, m.k);
    let chart = '<p class="empty">Ab der zweiten Einheit erscheint hier eine Kurve.</p>';
    if (pts.length > 1) {
      const r = chartSvg(ex, pts, m, scan.marks, width, day => (getDay(st, day) || {}).name || '');
      chart = r.html;
      st.CH = r.ch;
    }
    h += `<section class="blk"><div class="bh"><h2>${m.label}</h2><p>${m.k === 'w' ? 'schwerster Satz' : m.k === 'best' ? 'bester Satz' : 'Summe'} pro Einheit</p></div>${chart}</section>`;
  }
  if (k === 'wv' && maxW > 0 && scan.front.length) {
    const fr = [...scan.front].sort((a, b) => b.w - a.w).slice(0, 6);
    h += `<section class="blk"><div class="bh"><h2>Bestwerte</h2><p>meiste ${ex.unit === 'sec' ? 'Sekunden' : 'Wdh'} je Gewicht</p></div><ul class="rows">${fr.map(p => `<li><span class="nm"><b>${p.w ? fmtN(p.w) + ' kg' : 'Ohne Gewicht'}</b><small>${dfmt(p.date)}</small></span><span class="val">${fmtN(p.v)} ${U}</span></li>`).join('')}</ul></section>`;
  }
  h += `<section class="blk"><div class="bh"><h2>Einheiten</h2><p>${hist.length} insgesamt</p></div><ul class="rows">${[...hist].reverse().slice(0, 60).map(s => { const d = getDay(st, s.day); return `<li><span class="nm"><b>${dfmt(s.date)}</b><small>${esc(d ? d.name : s.day)}</small></span><span class="val">${esc(fmtSets(s.sets[id], ex))}</span>${scan.marks.has(s) ? '<span class="chip">PR</span>' : ''}</li>`; }).join('')}</ul></section>`;
  return h;
}
