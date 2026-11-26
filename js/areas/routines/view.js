// Routine views as HTML strings. Pure: everything comes in through `v`.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import { PACK, PHONE_NOTE, LABELS } from './data.js';

const hero = (v, title) => `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">${dfmt(v.day)}</p><h1>${title}</h1></div></div>`;

function packList(v) {
  const n = PACK.reduce((a, c) => a + c.items.filter(i => v.pack[i.id]).length, 0), all = PACK.reduce((a, c) => a + c.items.length, 0);
  return `<details class="ses pk2"><summary><b>Packliste ${n}/${all}</b><span>Tasche & Essentials</span></summary>${PACK.map(c => `<p class="note fl">${esc(c.cat)}</p>
  <ul class="list">${c.items.map(i => `<li><label><input type="checkbox" data-a="pack" data-id="${esc(i.id)}" ${v.pack[i.id] ? 'checked' : ''}>${esc(i.name)}</label></li>`).join('')}</ul>`).join('')}</details>`;
}

// Extra line under a linked step: where it lives or what it counts for.
function extra(s, v) {
  if (s.link === 'grandpa') return '<a class="sublink" href="#routinen/grandpa">Timer · 4 min ›</a>';
  if (s.link === 'water') return '<small class="note">zählt 0,5 L beim Wasser</small>';
  if (s.link === 'mobility') return `<small class="note">Routine ${v.mob.routine} · ${v.mob.name} · ${v.mob.minutes} min · gleiches Häkchen wie in Recovery</small><a class="sublink" href="#recovery/mobility">Starten ›</a>`;
  if (s.link === 'supps') return `<small class="note">${v.supps.map(esc).join(' · ') || 'keine Abend-Supplements'} · gleiches Häkchen wie in Ernährung</small>`;
  if (s.link === 'breath') return '<a class="sublink" href="#recovery/atmung?2">Box-Breathing ›</a>';
  if (s.link === 'pack') return packList(v);
  return '';
}

function routine(kind, v) {
  const r = v.routines[kind], complete = r.prog.done === r.prog.total;
  const rows = r.steps.map(s => {
    const on = s.link === 'mobility' || s.link === 'supps' ? v.linked[s.link] === true : r.ticks[s.id] === true, x = extra(s, v);
    return `<li><label><input type="checkbox" data-a="step" data-k="${kind}" data-id="${esc(s.id)}" ${on ? 'checked' : ''}><span class="t"><small class="tt">${s.from}</small> ${esc(s.title)}</span></label>${x ? `<div class="sub">${x}</div>` : ''}</li>`;
  }).join('');
  return `<section class="blk"><div class="bh"><h2>${LABELS[kind]}</h2><p>ab ${r.steps[0].from} · ${r.prog.done}/${r.prog.total}</p></div>
  <ul class="list rlist">${rows}</ul>
  <div class="tools"><button class="btn${complete ? ' pri' : ''}" type="button" data-a="all" data-k="${kind}">${complete ? 'Alles erledigt ✓' : 'Alles erledigt'}</button></div></section>`;
}

export function todayView(v) {
  const order = v.first === 'morgen' ? ['morgen', 'abend'] : ['abend', 'morgen'];
  const y = v.yesterday ? `<div class="card warn yev"><b>Gestern Abend ${v.yesterday.done}/${v.yesterday.total}</b><span>Im Nachhinein abhaken</span>
    <div class="tools" style="margin-top:8px"><button class="btn" type="button" data-a="yall">Alles erledigt</button></div></div>` : '';
  return hero(v, 'Routinen') + `<p class="note">${esc(PHONE_NOTE)}</p>${y}${order.map(k => routine(k, v)).join('')}`;
}

export const placeholderView = (v, title) => hero(v, title);
