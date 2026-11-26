// Nutrition views as HTML strings. Pure: everything comes in through `v`.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import { SLOTS, SLOT_ORDER, FOOD_NOTE, LAST_MEAL, WATER, RULES, SUPP_GROUPS, SUPP_LABELS } from './data.js';
import { isLate } from './logic.js';

export const dec = n => String(Math.round(n * 10) / 10).replace('.', ',');
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const hero = (v, title) => `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">${dfmt(v.day)}</p><h1>${title}</h1></div></div>`;

function protein(v) {
  const w = v.weight, ask = !w || v.weightEdit;
  const form = ask ? `<div class="ex"><h3 class="sq">${w ? 'Gewicht ändern' : 'Wie viel wiegst du?'}</h3><p class="note">Dein Proteinziel ist 2 g pro kg Körpergewicht.</p>
    <label class="note fl" for="fWeight">Gewicht in kg</label><input id="fWeight" class="tx" type="number" inputmode="decimal" step="0.1" data-a="weight" value="${w ? w.kg : ''}" placeholder="z. B. 85"></div>` : '';
  if (!w) return `<section class="blk"><div class="bh"><h2>Protein</h2><p>${num(v.protein)} g heute</p></div>${form}</section>`;
  const pct = Math.min(100, Math.round(num(v.protein) / v.target * 100));
  return `<section class="blk"><div class="bh"><h2>Protein</h2><p>${pct} %</p></div>
  <div class="ex"><p class="pnum"><b>${num(v.protein)} / ${v.target} g</b></p><div class="pbar" aria-hidden="true"><i style="width:${pct}%"></i></div>
  <p class="note">Ziel 2 g × ${dec(w.kg)} kg · <button class="lk" type="button" data-a="wedit">Gewicht ändern</button></p></div>${form}</section>`;
}

const dishBtn = d => `<button class="dish" type="button" data-a="dish" data-id="${esc(d.id)}"><b>${esc(d.name)}</b><span>~${num(d.g)} g</span></button>`;

function peekCard(d) {
  return `<div class="ex peek" role="dialog" aria-label="Zutaten ${esc(d.name)}"><h3 class="sq">${esc(d.name)}</h3><p class="note">~${num(d.g)} g Protein</p><p class="ing">${esc(d.ing)}</p>
  <div class="tools"><button class="btn pri" type="button" data-a="dish" data-id="${esc(d.id)}" data-nohold="1">Hinzufügen</button><button class="btn" type="button" data-a="peekx">Schließen</button></div></div>`;
}

function grid(v) {
  const groups = SLOT_ORDER.map(s => [s, v.rest.filter(d => d.slot === s)]).filter(([, l]) => l.length);
  return `<section class="blk"><div class="bh"><h2>${SLOTS[v.slot]} · jetzt</h2><p>Halten für Zutaten</p></div>
  ${v.peek ? peekCard(v.peek) : ''}<div class="dishes">${v.now.map(dishBtn).join('')}</div>
  <details class="ses more"><summary><b>Andere Gerichte</b><span>${v.rest.length}</span></summary>${groups.map(([s, l]) => `<p class="note fl">${SLOTS[s]}</p><div class="dishes">${l.map(dishBtn).join('')}</div>`).join('')}</details>
  <div class="ex" style="margin-top:8px"><h3 class="sq">Eigene Eingabe</h3><div class="tools" style="margin-top:8px">${[10, 20, 30].map(g => `<button class="btn" type="button" data-a="quick" data-g="${g}">+${g} g</button>`).join('')}</div>
  <div class="frow"><input class="tx" type="number" inputmode="numeric" min="1" max="300" data-a="free" value="${esc(v.draft)}" placeholder="Gramm Protein" aria-label="Gramm Protein"><button class="btn pri" type="button" data-a="fadd">+ Hinzufügen</button></div></div></section>`;
}

function entries(v) {
  const rows = v.meals.map(m => {
    const late = isLate(m.t) ? '<small class="late">nach 19 Uhr</small>' : '';
    if (m.id === v.editing) {
      return `<li class="ed"><span class="tt">${esc(m.t)}</span><span class="nm"><b>${esc(m.name)}</b>${late}</span>
      <div class="erow"><label class="gin"><input type="number" inputmode="numeric" min="0" max="300" data-a="mg" data-id="${esc(m.id)}" value="${num(m.g)}" aria-label="Gramm Protein">g</label>
      <button class="btn pri" type="button" data-a="mdone">Fertig</button><button class="btn red" type="button" data-a="mdel" data-id="${esc(m.id)}">Löschen</button></div></li>`;
    }
    return `<li class="ln"><button class="mrow" type="button" data-a="medit" data-id="${esc(m.id)}"><span class="tt">${esc(m.t)}</span><span class="nm"><b>${esc(m.name)}</b>${late}</span><span class="val">${num(m.g)} g</span></button></li>`;
  }).join('');
  return `<section class="blk"><div class="bh"><h2>Heute gegessen</h2><p>Antippen zum Ändern</p></div>
  ${rows ? `<ul class="rows">${rows}</ul>` : '<p class="empty">Noch nichts eingetragen. Tipp oben auf ein Gericht.</p>'}
  <p class="note">${esc(FOOD_NOTE)} · Letzte Mahlzeit ${LAST_MEAL}</p></section>`;
}

// Litres with up to two decimals: 1000 → '1,0', 1250 → '1,25'.
export const litres = ml => { const v = Math.round(num(ml) / 10) / 100; return Number.isInteger(v) ? v + ',0' : String(v).replace('.', ','); };

function water(v) {
  const w = num(v.water), status = w >= WATER.full ? 'Volles Ziel ✓' : w >= WATER.goal ? 'Ziel erreicht ✓' : `noch ${litres(WATER.goal - w)} L`;
  return `<section class="blk"><div class="bh"><h2>Wasser</h2><p>${status}</p></div>
  <div class="ex"><p class="pnum"><b>${litres(w)} / ${litres(WATER.goal)} L</b></p>
  <div class="pbar wbar" aria-hidden="true"><i style="width:${Math.min(100, w / WATER.full * 100)}%"></i><s style="left:${WATER.goal / WATER.full * 100}%"></s></div>
  <p class="note">Ziel ${litres(WATER.goal)} L · volles Ziel ${litres(WATER.full)} L</p>
  <div class="frow"><button class="btn pri" type="button" data-a="water">+ ${litres(v.bottle)} L</button><button class="btn" type="button" data-a="waterminus" aria-label="${litres(v.bottle)} L weniger">−</button>
  <label class="dsel"><select data-a="bottle" aria-label="Flaschengröße">${WATER.bottles.map(b => `<option value="${b}"${b === v.bottle ? ' selected' : ''}>Flasche ${litres(b)} L</option>`).join('')}</select></label></div></div></section>`;
}

function clean(v) {
  const n = v.streak, broken = v.broken || [];
  return `<section class="blk"><div class="bh"><h2>Sauber essen</h2><p>${n ? `${n} ${n === 1 ? 'Tag' : 'Tage'} sauber in Folge` : 'Noch keine Serie'}</p></div>
  <div class="ex"><button class="btn${v.clean === true ? ' pri' : ''}" type="button" data-a="clean" aria-pressed="${v.clean === true}">${v.clean === true ? '✓ Alles eingehalten' : 'Alles eingehalten'}</button>
  <p class="note fl">Regel gebrochen? Antippen, welche:</p>
  <div class="chips">${RULES.map(([k, l]) => `<button class="chipb${broken.includes(k) ? ' on' : ''}" type="button" data-a="broke" data-k="${k}" aria-pressed="${broken.includes(k)}">${l}</button>`).join('')}</div></div></section>`;
}

function supplements(v) {
  const order = [v.due, ...SUPP_GROUPS.filter(g => g !== v.due)], ticked = v.ticked || {};
  const all = v.supps.filter(s => SUPP_GROUPS.includes(s.group)), done = all.filter(s => ticked[s.id]).length;
  return `<section class="blk"><div class="bh"><h2>Supplements</h2><p>${done}/${all.length} heute</p></div>${order.map(g => {
    const items = all.filter(s => s.group === g);
    if (!items.length) return '';
    return `<p class="note fl"><b>${SUPP_LABELS[g]}</b>${g === v.due ? ' <span class="late now">jetzt</span>' : ''} · ${items.filter(s => ticked[s.id]).length}/${items.length}</p>
    <ul class="list">${items.map(s => `<li><label><input type="checkbox" data-a="supp" data-id="${esc(s.id)}" ${ticked[s.id] ? 'checked' : ''}><span>${esc(s.name)}${s.hint ? ` <small class="note">· ${esc(s.hint)}</small>` : ''}${s.shake ? ` <small class="note">· +${num(s.shake)} g Protein</small>` : ''}</span></label></li>`).join('')}</ul>`;
  }).join('')}</section>`;
}

export const todayView = v => hero(v, 'Ernährung') + protein(v) + grid(v) + entries(v) + water(v) + supplements(v) + clean(v);
export const dishesView = v => hero(v, 'Gerichte');
export const shopView = v => hero(v, 'Einkauf') + `<p class="note">${esc(v.note || '')}</p>`;
