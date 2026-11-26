// Start page: what's on now, morning check, today's training, recovery and nutrition, backup reminder.
import { ds, dayIdx, DAYS, DN, addDays } from '../core/dates.js';
import { nowNext } from '../core/schedule.js';
import { esc } from '../core/html.js';
import { DEF } from './training/plan-default.js';
import { totals } from './training/logic.js';
import { summary } from './recovery/index.js';
import { ampCard } from './recovery/view.js';
import { DELOAD_RULES } from './recovery/data.js';
import { summary as foodSum } from './food/index.js';
import { litres } from './food/view.js';
import { SUPP_LABELS } from './food/data.js';
import { summary as routSum } from './routines/index.js';
import { summary as bodySum } from './body/index.js';
import { fmtNum } from './body/logic.js';
import { toGoal } from './body/view.js';
import { conn as arenaConn, cacheSummary } from './arena/index.js';
import { berlinDay, fmt1 } from './arena/logic.js';

const WD = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MO = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function daysBetween(a, b) {
  let n = 0, d = a;
  while (d < b && n < 10000) { d = addDays(d, 1); n++; }
  return n;
}

function backupCard(store, todayStr) {
  const last = store.get('meta.lastBackup');
  const age = last ? daysBetween(last, todayStr) : null;
  if (age !== null && age <= 14) return '';
  const title = age === null ? 'Noch kein Backup' : `Letztes Backup vor ${age} Tagen`;
  return `<a class="card warn" href="#einstellungen"><b>${title}</b><span>Deine Daten liegen nur auf diesem Gerät. Jetzt sichern ›</span></a>`;
}

// Stage 1: computed here; Task 6 swaps in the training area's own summary.
export let trainingSummary = (store, now) => {
  const plan = store.get('train.plan') || DEF, day = plan.days[dayIdx(now)];
  const s = (store.get('train.sess', {}) || {})['s_' + ds(now) + '_' + day.id];
  const { t, o } = totals(day, s);
  return { name: day.name, type: day.type, done: o, total: t };
};
export const setTrainingSummary = fn => { trainingSummary = fn; };

// Recovery reads straight from the store; replaceable like the training one.
export let recoverySummary = ctx => summary(ctx);
export const setRecoverySummary = fn => { recoverySummary = fn; };

// Nutrition reads straight from the store too.
export let foodSummary = ctx => foodSum(ctx);
export const setFoodSummary = fn => { foodSummary = fn; };
export let routinesSummary = ctx => routSum(ctx);
export const setRoutinesSummary = fn => { routinesSummary = fn; };
export let bodySummary = ctx => bodySum(ctx);
export const setBodySummary = fn => { bodySummary = fn; };
// Arena: the last known score from its cache; Heute never loads Firebase.
export let arenaSummary = ctx => ({ has: !!arenaConn(ctx), cache: cacheSummary(ctx), today: berlinDay(ctx.now()) });
export const setArenaSummary = fn => { arenaSummary = fn; };
function arenaTile(a) {
  const t = (href, b, s) => `<a class="tile" href="${href}"><span class="k">Arena</span><b>${b}</b><span>${s}</span></a>`;
  if (!a.has) return t('#einstellungen', 'Arena · einrichten ›', 'Julian · Uygar');
  return a.cache && a.cache.day === a.today ? t('#arena', `Julian ${fmt1(a.cache.julian)} : ${fmt1(a.cache.uygar)} Uygar`, 'heute') : t('#arena', 'Arena öffnen ›', 'Julian · Uygar');
}

// Körper: the quarter check stays on Heute until all eight are done.
function quarterCard(b) {
  const q = b.quarter;
  return q.done < q.total ? `<a class="card warn" href="#koerper"><b>Quartals-Check fällig · ${q.done}/${q.total}</b><span>${q.q.slice(5)} ${q.q.slice(0, 4)} · abhaken ›</span></a>` : '';
}
const bodyTile = b => `<a class="tile" href="#koerper"><span class="k">Körper</span><b>${b.kg ? fmtNum(b.kg.y) + ' kg' : 'Gewicht fehlt'}</b><span>${b.kg ? toGoal(b.kg.y) : 'Messung eintragen ›'}</span></a>`;

// Hints from "Recovery · Trainingstag" and the Wed/Sun meal prep.
function foodCards(f) {
  const c = (href, title, line) => `<a class="card" href="${href}"><p class="k">Ernährung</p><b>${title}</b><span>${line}</span></a>`;
  const cards = [
    f.snack ? c('#ernaehrung', 'Vor dem Training: Kohlenhydrat-Snack', 'Dein Essen ist über 3 h her ›') : '',
    f.dinner ? c('#ernaehrung', 'Abendessen: 30–40 g Protein + Kohlenhydrate', 'Gerichte ansehen ›') : '',
    f.mealprep ? c('#ernaehrung/einkauf', 'Heute Mealprep · Einkaufsliste prüfen', 'Abhaken, was fehlt ›') : '',
  ].join('');
  return cards ? `<section class="blk"><div class="cards">${cards}</div></section>` : '';
}

function foodTile(f) {
  const p = f.target ? `Protein ${f.protein} / ${f.target} g` : `Protein ${f.protein} g · Ziel fehlt`;
  const supps = f.due.total && f.due.done >= f.due.total ? 'Supps ✓' : `${SUPP_LABELS[f.due.group]} ${f.due.done}/${f.due.total}`;
  return `<a class="tile" href="#ernaehrung"><span class="k">Ernährung</span><b>${p}</b><span>Wasser ${litres(f.water)} / ${litres(f.waterGoal)} L · ${supps}</span></a>`;
}

function recoveryCards(r) {
  const morning = r.ampel ? ampCard(r.ampel, r.sum)
    : '<a class="card warn" href="#recovery"><b>Morgen-Check offen</b><span>Schlaf, Energie, Muskeln · 30 Sekunden ›</span></a>';
  const deload = r.cycle.deload ? `<div class="amp deload"><p class="k"><i class="dot" aria-hidden="true"></i>Deload-Woche · RIR ${r.cycle.main}</p><ul>${DELOAD_RULES.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  const suggest = r.suggest ? '<a class="card warn" href="#recovery/zyklus"><b>Deload vorziehen?</b><span>Mehrere Anzeichen treffen zu · ansehen ›</span></a>' : '';
  return morning + deload + suggest;
}

const safe = fn => { try { return fn(); } catch (e) { return null; } };

export function render(route, ctx) {
  const now = ctx.now(), todayStr = ds(now), { now: cur, next } = nowNext(now);
  const nextWhen = (next.day === DAYS[dayIdx(now)] ? '' : DN[next.day] + ' ') + next.start;
  // Each area is read on its own: bad data in one never blanks the start page.
  const tr = safe(() => trainingSummary(ctx.store, now)), rec = safe(() => recoverySummary(ctx)), fd = safe(() => foodSummary(ctx)), rt = safe(() => routinesSummary(ctx)), bd = safe(() => bodySummary(ctx)), ar = safe(() => arenaSummary(ctx));
  const cy = rec && rec.cycle, mob = rec && rec.mobility;
  const trLine = tr && (tr.type === 'ruhe' ? 'Kein Training' : `${tr.done}/${tr.total} Sätze`);
  return `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">Heute</p><h1>${WD[dayIdx(now)]}, ${now.getDate()}. ${MO[now.getMonth()]}</h1>${cy ? `<p class="m">${cy.deload ? `Deload-Woche · RIR ${cy.main}` : `Woche ${cy.week} · ${esc(cy.goal)} · RIR ${cy.main}`}</p>` : ''}</div></div>
  ${rec ? recoveryCards(rec) : ''}${backupCard(ctx.store, todayStr)}${bd ? quarterCard(bd) : ''}${fd ? foodCards(fd) : ''}
  <section class="blk"><div class="cards">
    ${cur ? (/^(Morgen|Abend)routine$/.test(cur.title)
    ? `<a class="card now" href="#routinen/halterung"><p class="k">Jetzt</p><b>${esc(cur.title)}</b><span>bis ${cur.end} · Halterungs-Modus ›</span></a>`
    : `<div class="card now"><p class="k">Jetzt</p><b>${esc(cur.title)}</b><span>bis ${cur.end}</span></div>`) : ''}
    <div class="card"><p class="k">Als Nächstes</p><b>${esc(next.title)}</b><span>${nextWhen}</span></div>
  </div></section>
  <section class="blk"><div class="bh"><h2>Bereiche</h2></div><div class="tiles">
    ${tr ? `<a class="tile" href="#training"><span class="k">Training</span><b>${esc(tr.type === 'ruhe' ? 'Ruhetag' : tr.name)}</b><span>${trLine}</span></a>` : ''}
    ${mob ? `<a class="tile" href="#recovery"><span class="k">Recovery</span><b>Mobility ${mob.routine} · ${mob.name}</b><span>${mob.done ? '✓ erledigt' : 'offen'}</span></a>` : ''}
    ${fd ? foodTile(fd) : ''}
    ${rt ? `<a class="tile" href="#routinen"><span class="k">Routinen</span><b>Morgen ${rt.morgen.done}/${rt.morgen.total}</b><span>Abend ${rt.abend.done}/${rt.abend.total}</span></a>` : ''}
    ${bd ? bodyTile(bd) : ''}
    ${ar ? arenaTile(ar) : ''}
  </div></section>`;
}
