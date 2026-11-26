// Nutrition views as HTML strings. Pure: everything comes in through `v`.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';

const hero = (v, title) => `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">${dfmt(v.day)}</p><h1>${title}</h1></div></div>`;

export const todayView = v => hero(v, 'Ernährung');
export const dishesView = v => hero(v, 'Gerichte');
export const shopView = v => hero(v, 'Einkauf') + `<p class="note">${esc(v.note || '')}</p>`;
