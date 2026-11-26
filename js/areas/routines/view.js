// Routine views as HTML strings. Pure: everything comes in through `v`.
import { esc } from '../../core/html.js';
import { dfmt, DN, DAYS, dayIdx } from '../../core/dates.js';
import { PACK, PHONE_NOTE, LABELS } from './data.js';

const hero = (v, title) => `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">${dfmt(v.day)}</p><h1>${title}</h1></div></div>`;

function packList(v) {
  const n = PACK.reduce((a, c) => a + c.items.filter(i => v.pack[i.id]).length, 0), all = PACK.reduce((a, c) => a + c.items.length, 0);
  return `<details class="ses pk2"${v.open.pack ? ' open' : ''}><summary data-a="open" data-k="pack"><b>Packliste ${n}/${all}</b><span>Tasche & Essentials</span></summary>${PACK.map(c => `<p class="note fl">${esc(c.cat)}</p>
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

function routine(kind, v) {
  const r = v.routines[kind], complete = r.prog.done === r.prog.total;
  return `<section class="blk"><div class="bh"><h2>${LABELS[kind]}</h2><p>ab ${r.steps[0].from} · ${r.prog.done}/${r.prog.total}</p></div>
  <ul class="list rlist">${rows(kind, r, v, true)}</ul>
  <div class="tools"><button class="btn${complete ? ' pri' : ''}" type="button" data-a="all" data-k="${kind}">${complete ? 'Alles erledigt ✓' : 'Alles erledigt'}</button></div></section>`;
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
