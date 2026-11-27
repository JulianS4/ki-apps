// Projekte and the Business Log: status, next step, progress, tasks, links, and money/time per project.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import * as db from './db.js';
import { logStats, periodRange, fmtDur, fmtMoney, fmtEuro0, buckets, logSeries } from './logic.js';
import { PROJ_STATUS, label } from './data.js';
import { banner, hero, srcLine, pbar, empty, newBtn, editBtn, formIf, common, tick, target, today, edInput, onNavigateCommon, mountCommon, blurActive } from './ui.js';
import { barChart, bindBars, periodPicker, rangeOf, chartState, chartClick, chartChange, resetCharts } from './charts.js';
import { knowledgeBox, kbInput } from './knowledge.js';

let lproj = '', BARS = {};
const MEASURES = [['inc', 'Umsatz', 'Welches Projekt bringt Umsatz?'], ['profit', 'Gewinn', 'Welches Projekt bringt Gewinn?'], ['min', 'Stunden', 'Wohin gehen die Stunden?']];
const stats = s => `<div class="kv2"><div><span>Umsatz</span><b>${fmtMoney(s.inc)}</b></div><div><span>Kosten</span><b>${fmtMoney(s.exp)}</b></div><div><span>Gewinn</span><b class="${s.profit < 0 ? 'neg' : ''}">${fmtMoney(s.profit)}</b></div><div><span>Stunden</span><b>${fmtDur(s.min)}</b></div></div>`;
const order = { aktiv: 0, pausiert: 1, idee: 2, abgeschlossen: 3 };
const pname = (ps, id) => (ps.find(p => p.id === id) || { name: 'Projekt gelöscht' }).name;
const inRange = (e, r) => e.d >= r.from && e.d <= r.to;
const width = () => (typeof document !== 'undefined' && document.getElementById('main') ? document.getElementById('main').clientWidth : 600);
const logRow = (e, ps) => `<li><div class="nm"><b>${esc(e.text)}</b><small>${dfmt(e.d)} · ${esc(pname(ps, e.proj))}${e.min ? ' · ' + fmtDur(e.min) : ''}${e.src !== 'manuell' ? ' · ' + (e.src === 'beispiel' ? 'Beispiel' : 'importiert') : ''}</small></div><span class="vr">${e.inc ? `<span class="pos">+${fmtMoney(e.inc)}</span>` : ''}${e.exp ? `<span>−${fmtMoney(e.exp)}</span>` : ''}</span>${editBtn('log', e.id)}</li>`;
function nextStep(p, tasks, t) {
  const o = tasks.filter(x => x.proj === p.id && !x.done).sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : 1))[0];
  return o ? `Nächster Schritt: ${o.text}${o.due ? ` (${o.due < t ? 'überfällig' : dfmt(o.due)})` : ''}` : p.goal ? `Ziel: ${p.goal}` : 'Kein nächster Schritt eingetragen';
}

function list(ctx, t) {
  const ps = db.list(ctx, 'project').sort((a, b) => order[a.status] - order[b.status]), log = db.list(ctx, 'log'), tasks = db.list(ctx, 'ptask'), r = periodRange('monat', t);
  return `${hero('', 'Projekte', 'Status, nächster Schritt und Fortschritt deiner Projekte.')}<div class="pact">${newBtn('project', 'Projekt anlegen', null, 'btn pri')}<a class="btn" href="#business-log">Zum Business Log</a></div>
  <section class="blk">${formIf(ctx, 'project')}<div class="cgrid">${ps.map(p => {
    const m = logStats(log, { proj: p.id, range: r });
    return `<a class="ccard pcard" href="#projekte/p-${esc(p.id)}"><div class="ch"><h2>${esc(p.name)}</h2><span class="pill${p.status === 'aktiv' ? ' hot' : ' mute'}">${esc(label(PROJ_STATUS, p.status))}</span></div>
    <p class="note">${esc(nextStep(p, tasks, t))}</p>${pbar(p.prog, `Fortschritt ${p.prog} Prozent`)}<p class="note">${p.prog} % · diesen Monat ${fmtDur(m.min)} · Gewinn ${fmtMoney(m.profit)}</p>
    ${p.upd ? srcLine(p.src, p.upd, ctx, { label: 'aktualisiert' }) : '<span class="src">noch nicht bearbeitet</span>'}</a>`;
  }).join('')}</div></section>`;
}

function project(ctx, t, id) {
  const p = db.find(ctx, 'project', id);
  if (!p) return `${hero('Projekte', 'Projekt nicht gefunden')}<p><a class="back" href="#projekte">‹ Zu den Projekten</a></p>`;
  const r = rangeOf('proj', t), log = db.list(ctx, 'log').filter(e => e.proj === id), inR = log.filter(e => inRange(e, r)).sort((a, b) => (a.d < b.d ? 1 : -1));
  const tasks = db.list(ctx, 'ptask').filter(x => x.proj === id).sort((a, b) => a.done - b.done || ((a.due || '9') < (b.due || '9') ? -1 : 1));
  const notes = db.list(ctx, 'note').filter(n => n.projects.includes(id)), ps = db.list(ctx, 'project');
  return `<a class="back" href="#projekte">‹ Projekte</a>${hero('', esc(p.name), `${esc(label(PROJ_STATUS, p.status))} · ${esc(nextStep(p, tasks, t))}`)}
  <div class="pact">${newBtn('log', 'Log-Eintrag hinzufügen', { proj: id }, 'btn pri')}${newBtn('ptask', 'Aufgabe hinzufügen', { proj: id })}${editBtn('project', p.id, 'Projekt bearbeiten').replace('class="ed"', 'class="btn"')}</div>
  ${formIf(ctx, 'project')}${formIf(ctx, 'log', { hide: ['proj'] })}${formIf(ctx, 'ptask', { hide: ['proj'] })}${formIf(ctx, 'note')}
  <section class="blk"><div class="bh"><h2>Fortschritt</h2><p>${p.upd ? srcLine(p.src, p.upd, ctx, { label: 'aktualisiert' }) : 'noch nicht bearbeitet'}</p></div><div class="ex">${pbar(p.prog, `Fortschritt ${p.prog} Prozent`)}<p class="note">${p.prog} % geschafft${p.goal ? ' · Ziel: ' + esc(p.goal) : ''}</p></div></section>
  <section class="blk"><div class="bh"><h2>Zahlen</h2><p>aus dem Business Log</p></div>${periodPicker('proj', t)}${stats(logStats(log, { range: r }))}</section>
  <section class="blk"><div class="bh"><h2>Aufgaben</h2><p>${tasks.filter(x => !x.done).length} offen</p></div>
  ${tasks.length ? `<ul class="list">${tasks.map(x => `<li class="li"><input type="checkbox" data-a="tick" data-s="ptask" data-id="${esc(x.id)}"${x.done ? ' checked' : ''} aria-label="${esc(x.text)} erledigt"><span class="t${x.done ? ' done' : ''}">${esc(x.text)}${x.due ? `<small>fällig ${dfmt(x.due)}${!x.done && x.due < t ? ' · überfällig' : ''}</small>` : ''}</span>${editBtn('ptask', x.id)}</li>`).join('')}</ul>` : '<p class="note">Noch keine Aufgaben.</p>'}</section>
  <section class="blk"><div class="bh"><h2>Aktivitäten</h2><p>${esc(r.label)}</p></div>
  ${inR.length ? `<ul class="crows card-l">${inR.map(e => logRow(e, ps)).join('')}</ul>` : '<p class="note">Keine Einträge in diesem Zeitraum.</p>'}</section>
  <section class="blk prose"><div class="bh"><h2>Notizen & Links</h2></div><div class="ex">${p.notes ? `<p class="pre">${esc(p.notes)}</p>` : '<p class="note">Keine Notizen.</p>'}
  ${p.links.length ? `<ul class="links">${p.links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`).join('')}</ul>` : ''}</div>
  ${notes.length ? `<p class="fl note">Verknüpfte Notizen</p><ul class="crows card-l">${notes.map(n => `<li><a class="nm" href="#wissen/n-${esc(n.id)}"><b>${esc(n.title)}</b><small>${esc(n.tags.map(g => '#' + g).join(' '))}</small></a></li>`).join('')}</ul>` : ''}</section>
  ${knowledgeBox(ctx, { id: 'proj-' + p.id, about: p.name, q: p.name, prefer: notes.map(n => n.id), preset: { topic: 'business', projects: [p.id] } })}`;
}

function logView(ctx, t) {
  const r = rangeOf('log', t), ps = db.list(ctx, 'project'), all = db.list(ctx, 'log'), st = chartState('log'), meas = MEASURES.find(m => m[0] === st.measure) || MEASURES[0];
  const inR = all.filter(e => inRange(e, r)), shown = inR.filter(e => !lproj || e.proj === lproj).sort((a, b) => (a.d < b.d ? 1 : -1));
  const bks = buckets(r), series = logSeries(all, ps, bks, meas[0]).map((s, i) => ({ ...s, cls: s.key === '_rest' ? 's4' : `s${i + 1}` }));
  const fmt = meas[0] === 'min' ? v => fmtDur(v) : v => fmtMoney(v);
  const c = barChart({
    id: 'log', q: meas[2], qs: `${esc(r.label)} · aus ${inR.length} Log-Einträgen`, buckets: bks, series, hidden: st.hidden, stacked: true, width: width(),
    fmt, axisFmt: meas[0] === 'min' ? v => `${Math.round(v / 60)} h` : v => fmtEuro0(v / 100), div: meas[0] === 'min' ? 60 : 100,
    missing: bks.map(b => !inR.some(e => inRange(e, b))),
    foot: inR.length && bks.some(b => !inR.some(e => inRange(e, b))) ? '<p class="note miss">„–“ = keine Einträge in diesem Abschnitt.</p>' : '',
  });
  BARS = c.data ? { log: c.data } : {};
  const measSeg = `<div class="seg" role="group" aria-label="Messgröße">${MEASURES.map(([v, l]) => `<button type="button" data-a="meas" data-chart="log" data-v="${v}" aria-pressed="${v === meas[0]}"${v === meas[0] ? ' class="on"' : ''}>${l}</button>`).join('')}</div>`;
  const ids = [...new Set([...ps.filter(p => p.status === 'aktiv').map(p => p.id), ...inR.map(e => e.proj)])];
  const byProj = ids.map(id => ({ id, s: logStats(all, { proj: id, range: r }) }));
  return `${hero('', 'Business Log', 'Was du für deine Projekte tust – Zeit, Einnahmen und Ausgaben.')}<div class="pact">${newBtn('log', 'Eintrag hinzufügen', lproj ? { proj: lproj } : null, 'btn pri')}</div>
  ${formIf(ctx, 'log')}
  <section class="blk">${periodPicker('log', t)}${stats(logStats(all, { range: r }))}</section>
  <section class="blk"><div class="bh"><h2>Nach Projekt</h2><p>${esc(r.label)}</p></div>${measSeg}${c.html}
  <ul class="crows card-l">${byProj.map(x => `<li><a class="nm" href="#projekte/p-${esc(x.id)}"><b>${esc(pname(ps, x.id))}</b><small>Umsatz ${fmtMoney(x.s.inc)} · Kosten ${fmtMoney(x.s.exp)} · ${fmtDur(x.s.min)}</small></a><span class="vr"><span class="${x.s.profit < 0 ? 'neg' : ''}">${fmtMoney(x.s.profit)}</span><small>Gewinn</small></span></li>`).join('')}</ul></section>
  <section class="blk"><div class="bh"><h2>Einträge</h2><p>${shown.length}</p></div>
  <div class="cflt"><label class="dsel">Projekt<select data-a="lproj"><option value="">Alle</option>${ps.map(p => `<option value="${esc(p.id)}"${p.id === lproj ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
  ${shown.length ? `<ul class="crows card-l">${shown.map(e => logRow(e, ps)).join('')}</ul>` : empty(all.length ? 'Keine Einträge für diese Auswahl.' : 'Noch keine Einträge. Halte fest, was du für deine Projekte tust: Datum, Dauer, Einnahmen und Ausgaben.')}</section>
  ${formIf(ctx, 'note')}${knowledgeBox(ctx, {
    id: 'log', about: 'deine Projekte', mode: 'any', q: ids.map(id => pname(ps, id)).join(' ') || 'business projekt umsatz kunden',
    prefer: db.list(ctx, 'note').filter(n => n.projects.some(x => ids.includes(x))).map(n => n.id), preset: { topic: 'business' },
  })}`;
}

export function render(route, ctx) {
  const t = today(ctx);
  BARS = {};
  return banner(ctx) + (route.view === 'project' ? project(ctx, t, route.id) : route.view === 'log' ? logView(ctx, t) : list(ctx, t));
}
export const redrawOnResize = route => route.view === 'log';
export function onClick(e, route, ctx) {
  const t = target(e);
  if (!t || common(t, ctx)) return;
  if (chartClick(t, today(ctx))) { blurActive(); ctx.rerender(); }
}
export function onInput(e, route, ctx) { if (!kbInput(e.target, ctx)) edInput(e.target); }
export function onChange(e, route, ctx) {
  const t = e.target;
  if (edInput(t) || tick(t, ctx)) return;
  if (chartChange(t)) { ctx.rerender(); return; }
  if (t.dataset && t.dataset.a === 'lproj') { lproj = t.value; ctx.rerender(); }
}
export function onNavigate(next) { onNavigateCommon(); if (!next || next.area !== 'projects') { lproj = ''; resetCharts(['log', 'proj']); } }
export function mount(root) { mountCommon(); bindBars(root, BARS); }
