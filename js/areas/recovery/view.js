// Recovery views as HTML strings. Pure: everything comes in through `v`.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import { SIGH, MOBILITY } from './data.js';
import { hoursInBed } from './logic.js';

const SCALES = [['schlaf', 'Schlaf'], ['energie', 'Energie'], ['muskeln', 'Muskeln & Gelenke']];
export const dec = n => String(Math.round(n * 100) / 100).replace('.', ',');

export const scale = (a, k, val, label) => `<div class="scale" role="group" aria-label="${esc(label)}">${[1, 2, 3, 4, 5].map(n =>
  `<button type="button" class="${val === n ? 'on' : ''}" data-a="${a}" data-k="${k}" data-n="${n}" aria-pressed="${val === n}">${n}</button>`).join('')}</div>`;

export const ampCard = (amp, sum) => `<div class="amp ${amp.key}" role="status"><p class="k"><i class="dot" aria-hidden="true"></i>${amp.label} · ${sum} von 15</p><b>${esc(amp.advice)}</b></div>`;

function morning(v) {
  const e = v.entry, own = e.bed !== v.planned.bed || e.wake !== v.planned.wake;
  return `<section class="blk"><div class="bh"><h2>Morgen-Check</h2><p>1 = schlecht, 5 = top</p></div>
  ${SCALES.map(([k, l]) => `<div class="ex"><h3 class="sq">${l}</h3>${scale('mc', k, e[k], l)}</div>`).join('')}
  <div class="ex"><div class="tm">
    <label>Ins Bett<input type="time" data-a="bed" value="${esc(e.bed)}"></label>
    <label>Aufstehen<input type="time" data-a="wake" value="${esc(e.wake)}"></label>
    <label>Ruhepuls<input type="number" inputmode="numeric" min="30" max="120" data-a="puls" value="${e.puls == null ? '' : e.puls}" placeholder="optional"></label>
  </div><p class="note">${dec(hoursInBed(e.bed, e.wake))} h im Bett${own ? '' : ' · aus deiner Week Routine'}</p></div>
  ${v.amp ? ampCard(v.amp, v.sum) : ''}</section>`;
}

function mobility(m) {
  const steps = MOBILITY[m.routine].steps;
  return `<section class="blk"><div class="bh"><h2>Mobility</h2><p>${m.done ? 'Erledigt ✓' : 'Heute dran'}</p></div>
  <div class="ex"><h3 class="sq">Routine ${m.routine} · ${m.name} · ${m.minutes} min</h3>
  <p class="note">${steps.slice(0, 3).map(s => esc(s.title)).join(', ')} und ${steps.length - 3} weitere</p>
  <div class="tools"><a class="btn pri" href="#recovery/mobility">Starten</a></div></div>
  <ul class="list"><li><label><input type="checkbox" data-a="mobdone" ${m.done ? 'checked' : ''}>Mobility erledigt</label></li></ul></section>`;
}

const breath = sat => `<section class="blk"><div class="bh"><h2>Atmung</h2><p>4 ein · 4 halten · 4 aus · 4 halten</p></div>
  <div class="tools" style="margin:0"><a class="btn${sat ? '' : ' pri'}" href="#recovery/atmung?2">Box-Breathing 2 min</a><a class="btn${sat ? ' pri' : ''}" href="#recovery/atmung?5">5 min</a></div>
  <details class="ses"><summary><b>Physiological Sigh</b><span>Kurzanleitung</span></summary><p class="sigh">${esc(SIGH)}</p></details></section>`;

const LINKS = { mobility: '#recovery/mobility', weekly: '#recovery/woche' };
function blocks(v) {
  let n = 0;
  const items = v.blocks.map((b, i) => {
    if (b.link) {
      const ok = b.link === 'mobility' ? v.mob.done : v.weeklyDone;
      if (ok) n++;
      return `<li><a class="go" href="${LINKS[b.link]}"><span class="ck${ok ? ' on' : ''}" aria-hidden="true">${ok ? '✓' : ''}</span><span class="t">${esc(b.t)}</span><span class="s">${ok ? 'erledigt' : 'öffnen ›'}</span></a></li>`;
    }
    const ok = !!v.blockDone[i];
    if (ok) n++;
    return `<li><label><input type="checkbox" data-a="blk" data-i="${i}" ${ok ? 'checked' : ''}>${esc(b.t)}</label></li>`;
  });
  return `<section class="blk"><div class="bh"><h2>Recovery-Block</h2><p>${n} von ${v.blocks.length} erledigt</p></div><ul class="list">${items.join('')}</ul></section>`;
}

export const cycleCard = c => `<a class="card" href="#recovery/zyklus"><p class="k">Deload-Zyklus · Woche ${c.week} von 7</p><b>Woche ${c.week} · ${esc(c.goal)}</b><span>RIR ${c.main} Haupt / ${c.iso} Iso${c.deload ? ' · Deload-Regeln ansehen' : ' · Deload ab ' + dfmt(c.nextDeload)} ›</span></a>`;
export const suggestCard = t => `<a class="card warn" href="#recovery/zyklus"><b>Deload vorziehen?</b><span>${t.count} von 6 Anzeichen treffen zu · ansehen ›</span></a>`;

export function todayView(v) {
  return `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">${dfmt(v.day)}</p><h1>Recovery</h1></div></div>
  ${morning(v)}${mobility(v.mob)}${breath(v.sat)}${v.blocks ? blocks(v) : ''}
  <section class="blk"><div class="bh"><h2>Zyklus</h2></div><div class="cards">${v.trig.suggest ? suggestCard(v.trig) : ''}${cycleCard(v.cycle)}</div></section>`;
}
