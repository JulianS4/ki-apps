// Ziele & Rückblicke: the goals from the Obsidian folder "02 Ziele", the weekly pillar
// check-ins from Notion over time, and a week review built from what Life OS records.
import { esc } from '../../core/html.js';
import { dfmt, addDays } from '../../core/dates.js';
import * as db from './db.js';
import { totals, filterTx, fmtMoney, fmtDur } from './logic.js';
import { checkSum } from '../recovery/logic.js';
import { foodTotals } from '../food/logic.js';
import { weekDays } from './calendar.js';
import { banner, hero, srcLine, empty, today, common, target, onNavigateCommon, mountCommon } from './ui.js';

const isGoal = n => /(^|\/)(\d+\s*)?ziele\//i.test(n.path || '') || (n.tags || []).some(t => /^ziele?$/i.test(t));
// The first readable lines of a note: no front matter, headings or Markdown marks.
export function excerpt(body, max = 180) {
  const text = String(body || '').replace(/^---\n[\s\S]*?\n---\n?/, '').split('\n')
    .filter(l => l.trim() && !/^\s*#/.test(l) && !/^\s*(\||---)/.test(l))
    .map(l => l.replace(/^\s*>\s?/, '').replace(/^\s*[-*]\s+/, '').replace(/\[!\w+\]\s*/, '').replace(/\*\*|__|\*|`/g, '').replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (m, a, b) => b || a).trim())
    .filter(Boolean).join(' ');
  return text.length > max ? text.slice(0, max - 1).replace(/\s+\S*$/, '') + ' …' : text;
}

const PILLARS = [['koerper', 'Körper'], ['karriere', 'Karriere'], ['business', 'Business'], ['fokus', 'Fokus'], ['netzwerk', 'Netzwerk']];
const one = v => v.toFixed(1).replace('.', ',');
const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function pillarsBlock(ctx) {
  const all = db.list(ctx, 'pillar').sort((a, b) => (a.d < b.d ? 1 : -1));
  if (!all.length) return `<section class="blk"><div class="bh"><h2>Fünf Säulen</h2></div>${empty('Noch kein Säulen-Check-in. Trag sonntags deine fünf Werte in Notion ein – die nächste Import-Datei bringt sie mit.')}</section>`;
  const row = p => { const vals = PILLARS.map(([k]) => p[k]).filter(v => v != null), a = avg(vals); return `<tr><th>${esc(p.week || dfmt(p.d))}</th>${PILLARS.map(([k]) => `<td>${p[k] != null ? p[k] : '–'}</td>`).join('')}<td><b>${a != null ? one(a) : '–'}</b></td></tr>`; };
  return `<section class="blk"><div class="bh"><h2>Fünf Säulen</h2><p>${srcLine(all[0].src, all[0].d, ctx, { label: 'Check-in' })}</p></div>
  <div class="tblw"><table class="tbl pillt"><thead><tr><th>Woche</th>${PILLARS.map(([, l]) => `<th>${l}</th>`).join('')}<th>Ø</th></tr></thead><tbody>${all.map(row).join('')}</tbody></table></div></section>`;
}

// What happened between two days (inclusive), from the app's own records.
export function review(ctx, from, to) {
  const inR = d => d >= from && d <= to, sess = ctx.store.get('train.sess', {}) || {};
  const training = Object.values(sess).filter(s => s && inR(s.date || '') && s.sets && Object.values(s.sets).some(a => Array.isArray(a) && a.some(x => x && x.ok))).length;
  const morning = ctx.store.get('rec.morning', {}) || {}, sums = Object.entries(morning).filter(([d]) => inR(d)).map(([, e]) => checkSum(e)).filter(v => v != null);
  const food = ctx.store.get('food.days', {}) || {}, prot = Object.entries(food).filter(([d]) => inR(d)).map(([, e]) => foodTotals(e).protein).filter(g => g > 0);
  const range = { from, to }, spent = totals(filterTx(db.list(ctx, 'tx'), { range }), db.list(ctx, 'cat')).exp;
  const minutes = db.list(ctx, 'log').filter(e => inR(e.d)).reduce((a, e) => a + (e.min || 0), 0);
  const notes = db.list(ctx, 'note').filter(n => inR(String(n.upd || '').slice(0, 10))).length;
  const p = avg(prot);
  return { training, check: avg(sums), protein: p == null ? null : Math.round(p), spent, minutes, notes };
}

function reviewBlock(ctx, t) {
  const mon = weekDays(t)[0].d, lastMon = addDays(mon, -7), cur = review(ctx, mon, t), prev = review(ctx, lastMon, addDays(mon, -1));
  const rows = [
    ['Trainingseinheiten', r => String(r.training), 'Training'],
    ['Ø Morgen-Check', r => (r.check == null ? '–' : `${one(r.check)} / 15`), 'Recovery'],
    ['Ø Protein', r => (r.protein == null ? '–' : `${r.protein} g`), 'Ernährung'],
    ['Ausgaben', r => fmtMoney(r.spent), 'Finanzen'],
    ['Arbeitsstunden', r => fmtDur(r.minutes), 'Business Log'],
    ['Notizen geändert', r => String(r.notes), 'Wissen'],
  ];
  return `<section class="blk"><div class="bh"><h2>Wochenrückblick</h2><p>aus Life OS – nichts geschätzt</p></div>
  <div class="tblw"><table class="tbl review"><thead><tr><th></th><th>Diese Woche (${dfmt(mon)}–${dfmt(t)})</th><th>Vorwoche</th><th>Quelle</th></tr></thead>
  <tbody>${rows.map(([l, f, s]) => `<tr><th>${l}</th><td>${f(cur)}</td><td>${f(prev)}</td><td class="src">${s}</td></tr>`).join('')}</tbody></table></div></section>`;
}

export function render(route, ctx) {
  const t = today(ctx), goals = db.list(ctx, 'note').filter(isGoal).sort((a, b) => a.title.localeCompare(b.title));
  const cards = goals.length
    ? `<div class="cgrid goals">${goals.map(n => `<a class="ccard goal" href="#wissen/n-${esc(n.id)}"><h3>${esc(n.title)}</h3><p>${esc(excerpt(n.body))}</p><span class="src">${n.src === 'vault' ? 'Obsidian' : 'Notiz'} · ${esc(n.path || '')}</span></a>`).join('')}</div>`
    : empty('Noch keine Ziele. Leg deine Ziele in Obsidian in den Ordner „02 Ziele“ (oder gib einer Notiz den Tag #ziel) – die nächste Import-Datei bringt sie mit.', '<a class="btn" href="#import">Zum Import</a>');
  return `${banner(ctx)}${hero('', 'Ziele &amp; Rückblicke', 'Wohin du willst – und was die letzte Woche gebracht hat.')}
  <section class="blk"><div class="bh"><h2>Ziele</h2><p>${goals.length ? `${goals.length} aus deinem Wissen` : ''}</p></div>${cards}</section>
  ${reviewBlock(ctx, t)}${pillarsBlock(ctx)}
  <section class="blk"><div class="bh"><h2>Quartals-Check</h2></div><p class="note">Messen, Fotos und Tests fürs Quartal stehen unter <a href="#koerper">Gesundheit ›</a></p></section>`;
}
export function onClick(e, route, ctx) { const t = target(e); if (t) common(t, ctx); }
export function onNavigate() { onNavigateCommon(); }
export function mount() { mountCommon(); }
