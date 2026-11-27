// Körper views as HTML strings. Pure: everything comes in through `v`.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import { FIELDS, MEASURES, GOALS, POSES } from './data.js';
import { fmtNum, fmtTime } from './logic.js';

const hero = (k, title) => `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">${k}</p><h1>${title}</h1></div></div>`;
const F = Object.fromEntries(FIELDS.map(f => [f.id, f]));

// A value as it is shown: times as m:ss, a short dead hang in seconds.
export function fmtValue(id, y) {
  if (id === 'run5k') return fmtTime(y) + ' min';
  if (id === 'hang') return y < 60 ? `${y} s` : fmtTime(y) + ' min';
  return fmtNum(y) + ' ' + F[id].unit;
}
export function toGoal(kg) {
  const d = Math.abs(kg - GOALS.kg);
  return d < 0.05 ? 'Ziel erreicht ✓' : `noch ${fmtNum(d)} kg bis ${GOALS.kg}`;
}

function quarterBlock(s) {
  const label = `${s.q.slice(5)} ${s.q.slice(0, 4)}`;
  const items = `<ul class="list rlist">${s.items.map(i => `<li><label><input type="checkbox" data-a="qtick" data-id="${i.id}" ${i.done ? 'checked' : ''}><span class="t">${esc(i.label)}${i.auto ? ' <small class="note">(automatisch)</small>' : ''}</span></label>${i.link ? `<div class="sub"><a class="sublink" href="${i.link}">Beschwerden-Log ›</a></div>` : ''}</li>`).join('')}</ul>`;
  if (s.done >= s.total) return `<section class="blk"><details class="ses"><summary><b>Quartals-Check ${s.q.slice(5)} erledigt ✓</b><span>${label}</span></summary>${items}</details></section>`;
  return `<section class="blk"><div class="bh"><h2>Quartals-Check ${label}</h2><p>${s.done}/${s.total}</p></div>${items}</section>`;
}

export function overviewView(v) {
  const card = (k, b, span) => `<div class="card"><p class="k">${k}</p><b>${b}</b><span>${span}</span></div>`;
  const kg = v.latest.kg, cards = [
    kg ? card('Gewicht', fmtValue('kg', kg.y), `${toGoal(kg.y)} · ${dfmt(kg.date)}`) : `<a class="card warn" href="#koerper/messung"><b>Gewicht fehlt</b><span>Messung eintragen ›</span></a>`,
    v.latest.fat ? card('Körperfett', fmtValue('fat', v.latest.fat.y), `Ziel ${GOALS.fat.join('–')} % · ${dfmt(v.latest.fat.date)}`) : '',
    v.latest.run5k ? card('5 km', fmtValue('run5k', v.latest.run5k.y), dfmt(v.latest.run5k.date)) : '',
    v.latest.hang ? card('Dead-Hang', fmtValue('hang', v.latest.hang.y), dfmt(v.latest.hang.date)) : '',
  ].join('');
  return hero(`Ziel ${GOALS.kg} kg · Körperfett ${GOALS.fat.join('–')} %`, 'Gesundheit') + quarterBlock(v.quarter)
    + `<section class="blk"><div class="cards">${cards}</div>
    <div class="tools" style="margin-top:12px"><a class="btn pri" href="#koerper/messung">Messung eintragen</a></div></section>`;
}

function field(f, val) {
  return `<label class="bf" for="bf-${f.id}">${esc(f.label)} <small>${f.time ? (f.id === 'run5k' ? 'mm:ss' : 's oder m:ss') : esc(f.unit)}</small>
    <input id="bf-${f.id}" class="tx" data-a="bf" data-k="${f.id}" inputmode="${f.time ? 'text' : 'decimal'}" value="${esc(val)}" autocomplete="off"${f.time ? ` placeholder="${f.id === 'run5k' ? '25:00' : '60'}"` : ''}></label>`;
}

export function entryView(v) {
  const g = ids => `<div class="bgrid">${ids.map(id => field(F[id], v.values[id])).join('')}</div>`;
  return hero(dfmt(v.date), 'Messung') + `<section class="blk"><div class="ex">
  <label class="bf" for="bDate">Datum<input id="bDate" class="tx" type="date" data-a="bdate" value="${v.date}" max="${v.today}"></label>
  <p class="note fl">Alle Felder sind freiwillig. Ein leeres Feld löscht den Wert dieses Tages.</p>
  ${g(['kg', 'fat'])}<p class="note fl"><b>Maße</b></p>${g(MEASURES)}<p class="note fl"><b>Leistung</b></p>${g(['run5k', 'hang'])}
  <label class="bf" for="bf-mob">Mobility-Check <small>Notiz</small><textarea id="bf-mob" class="tx" data-a="bf" data-k="mob" rows="3">${esc(v.values.mob)}</textarea></label>
  ${v.err ? `<p class="err" role="alert">${esc(v.err)}</p>` : ''}
  <div class="tools"><button class="btn pri" type="button" data-a="bsave">Speichern</button><a class="btn" href="#koerper">Abbrechen</a></div></div></section>`;
}

export function dayLine(kg, x) {
  const parts = [];
  if (kg != null) parts.push(fmtValue('kg', kg));
  if (x.fat != null) parts.push('KF ' + fmtValue('fat', x.fat));
  const n = MEASURES.filter(m => x[m] != null).length;
  if (n) parts.push(n === 1 ? '1 Maß' : `${n} Maße`);
  if (x.run5k != null) parts.push('5 km ' + fmtValue('run5k', x.run5k));
  if (x.hang != null) parts.push('Hang ' + fmtValue('hang', x.hang));
  if (x.mob) parts.push('Mobility-Notiz');
  return parts.join(' · ');
}

export function historyView(v) {
  const rows = v.days.map(d => {
    const sure = v.confirm === d.date;
    return `<li><div class="li"><a class="t bday" href="#koerper/messung?${d.date}"><b>${dfmt(d.date)}</b><small class="note">${esc(d.line)}</small></a>
    <button class="btn${sure ? ' red' : ''}" type="button" data-a="bdel" data-d="${d.date}" aria-label="Messung vom ${dfmt(d.date)} löschen">${sure ? 'Sicher? Nochmal tippen' : '×'}</button></div></li>`;
  }).join('');
  return hero('Gesundheit', 'Verlauf') + (v.charts || '')
    + `<section class="blk"><div class="bh"><h2>Messtage</h2><p>${v.days.length}</p></div>
    ${rows ? `<ul class="list">${rows}</ul>` : '<p class="note">Noch keine Messung. <a href="#koerper/messung">Messung eintragen ›</a></p>'}</section>`;
}

// Photos: new ones per pose, the before/after view, and the list of days.
export function photosView(v) {
  if (!v.available) return hero('Gesundheit', 'Fotos') + '<p class="note">Fotos sind auf diesem Gerät nicht verfügbar. Werte, Verlauf und Quartals-Check funktionieren weiter.</p>';
  const year = d => `${dfmt(d)} ${d.slice(0, 4)}`;
  const img = (d, p) => (v.idx[d] && v.idx[d][p] ? `<img data-photo="${d}:${p}" alt="${p} ${dfmt(d)}">` : '<div class="pmiss">kein Foto</div>');
  const slots = POSES.map(p => `<div class="pslot">${v.idx[v.day] && v.idx[v.day][p.id] ? img(v.day, p.id) : '<div class="pmiss">+ Foto</div>'}<span>${p.label}</span>
    <input type="file" accept="image/*" data-a="pfile" data-pose="${p.id}" aria-label="Foto ${p.label}"></div>`).join('');
  const opts = sel => v.days.map(d => `<option value="${d}"${d === sel ? ' selected' : ''}>${year(d)}</option>`).join('');
  const poses = `<div class="tools">${POSES.map(p => `<button class="btn${p.id === v.pose ? ' pri' : ''}" type="button" data-a="ppose" data-pose="${p.id}">${p.label}</button>`).join('')}</div>`;
  const fig = d => `<figure>${img(d, v.pose)}<figcaption>${year(d)}</figcaption></figure>`;
  let cmp = '<p class="note">Noch keine Fotos.</p>';
  if (v.days.length === 1) cmp = `${poses}<div class="pcmp one">${fig(v.days[0])}</div><p class="note">Vergleich ab zwei Terminen.</p>`;
  if (v.days.length > 1) {
    cmp = `<div class="psel"><select class="tx" data-a="pa" aria-label="Vorher">${opts(v.a)}</select><span>↔</span><select class="tx" data-a="pb" aria-label="Nachher">${opts(v.b)}</select></div>
    ${poses}<div class="pcmp">${fig(v.a)}${fig(v.b)}</div>`;
  }
  const list = v.days.slice().reverse().map(d => {
    const sure = v.confirm === d;
    return `<li><div class="li"><span class="t"><b>${year(d)}</b> <small class="note">${POSES.filter(p => v.idx[d][p.id]).map(p => p.label).join(' · ')}</small></span>
    <button class="btn${sure ? ' red' : ''}" type="button" data-a="pdel" data-d="${d}" aria-label="Fotos vom ${dfmt(d)} löschen">${sure ? 'Sicher? Nochmal tippen' : '×'}</button></div></li>`;
  }).join('');
  return hero('Gesundheit', 'Fotos') + `<section class="blk"><div class="bh"><h2>Neue Fotos</h2></div><div class="ex">
  <label class="bf" for="pDay">Datum<input id="pDay" class="tx" type="date" data-a="pdate" value="${v.day}" max="${v.today}"></label>
  <div class="pslots">${slots}</div><p class="note">Tippen öffnet Kamera oder Mediathek. Die Fotos bleiben auf diesem Gerät.</p></div></section>
  <section class="blk"><div class="bh"><h2>Vergleich</h2></div>${cmp}</section>
  ${list ? `<section class="blk"><div class="bh"><h2>Foto-Termine</h2><p>${v.days.length}</p></div><ul class="list">${list}</ul></section>` : ''}`;
}
