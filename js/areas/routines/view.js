// Routine views as HTML strings. Pure: everything comes in through `v`.
import { esc } from '../../core/html.js';
import { dfmt, DN, DAYS, dayIdx } from '../../core/dates.js';
import { PHONE_NOTE, LABELS } from './data.js';

const hero = (v, title) => `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">${dfmt(v.day)}</p><h1>${title}</h1></div></div>`;

function packList(v) {
  const P = v.packList, n = P.reduce((a, c) => a + c.items.filter(i => v.pack[i.id]).length, 0), all = P.reduce((a, c) => a + c.items.length, 0);
  return `<details class="ses pk2"${v.open.pack ? ' open' : ''}><summary data-a="open" data-k="pack"><b>Packliste ${n}/${all}</b><span>${P.map(c => esc(c.cat)).join(' & ')}</span></summary>${P.map(c => `<p class="note fl">${esc(c.cat)}</p>
  <ul class="list">${c.items.map(i => `<li><label><input type="checkbox" data-a="pack" data-id="${esc(i.id)}" ${v.pack[i.id] ? 'checked' : ''}>${esc(i.name)}</label></li>`).join('')}</ul>`).join('')}</details>`;
}

// Extra line under a linked step: where it lives or what it counts for.
function extra(s, v) {
  if (s.link === 'grandpa') return '<a class="sublink" href="#routinen/grandpa">Timer · 4 min ›</a>';
  if (s.link === 'water') return '<small class="note">zählt 0,5 L beim Wasser</small>';
  if (s.link === 'mobility') return `<small class="note">Routine ${v.mob.routine} · ${v.mob.name} · ${v.mob.minutes} min · gleiches Häkchen wie in Recovery</small><a class="sublink" href="#recovery/mobility">Starten ›</a>`;
  if (s.link === 'supps') return `<small class="note">${v.supps.length ? `${v.supps.map(esc).join(' · ')} · gleiches Häkchen wie in Ernährung` : 'keine Abend-Supplements eingetragen'}</small>`;
  if (s.link === 'breath') return '<a class="sublink" href="#recovery/atmung?2">Box-Breathing ›</a>';
  if (s.link === 'pack') return packList(v);
  return '';
}

// One routine's checkboxes; each carries its day, so a tick lands on the day
// it was drawn for (yesterday's evening sits on the same page as today's).
function rows(kind, r, v, extras) {
  return r.steps.map(s => {
    const on = s.link === 'mobility' || s.link === 'supps' ? r.linked[s.link] === true : r.ticks[s.id] === true, x = extras ? extra(s, v) : '';
    return `<li><label><input type="checkbox" data-a="step" data-k="${kind}" data-d="${r.day}" data-id="${esc(s.id)}" ${on ? 'checked' : ''}><span class="t"><small class="tt">${s.from}</small> ${esc(s.title)}</span></label>${x ? `<div class="sub">${x}</div>` : ''}</li>`;
  }).join('');
}

// Edit mode: the base times (before the weekend shift), the title, and ×
// unless it is the last step; the morning also edits the pack list.
const HINT = { morgen: 'Zeiten für Mo–Fr · Sa/So automatisch +1 h', abend: 'Zeiten für So–Do · Fr/Sa automatisch +1 h' };
const LINK_NOTE = {
  water: 'zählt 0,5 L beim Wasser', grandpa: 'mit dem Grandpa-Timer', pack: 'mit der Packliste',
  mobility: 'Häkchen geteilt mit Recovery', supps: 'Häkchen geteilt mit den Abend-Supplements', breath: 'mit dem Box-Breathing-Timer',
};
function editRows(kind, v) {
  const list = v.base[kind];
  return list.map(s => {
    const at = `data-k="${kind}" data-id="${esc(s.id)}"`;
    return `<li class="ed"><div class="li"><input type="time" class="rtime" data-a="rfrom" ${at} value="${esc(s.from)}" aria-label="von"><span class="dash">–</span><input type="time" class="rtime" data-a="rto" ${at} value="${esc(s.to || '')}" aria-label="bis">${list.length > 1 ? `<button class="btn" type="button" data-a="rdel" ${at} aria-label="${esc(s.title || 'Schritt')} entfernen">×</button>` : ''}</div>
    <div class="li"><input class="tx" data-a="rt" ${at} value="${esc(s.title)}" aria-label="Titel" autocomplete="off"></div>${s.link ? `<p class="note lk">${LINK_NOTE[s.link]}</p>` : ''}</li>`;
  }).join('');
}
function packEdit(v) {
  return `<p class="note fl"><b>Packliste</b></p>${v.packList.map(c => {
    const cat = esc(c.cat);
    return `<p class="note fl">${cat}</p>${c.items.length ? `<ul class="list">${c.items.map(i => `<li><div class="li"><input class="tx" data-a="pn" data-cat="${cat}" data-id="${esc(i.id)}" value="${esc(i.name)}" aria-label="Name" autocomplete="off"><button class="btn" type="button" data-a="pdel" data-cat="${cat}" data-id="${esc(i.id)}" aria-label="${esc(i.name)} entfernen">×</button></div></li>`).join('')}</ul>` : ''}
    <button class="add" type="button" data-a="padd" data-cat="${cat}">+ Gegenstand</button>`;
  }).join('')}`;
}

function routine(kind, v) {
  const r = v.routines[kind], complete = r.prog.done === r.prog.total;
  const head = `<section class="blk"><div class="bh"><h2>${LABELS[kind]}</h2><p>ab ${r.steps[0].from} · ${r.prog.done}/${r.prog.total}</p></div>`;
  if (v.editing === kind) {
    return head + `<p class="note">${HINT[kind]}</p><ul class="list rlist">${editRows(kind, v)}</ul>
  <button class="add" type="button" data-a="radd" data-k="${kind}">+ Schritt</button>${kind === 'morgen' ? packEdit(v) : ''}
  <div class="tools"><button class="btn pri" type="button" data-a="redit" data-k="${kind}">Fertig mit Bearbeiten</button><button class="btn red" type="button" data-a="rreset">${v.confirm ? 'Sicher? Nochmal tippen' : 'Auf Notion-Stand zurücksetzen'}</button></div></section>`;
  }
  return head + `<ul class="list rlist">${rows(kind, r, v, true)}</ul>
  <div class="tools"><button class="btn${complete ? ' pri' : ''}" type="button" data-a="all" data-k="${kind}">${complete ? 'Alles erledigt ✓' : 'Alles erledigt'}</button><button class="btn" type="button" data-a="redit" data-k="${kind}">Bearbeiten</button></div></section>`;
}

export function todayView(v) {
  const order = v.first === 'morgen' ? ['morgen', 'abend'] : ['abend', 'morgen'];
  const y = v.yesterday ? `<div class="card warn yev"><b>Gestern Abend ${v.yesterday.prog.done}/${v.yesterday.prog.total}</b><span>Im Nachhinein abhaken</span>
    <div class="tools" style="margin-top:8px"><button class="btn" type="button" data-a="yall">Alles erledigt</button></div>
    <details class="yd"${v.open.yest ? ' open' : ''}><summary class="sublink" data-a="open" data-k="yest">Einzeln abhaken</summary><ul class="list rlist">${rows('abend', v.yesterday, v, false)}</ul></details></div>` : '';
  return hero(v, 'Routinen') + `<p class="note">${esc(PHONE_NOTE)}</p>${y}${order.map(k => routine(k, v)).join('')}`;
}

// Phone-holder mode: the step that is on now, big enough to read from 1–2 m.
export function holderView(v) {
  const a = v.active;
  if (a.kind) {
    return `<div class="holder"><p class="hk">${LABELS[a.kind]}</p><h1 class="hs">${esc(a.step.title)}</h1>
    <p class="ht">${a.step.from}–${a.step.until}</p>${a.next ? `<p class="hn">Danach: ${esc(a.next.title)}</p>` : ''}
    <p class="note">${esc(PHONE_NOTE)}</p></div>`;
  }
  const u = a.upcoming, when = u.day === v.day ? `um ${u.from}` : `· ${DN[DAYS[dayIdx(new Date(u.day + 'T12:00:00'))]]} ${u.from}`;
  return `<div class="holder"><p class="hk">Gerade keine Routine</p><h1 class="hs hs-s">Nächste Routine: ${LABELS[u.kind]} ${when}</h1>
  <p class="note">Der Bildschirm bleibt an, solange diese Ansicht offen ist.</p></div>`;
}
