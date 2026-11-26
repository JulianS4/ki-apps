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
    <label class="note fl" for="fWeight">Gewicht in kg</label><input id="fWeight" class="tx" type="text" inputmode="decimal" autocomplete="off" data-a="weight" value="${w ? w.kg : ''}" placeholder="z. B. 85"></div>` : '';
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
  const other = groups.flatMap(([, l]) => l), inRest = !!v.peek && other.some(d => d.id === v.peek.id);
  // The ingredients card shows where the held dish is, and keeps that list open.
  return `<section class="blk"><div class="bh"><h2>${SLOTS[v.slot]} · jetzt</h2><p>Halten für Zutaten</p></div>
  ${v.peek && !inRest ? peekCard(v.peek) : ''}<div class="dishes">${v.now.map(dishBtn).join('')}</div>
  <details class="ses more"${v.moreOpen || inRest ? ' open' : ''}><summary data-a="more"><b>Andere Gerichte</b><span>${other.length}</span></summary>${inRest ? `<div class="pk">${peekCard(v.peek)}</div>` : ''}${groups.map(([s, l]) => `<p class="note fl">${SLOTS[s]}</p><div class="dishes">${l.map(dishBtn).join('')}</div>`).join('')}</details>
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
  <p class="note">Ziel ${litres(WATER.goal)} L · volles Ziel ${litres(WATER.full)} L${v.fromRoutine ? ` · inkl. ${litres(v.fromRoutine)} L aus der Morgenroutine` : ''}</p>
  <div class="frow"><button class="btn pri" type="button" data-a="water">+ ${litres(v.bottle)} L</button><button class="btn" type="button" data-a="waterminus" aria-label="${litres(v.bottle)} L weniger">−</button>
  <label class="dsel"><select data-a="bottle" aria-label="Flaschengröße">${WATER.bottles.map(b => `<option value="${b}"${b === v.bottle ? ' selected' : ''}>Flasche ${litres(b)} L</option>`).join('')}</select></label></div></div></section>`;
}

function clean(v) {
  const n = v.streak, broken = v.broken || [];
  return `<section class="blk"><div class="bh"><h2>Sauber essen</h2><p>${n ? `${n} ${n === 1 ? 'Tag' : 'Tage'} sauber in Folge` : 'Noch keine Serie'}</p></div>
  ${v.yOpen ? '<div class="ex yrow"><span>Gestern sauber gegessen?</span><button class="btn" type="button" data-a="yclean">Ja</button><button class="btn" type="button" data-a="ybroke">Nein</button></div>' : ''}
  <div class="ex"><button class="btn${v.clean === true ? ' pri' : ''}" type="button" data-a="clean" aria-pressed="${v.clean === true}">${v.clean === true ? '✓ Alles eingehalten' : 'Alles eingehalten'}</button>
  <p class="note fl">Regel gebrochen? Antippen, welche:</p>
  <div class="chips">${RULES.map(([k, l]) => `<button class="chipb${broken.includes(k) ? ' on' : ''}" type="button" data-a="broke" data-k="${k}" aria-pressed="${broken.includes(k)}">${l}</button>`).join('')}</div></div></section>`;
}

function supplements(v) {
  const order = [v.due, ...SUPP_GROUPS.filter(g => g !== v.due)], ticked = v.ticked || {};
  const all = v.supps.filter(s => SUPP_GROUPS.includes(s.group)), done = all.filter(s => ticked[s.id]).length;
  const row = s => v.suppEdit
    ? `<li><div class="li"><input class="tx" data-a="sn" data-id="${esc(s.id)}" value="${esc(s.name)}" aria-label="Name" autocomplete="off"><button class="btn" type="button" data-a="sdel" data-id="${esc(s.id)}" aria-label="${esc(s.name)} entfernen">×</button></div></li>`
    : `<li><label><input type="checkbox" data-a="supp" data-id="${esc(s.id)}" ${ticked[s.id] ? 'checked' : ''}><span>${esc(s.name)}${s.hint ? ` <small class="note">· ${esc(s.hint)}</small>` : ''}${s.shake ? ` <small class="note">· +${num(s.shake)} g Protein</small>` : ''}</span></label></li>`;
  return `<section class="blk"><div class="bh"><h2>Supplements</h2><p>${done}/${all.length} heute</p></div>${order.map(g => {
    const items = all.filter(s => s.group === g);
    if (!items.length && !v.suppEdit) return '';
    return `<p class="note fl"><b>${SUPP_LABELS[g]}</b>${g === v.due ? ' <span class="late now">jetzt</span>' : ''} · ${items.filter(s => ticked[s.id]).length}/${items.length}</p>
    ${items.length ? `<ul class="list">${items.map(row).join('')}</ul>` : ''}${v.suppEdit ? `<button class="add" type="button" data-a="sadd" data-group="${g}">+ Supplement</button>` : ''}`;
  }).join('')}
  <div class="tools"><button class="btn${v.suppEdit ? ' pri' : ''}" type="button" data-a="sedit">${v.suppEdit ? 'Fertig mit Bearbeiten' : 'Bearbeiten'}</button>${v.suppEdit ? `<button class="btn red" type="button" data-a="sreset">${v.confirm === 'supps' ? 'Sicher? Nochmal tippen' : 'Auf Notion-Stand zurücksetzen'}</button>` : ''}</div></section>`;
}

export const todayView = v => hero(v, 'Ernährung') + protein(v) + grid(v) + entries(v) + water(v) + supplements(v) + clean(v);
const DISH_GROUPS = [['fr', 'wt', 'Frühstück Mo–Fr'], ['fr', 'we', 'Frühstück Sa–So'], ['mi', 'wt', 'Mittag Mo–Fr'], ['mi', 'we', 'Mittag Sa–So'],
  ['ab', 'wt', 'Abendessen Mo–Fr'], ['ab', 'we', 'Abendessen Sa–So'], ['sn', 'all', 'Snacks'], ['dr', 'all', 'Drinks']];

const dishRead = d => `<details class="ses"><summary><b>${esc(d.name || 'Ohne Namen')}</b><span>~${num(d.g)} g</span></summary><p class="sigh">${esc(d.ing || '–')}</p></details>`;
const dishEdit = d => `<div class="ex"><label class="note fl" for="dn-${esc(d.id)}">Name</label><input id="dn-${esc(d.id)}" class="tx" data-a="dn" data-id="${esc(d.id)}" value="${esc(d.name)}" autocomplete="off">
  <div class="frow"><label class="gin"><input type="number" inputmode="numeric" min="0" max="150" data-a="dg" data-id="${esc(d.id)}" value="${num(d.g)}" aria-label="Gramm Protein">g Protein</label><button class="btn red" type="button" data-a="ddel" data-id="${esc(d.id)}">Löschen</button></div>
  <label class="note fl" for="di-${esc(d.id)}">Zutaten</label><textarea id="di-${esc(d.id)}" data-a="di" data-id="${esc(d.id)}">${esc(d.ing)}</textarea></div>`;

export function dishesView(v) {
  const used = new Set(), groups = DISH_GROUPS.map(([slot, days, label]) => {
    const l = v.dishes.filter(d => d.slot === slot && d.days === days);
    l.forEach(d => used.add(d));
    return { slot, days, label, l };
  });
  const other = v.dishes.filter(d => !used.has(d));
  if (other.length) groups.push({ label: 'Weitere', l: other });
  return hero(v, 'Gerichte') + `<p class="note">Antippen zeigt die Zutaten. Protein-Werte sind Schätzungen und lassen sich ändern.</p>
  <div class="tools"><button class="btn${v.edit ? ' pri' : ''}" type="button" data-a="dedit">${v.edit ? 'Fertig mit Bearbeiten' : 'Bearbeiten'}</button></div>
  ${groups.map(g => `<section class="blk"><div class="bh"><h2>${g.label}</h2><p>${g.l.length}</p></div>${g.l.map(v.edit ? dishEdit : dishRead).join('')}
  ${v.edit && g.slot ? `<button class="add" type="button" data-a="dadd" data-slot="${g.slot}" data-days="${g.days}">+ Gericht</button>` : ''}</section>`).join('')}
  ${v.edit ? `<section class="blk"><button class="btn red" type="button" data-a="dreset">${v.confirm ? 'Sicher? Nochmal tippen' : 'Auf Notion-Stand zurücksetzen'}</button></section>` : ''}`;
}
export function shopView(v) {
  const need = v.need || {}, n = v.shop.reduce((a, c) => a + c.items.filter(i => need[i.id]).length, 0);
  const cats = v.shop.map(c => {
    const items = v.only ? c.items.filter(i => need[i.id]) : c.items, miss = c.items.filter(i => need[i.id]).length;
    if (!items.length && !v.edit) return '';
    const row = i => v.edit
      ? `<li><div class="li"><span class="t">${esc(i.name)}</span><button class="btn" type="button" data-a="idel" data-id="${esc(i.id)}" aria-label="${esc(i.name)} entfernen">×</button></div></li>`
      : `<li><label><input type="checkbox" data-a="need" data-id="${esc(i.id)}" ${need[i.id] ? 'checked' : ''}>${esc(i.name)}</label></li>`;
    return `<section class="blk"><div class="bh"><h2>${esc(c.cat)}</h2><p>${miss ? `${miss} fehlen` : ''}</p></div>${items.length ? `<ul class="list">${items.map(row).join('')}</ul>` : ''}
    ${v.edit ? `<div class="frow"><input class="tx" data-a="inew" data-cat="${esc(c.cat)}" value="${esc((v.drafts || {})[c.cat] || '')}" placeholder="Neuer Artikel" aria-label="Neuer Artikel in ${esc(c.cat)}" autocomplete="off"><button class="btn" type="button" data-a="iadd" data-cat="${esc(c.cat)}" aria-label="Hinzufügen">+</button></div>` : ''}</section>`;
  }).join('');
  return hero(v, 'Einkauf') + `<p class="note">${esc(v.note || '')} · Hake ab, was fehlt.</p>
  ${v.mealprep ? '<div class="card warn" style="margin-top:12px"><b>Heute Mealprep</b><span>Liste durchgehen und abhaken, was fehlt.</span></div>' : ''}
  <div class="tools"><button class="btn${v.only ? ' pri' : ''}" type="button" data-a="onlyneed" aria-pressed="${!!v.only}">${v.only ? 'Alle Artikel' : `Nur fehlende (${n})`}</button><button class="btn${v.edit ? ' pri' : ''}" type="button" data-a="iedit">${v.edit ? 'Fertig mit Bearbeiten' : 'Bearbeiten'}</button></div>
  ${cats || (v.only ? '<p class="empty">Nichts fehlt gerade.</p>' : '')}
  <section class="blk"><div class="tools"><button class="btn red" type="button" data-a="shopclear">${v.confirm === 'shopclear' ? 'Sicher? Nochmal tippen' : 'Liste zurücksetzen'}</button>${v.edit ? `<button class="btn red" type="button" data-a="ireset">${v.confirm === 'shop' ? 'Sicher? Nochmal tippen' : 'Auf Notion-Stand zurücksetzen'}</button>` : ''}</div></section>`;
}
