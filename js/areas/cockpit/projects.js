// Projekte and the Business Log: status, goal, progress, tasks, links, and money/time per project.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import * as db from './db.js';
import { logStats, periodRange, PERIODS, fmtDur, fmtMoney } from './logic.js';
import { PROJ_STATUS, label } from './data.js';
import { banner, hero, srcLine, pbar, empty, newBtn, editBtn, seg, formIf, common, tick, target, today, edInput, onNavigateCommon, mountCommon } from './ui.js';

let per = 'monat', lproj = '';
const tabs = v => `<nav class="csub" aria-label="Projekte"><a href="#projekte"${v !== 'log' ? ' class="on" aria-current="page"' : ''}>Projekte</a><a href="#projekte/log"${v === 'log' ? ' class="on" aria-current="page"' : ''}>Business Log</a></nav>`;
const stats = s => `<div class="kv2"><div><span>Umsatz</span><b>${fmtMoney(s.inc)}</b></div><div><span>Kosten</span><b>${fmtMoney(s.exp)}</b></div><div><span>Gewinn</span><b class="${s.profit < 0 ? 'neg' : ''}">${fmtMoney(s.profit)}</b></div><div><span>Stunden</span><b>${fmtDur(s.min)}</b></div></div>`;
const order = { aktiv: 0, pausiert: 1, idee: 2, abgeschlossen: 3 };
const pname = (ps, id) => (ps.find(p => p.id === id) || { name: 'Projekt gelöscht' }).name;
const logRow = (e, ps) => `<li><div class="nm"><b>${esc(e.text)}</b><small>${dfmt(e.d)} · ${esc(pname(ps, e.proj))}${e.min ? ' · ' + fmtDur(e.min) : ''}${e.src !== 'manuell' ? ' · ' + (e.src === 'beispiel' ? 'Beispiel' : 'importiert') : ''}</small></div><span class="vr">${e.inc ? `<span class="pos">+${fmtMoney(e.inc)}</span>` : ''}${e.exp ? `<span>−${fmtMoney(e.exp)}</span>` : ''}</span>${editBtn('log', e.id)}</li>`;

function list(ctx, t) {
  const ps = db.list(ctx, 'project').sort((a, b) => order[a.status] - order[b.status]), log = db.list(ctx, 'log'), r = periodRange('monat', t);
  return `${hero('Projekte', 'Projekte')}${tabs('list')}<section class="blk">${formIf(ctx, 'project')}<div class="cgrid">${ps.map(p => {
    const m = logStats(log, { proj: p.id, range: r });
    return `<a class="ccard pcard" href="#projekte/p-${esc(p.id)}"><div class="ch"><h2>${esc(p.name)}</h2><span class="pill${p.status === 'aktiv' ? ' hot' : ' mute'}">${esc(label(PROJ_STATUS, p.status))}</span></div>
    <p class="note">${p.goal ? 'Nächstes Ziel: ' + esc(p.goal) : 'Kein nächstes Ziel eingetragen'}</p>${pbar(p.prog, `Fortschritt ${p.prog} Prozent`)}<p class="note">${p.prog} % · diesen Monat ${fmtDur(m.min)} · Gewinn ${fmtMoney(m.profit)}</p>
    ${p.upd ? srcLine(p.src, p.upd, ctx, { label: 'aktualisiert' }) : '<span class="src">noch nicht bearbeitet</span>'}</a>`;
  }).join('')}</div><div class="tools">${newBtn('project', 'Projekt')}</div></section>`;
}

function project(ctx, t, id) {
  const p = db.find(ctx, 'project', id);
  if (!p) return `${hero('Projekte', 'Projekt nicht gefunden')}<p><a class="back" href="#projekte">‹ Zu den Projekten</a></p>`;
  const r = periodRange(per, t), log = db.list(ctx, 'log').filter(e => e.proj === id), inR = log.filter(e => e.d >= r.from && e.d <= r.to).sort((a, b) => (a.d < b.d ? 1 : -1));
  const tasks = db.list(ctx, 'ptask').filter(x => x.proj === id).sort((a, b) => a.done - b.done || ((a.due || '9') < (b.due || '9') ? -1 : 1));
  const notes = db.list(ctx, 'note').filter(n => n.projects.includes(id)), ps = db.list(ctx, 'project');
  return `${hero('Projekt', esc(p.name), `${esc(label(PROJ_STATUS, p.status))}${p.goal ? ' · Ziel: ' + esc(p.goal) : ''}`)}<a class="back" href="#projekte">‹ Projekte</a>
  <section class="blk">${formIf(ctx, 'project')}<div class="ex">${pbar(p.prog, `Fortschritt ${p.prog} Prozent`)}<p class="note">${p.prog} % geschafft · ${p.upd ? srcLine(p.src, p.upd, ctx, { label: 'aktualisiert' }) : 'noch nicht bearbeitet'}</p><div class="tools">${editBtn('project', p.id, 'Status, Ziel, Notizen bearbeiten')}</div></div></section>
  <section class="blk"><div class="bh"><h2>Zahlen</h2><p>${esc(r.label)} · aus dem Business Log</p></div>${seg('lper', PERIODS, per)}${stats(logStats(log, { range: r }))}</section>
  <section class="blk"><div class="bh"><h2>Aufgaben</h2><p>${tasks.filter(x => !x.done).length} offen</p></div>${formIf(ctx, 'ptask', { hide: ['proj'] })}
  ${tasks.length ? `<ul class="list">${tasks.map(x => `<li class="li"><input type="checkbox" data-a="tick" data-s="ptask" data-id="${esc(x.id)}"${x.done ? ' checked' : ''} aria-label="${esc(x.text)} erledigt"><span class="t${x.done ? ' done' : ''}">${esc(x.text)}${x.due ? `<small>fällig ${dfmt(x.due)}${!x.done && x.due < t ? ' · überfällig' : ''}</small>` : ''}</span>${editBtn('ptask', x.id)}</li>`).join('')}</ul>` : ''}
  <div class="tools">${newBtn('ptask', 'Aufgabe', { proj: id })}</div></section>
  <section class="blk"><div class="bh"><h2>Aktivitäten</h2><p>${esc(r.label)}</p></div>${formIf(ctx, 'log', { hide: ['proj'] })}
  ${inR.length ? `<ul class="crows card-l">${inR.map(e => logRow(e, ps)).join('')}</ul>` : '<p class="note">Keine Einträge in diesem Zeitraum.</p>'}<div class="tools">${newBtn('log', 'Log-Eintrag', { proj: id })}</div></section>
  <section class="blk prose"><div class="bh"><h2>Notizen & Links</h2></div><div class="ex">${p.notes ? `<p class="pre">${esc(p.notes)}</p>` : '<p class="note">Keine Notizen.</p>'}
  ${p.links.length ? `<ul class="links">${p.links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`).join('')}</ul>` : ''}</div>
  ${notes.length ? `<p class="fl note">Verknüpfte Notizen</p><ul class="crows card-l">${notes.map(n => `<li><a class="nm" href="#wissen/n-${esc(n.id)}"><b>${esc(n.title)}</b><small>${esc(n.tags.map(g => '#' + g).join(' '))}</small></a></li>`).join('')}</ul>` : ''}</section>`;
}

function logView(ctx, t) {
  const r = periodRange(per, t), ps = db.list(ctx, 'project'), all = db.list(ctx, 'log');
  const inR = all.filter(e => e.d >= r.from && e.d <= r.to && (!lproj || e.proj === lproj)).sort((a, b) => (a.d < b.d ? 1 : -1));
  const ids = [...new Set([...ps.map(p => p.id), ...all.map(e => e.proj)])], rows = ids.map(id => ({ id, s: logStats(all, { proj: id, range: r }) })).filter(x => x.s.n || ps.some(p => p.id === x.id && p.status === 'aktiv'));
  const tot = logStats(all, { range: r }), td = s => `<td>${fmtMoney(s.inc)}</td><td>${fmtMoney(s.exp)}</td><td class="${s.profit < 0 ? 'neg' : ''}">${fmtMoney(s.profit)}</td><td>${fmtDur(s.min)}</td>`;
  return `${hero('Projekte', 'Business Log')}${tabs('log')}
  <section class="blk"><div class="bh"><h2>Auswertung</h2><p>${esc(r.label)}</p></div>${seg('lper', PERIODS, per)}
  <div class="tblw"><table class="tbl"><thead><tr><th>Projekt</th><th>Umsatz</th><th>Kosten</th><th>Gewinn</th><th>Stunden</th></tr></thead><tbody>${rows.map(x => `<tr><td>${esc(pname(ps, x.id))}</td>${td(x.s)}</tr>`).join('')}</tbody><tfoot><tr><th>Summe</th>${td(tot)}</tr></tfoot></table></div></section>
  <section class="blk"><div class="bh"><h2>Einträge</h2><p>${inR.length}</p></div>
  <div class="cflt"><label class="dsel">Projekt<select data-a="lproj"><option value="">Alle</option>${ps.map(p => `<option value="${esc(p.id)}"${p.id === lproj ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
  ${formIf(ctx, 'log')}<div class="tools">${newBtn('log', 'Log-Eintrag', lproj ? { proj: lproj } : null)}</div>
  ${inR.length ? `<ul class="crows card-l">${inR.map(e => logRow(e, ps)).join('')}</ul>` : empty(all.length ? 'Keine Einträge für diese Auswahl.' : 'Noch keine Einträge. Halte fest, was du für deine Projekte tust: Datum, Dauer, Einnahmen und Ausgaben.')}</section>`;
}

export function render(route, ctx) {
  const t = today(ctx);
  return banner(ctx) + (route.view === 'project' ? project(ctx, t, route.id) : route.view === 'log' ? logView(ctx, t) : list(ctx, t));
}
export function onClick(e, route, ctx) {
  const t = target(e);
  if (!t || common(t, ctx)) return;
  if (t.dataset.a === 'lper') { per = t.dataset.v; ctx.rerender(); }
}
export function onInput(e) { edInput(e.target); }
export function onChange(e, route, ctx) {
  const t = e.target;
  if (edInput(t) || tick(t, ctx)) return;
  if (t.dataset && t.dataset.a === 'lproj') { lproj = t.value; ctx.rerender(); }
}
export function onNavigate(next) { onNavigateCommon(); if (!next || next.area !== 'projects') { per = 'monat'; lproj = ''; } }
export function mount() { mountCommon(); }
