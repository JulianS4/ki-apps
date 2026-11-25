// Start page: what's on now, morning check, today's training and recovery, backup reminder.
import { ds, dayIdx, DAYS, DN, addDays } from '../core/dates.js';
import { nowNext } from '../core/schedule.js';
import { esc } from '../core/html.js';
import { DEF } from './training/plan-default.js';
import { totals } from './training/logic.js';
import { summary } from './recovery/index.js';
import { ampCard } from './recovery/view.js';
import { DELOAD_RULES } from './recovery/data.js';

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

function recoveryCards(r) {
  const morning = r.ampel ? ampCard(r.ampel, r.sum)
    : '<a class="card warn" href="#recovery"><b>Morgen-Check offen</b><span>Schlaf, Energie, Muskeln · 30 Sekunden ›</span></a>';
  const deload = r.cycle.deload ? `<div class="amp deload"><p class="k"><i class="dot" aria-hidden="true"></i>Deload-Woche · RIR ${r.cycle.main}</p><ul>${DELOAD_RULES.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  const suggest = r.suggest ? '<a class="card warn" href="#recovery/zyklus"><b>Deload vorziehen?</b><span>Mehrere Anzeichen treffen zu · ansehen ›</span></a>' : '';
  return morning + deload + suggest;
}

export function render(route, ctx) {
  const now = ctx.now(), todayStr = ds(now), { now: cur, next } = nowNext(now);
  const nextWhen = (next.day === DAYS[dayIdx(now)] ? '' : DN[next.day] + ' ') + next.start;
  const tr = trainingSummary(ctx.store, now), rec = recoverySummary(ctx), cy = rec.cycle, mob = rec.mobility;
  const trLine = tr.type === 'ruhe' ? 'Kein Training' : `${tr.done}/${tr.total} Sätze`;
  return `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">Heute</p><h1>${WD[dayIdx(now)]}, ${now.getDate()}. ${MO[now.getMonth()]}</h1><p class="m">${cy.deload ? `Deload-Woche · RIR ${cy.main}` : `Woche ${cy.week} · ${esc(cy.goal)} · RIR ${cy.main}`}</p></div></div>
  ${recoveryCards(rec)}${backupCard(ctx.store, todayStr)}
  <section class="blk"><div class="cards">
    ${cur ? `<div class="card now"><p class="k">Jetzt</p><b>${esc(cur.title)}</b><span>bis ${cur.end}</span></div>` : ''}
    <div class="card"><p class="k">Als Nächstes</p><b>${esc(next.title)}</b><span>${nextWhen}</span></div>
  </div></section>
  <section class="blk"><div class="bh"><h2>Bereiche</h2></div><div class="tiles">
    <a class="tile" href="#training"><span class="k">Training</span><b>${esc(tr.type === 'ruhe' ? 'Ruhetag' : tr.name)}</b><span>${trLine}</span></a>
    <a class="tile" href="#recovery"><span class="k">Recovery</span><b>Mobility ${mob.routine} · ${mob.name}</b><span>${mob.done ? '✓ erledigt' : 'offen'}</span></a>
  </div><p class="note soon">Kommt bald: Ernährung · Routinen · Körper · Arena</p></section>`;
}
