// Arena views as HTML strings. Pure: everything comes in through `v`.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import { fmt1 } from './logic.js';

const hero = (k, title) => `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">${k}</p><h1>${title}</h1></div></div>`;
const score = s => `<h2 class="ascore">Julian ${fmt1(s.julian)} : ${fmt1(s.uygar)} Uygar</h2>`;

export function inviteView(v) {
  if (!v.ok) return hero('Einladung', 'Arena') + '<section class="blk"><p class="note">Diese Einladung ist ungültig oder unvollständig.</p></section>';
  const hint = v.standalone ? '' : `<div class="card warn"><b>Läuft KI-Apps bei dir als App auf dem Home-Bildschirm?</b>
    <span>Dann öffne sie und füge diesen Link dort unter Einstellungen → Einladung einfügen ein. Safari und die App haben getrennten Speicher.</span>
    <div class="tools" style="margin-top:8px"><button class="btn" type="button" data-a="acopy">Link kopieren</button></div></div>`;
  return hero('Einladung', `Du bist ${esc(v.name)}`) + `<section class="blk"><p class="note">Die Arena ist auf diesem Gerät eingerichtet.</p>
  <div class="tools"><button class="btn pri" type="button" data-a="agoto">Zur Arena</button></div>${hint}</section>`;
}

export const emptyView = () => hero('Julian · Uygar', 'Arena')
  + '<section class="blk"><p class="note">Noch keine Arena auf diesem Gerät.</p><div class="tools"><a class="btn pri" href="#einstellungen">Zu den Einstellungen</a></div></section>';
export const loadingView = () => hero('Julian · Uygar', 'Arena') + '<p class="note">Arena wird geladen …</p>';
export const offlineView = () => hero('Julian · Uygar', 'Arena') + '<section class="blk"><p class="note">Arena braucht beim ersten Mal Netz. Sobald du online bist, geht es weiter.</p></section>';
export const deniedView = () => hero('Julian · Uygar', 'Arena') + '<section class="blk"><p class="note">Kein Zugriff auf diese Arena – Einladung prüfen.</p><div class="tools"><a class="btn" href="#einstellungen">Einstellungen</a></div></section>';
export const configView = () => hero('Julian · Uygar', 'Arena') + '<section class="blk"><p class="note">Die Firebase-Konfiguration passt nicht – in den Einstellungen prüfen.</p><div class="tools"><a class="btn" href="#einstellungen">Einstellungen</a></div></section>';

function taskRow(t, v) {
  const lock = v.locked ? ' disabled' : '';
  const input = t.kind === 'yes'
    ? `<div class="ayn"><button class="btn${t.value === true ? ' pri' : ''}" type="button" data-a="yes" data-t="${esc(t.id)}"${lock}>Ja</button><button class="btn${t.value === false ? ' pri' : ''}" type="button" data-a="no" data-t="${esc(t.id)}"${lock}>Nein</button></div>`
    : `<label class="aval"><input class="tx" data-a="val" data-t="${esc(t.id)}" inputmode="decimal" value="${t.value == null ? '' : String(t.value).replace('.', ',')}" aria-label="${esc(t.name)}" autocomplete="off"${lock}><span>${esc(t.unit)}</span></label>`;
  const pts = t.value == null ? '' : `<small class="note">${fmt1(t.points)} P</small>`;
  const sug = t.suggest ? `<div class="sub"><small class="note">Vorschlag: Ja · ${esc(t.suggest)}</small><button class="btn" type="button" data-a="take" data-t="${esc(t.id)}">Übernehmen</button></div>` : '';
  return `<li class="atask"><div class="at"><b>${esc(t.name)}</b>${t.hint ? `<small class="note">${esc(t.hint)}</small>` : ''}</div>${input}${pts}${sug}</li>`;
}

function editRows(v) {
  return v.tasks.map(t => `<li class="atask"><div class="li"><input class="tx" data-a="tn" data-t="${esc(t.id)}" value="${esc(t.name)}" aria-label="Name" autocomplete="off">
    <button class="btn" type="button" data-a="tarch" data-t="${esc(t.id)}" aria-label="${esc(t.name)} archivieren">Archivieren</button></div>
    ${t.kind === 'value' ? `<label class="aval">Ziel <input class="tx" data-a="tg" data-t="${esc(t.id)}" inputmode="decimal" value="${String(t.goal).replace('.', ',')}" autocomplete="off"><span>${esc(t.unit)}</span></label>` : ''}</li>`).join('');
}

export function todayView(v) {
  const head = hero(v.isToday ? `Heute · ${dfmt(v.day)}` : `Gestern · ${dfmt(v.day)}`, 'Arena') + score(v.scores);
  const notes = (v.pending ? '<p class="note">wird gesendet</p>' : '') + (v.error ? `<p class="err" role="alert">${esc(v.error)}</p>` : '')
    + (v.locked ? '<p class="note">Dieser Tag ist abgeschlossen und nur lesbar.</p>' : '');
  if (v.edit) {
    return head + `<section class="blk"><div class="bh"><h2>Aufgaben bearbeiten</h2><p>gemeinsam mit ${v.other}</p></div>
    <ul class="list">${editRows(v)}</ul><button class="add" type="button" data-a="tadd">+ Aufgabe</button>
    <div class="tools"><button class="btn pri" type="button" data-a="tedit">Fertig mit Bearbeiten</button><button class="btn red" type="button" data-a="treset">${v.confirm ? 'Sicher? Nochmal tippen' : 'Auf Notion-Stand zurücksetzen'}</button></div></section>`;
  }
  return head + notes + `<section class="blk"><ul class="list">${v.tasks.map(t => taskRow(t, v)).join('')}</ul>
  <div class="tools"><button class="btn" type="button" data-a="day" data-d="${v.switchTo}">${v.isToday ? 'Gestern ändern ›' : 'Zurück zu heute ›'}</button><button class="btn" type="button" data-a="tedit">Bearbeiten</button></div></section>`;
}

export function weekView(v) {
  const rows = v.days.map(d => `<tr><th>${dfmt(d.date)}</th><td>${d.julian == null ? '–' : fmt1(d.julian)}</td><td>${d.uygar == null ? '–' : fmt1(d.uygar)}</td></tr>`).join('');
  const lead = v.sums.leader ? `${v.sums.leader === 'julian' ? 'Julian' : 'Uygar'} führt mit ${fmt1(v.sums.diff)}` : 'Gleichstand';
  return hero(`KW ${v.kw}`, 'Woche') + `<section class="blk"><table class="awk"><thead><tr><th></th><th>Julian</th><th>Uygar</th></tr></thead><tbody>${rows}</tbody>
  <tfoot><tr><th>Summe</th><td>${fmt1(v.sums.julian)}</td><td>${fmt1(v.sums.uygar)}</td></tr></tfoot></table>
  <p class="alead">${lead}</p>
  <div class="tools"><button class="btn" type="button" data-a="wk" data-d="${v.prev}">‹ Vorwoche</button>${v.next ? `<button class="btn" type="button" data-a="wk" data-d="${v.next}">Nächste Woche ›</button>` : ''}</div></section>`;
}

export function historyView(v) {
  const name = p => (p === 'julian' ? 'Julian' : 'Uygar');
  // The running week has a leader, not yet a winner.
  const result = w => (w.monday === v.current ? (w.winner ? `${name(w.winner)} führt` : 'läuft') : w.winner ? `Sieger ${name(w.winner)}` : 'Unentschieden');
  const rows = v.weeks.map(w => `<li><span class="t">KW ${w.week} · Julian ${fmt1(w.julian)} : ${fmt1(w.uygar)} Uygar · ${result(w)}</span></li>`).join('');
  return hero('Seit dem Start', 'Verlauf') + `<section class="blk"><h2 class="ascore">Julian ${fmt1(v.totals.julian)} : ${fmt1(v.totals.uygar)} Uygar</h2>
  <p class="note">Gewonnene Wochen: Julian ${v.totals.wins.julian} · Uygar ${v.totals.wins.uygar}</p>
  <ul class="list ahist">${rows}</ul></section>`;
}
