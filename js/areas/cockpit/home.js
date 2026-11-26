// Cockpit start page: the few things worth knowing at a glance, each with its source.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import * as db from './db.js';
import { netWorth, nextExams, currentDept, totals, filterTx, periodRange, logStats, dueTasks, daysUntil, gradeAvg, fmtDur, MONTHS } from './logic.js';
import { PREP, AGENT_STATUS, label } from './data.js';
import { banner, hero, money, amountsShown, srcLine, pbar, common, target, today, onNavigateCommon, mountCommon, csvNote } from './ui.js';
import { trainingSummary, recoverySummary } from '../heute.js';

export const inDays = n => (n === 0 ? 'heute' : n === 1 ? 'morgen' : n < 0 ? 'vorbei' : `in ${n} Tagen`);
export const fmtGrade = g => g.toFixed(Math.round(g * 100) % 10 ? 2 : 1).replace('.', ',');
const latest = items => items.map(i => i.upd).filter(Boolean).sort().pop() || null;
const srcOf = items => (items.some(i => i.src === 'beispiel') ? 'beispiel' : items.some(i => i.src === 'csv') ? 'csv' : items.some(i => i.src === 'import') ? 'import' : 'manuell');
const card = (title, href, body, foot = '', cls = '') => `<section class="ccard${cls}"><div class="ch"><h2>${title}</h2>${href ? `<a href="${href}">Öffnen ›</a>` : ''}</div>${body}${foot ? `<p class="foot">${foot}</p>` : ''}</section>`;
const safe = fn => { try { return fn(); } catch (e) { return null; } };

function examsCard(ctx, t) {
  const all = db.list(ctx, 'exam'), next = nextExams(all, t);
  const body = next.length ? `<ul class="crows">${next.map(e => {
    const n = daysUntil(t, e.d);
    return `<li><div class="nm"><b>${esc(e.subj)}</b><small>${dfmt(e.d)}${e.time ? ' · ' + e.time : ''}${e.place ? ' · ' + esc(e.place) : ''}</small></div><div class="vr"><span class="pill${n <= 3 ? ' hot' : ''}">${inDays(n)}</span><small>${esc(label(PREP, e.prep))}</small></div></li>`;
  }).join('')}</ul>` : '<p class="note">Keine Klassenarbeiten eingetragen.</p>';
  return card('Nächste Klassenarbeiten', '#ausbildung', body, all.length ? srcLine(srcOf(all), latest(all), ctx, { label: 'aktualisiert' }) : '');
}

function tasksCard(ctx, t) {
  const projs = db.list(ctx, 'project'), pt = db.list(ctx, 'ptask');
  const due = dueTasks({ tasks: db.list(ctx, 'stask') }, projs.map(p => ({ ...p, tasks: pt.filter(x => x.proj === p.id) })), t).slice(0, 6);
  const body = due.length ? `<ul class="crows">${due.map(x => `<li><a class="nm" href="${esc(x.href)}"><b>${esc(x.text)}</b><small>${esc(x.where)}</small></a><span class="pill${x.overdue ? ' late' : x.due === t ? ' hot' : ''}">${x.overdue ? 'überfällig' : x.due === t ? 'heute' : dfmt(x.due)}</span></li>`).join('')}</ul>`
    : '<p class="note">Nichts fällig in den nächsten 7 Tagen.</p>';
  return card('Aufgaben', '', body, 'aus Ausbildung und Projekten');
}

function moneyCard(ctx) {
  const acc = db.list(ctx, 'account'), nw = netWorth(acc);
  const toggle = `<button class="btn sm" type="button" data-a="shown" aria-pressed="${amountsShown()}">${amountsShown() ? 'Beträge verbergen' : 'Beträge zeigen'}</button>`;
  if (!acc.length) return card('Vermögen', '#finanzen/konten', '<p class="note">Noch kein Konto eingetragen.</p><a class="sublink" href="#finanzen/konten">Konto anlegen ›</a>');
  const body = `<div class="big"><span class="k">Gesamtvermögen</span><b>${money(nw.total, 'EUR', true)}</b>${toggle}</div>
  <ul class="crows">${acc.map(a => `<li><div class="nm"><b>${esc(a.name)}</b>${srcLine(a.src, a.asOf, ctx, { warnDays: 30 })}</div><span class="vr">${money(a.bal, a.cur, true)}</span></li>`).join('')}</ul>
  ${nw.skipped.length ? `<p class="note">Nicht eingerechnet (andere Währung): ${esc(nw.skipped.join(', '))}</p>` : ''}`;
  return card('Vermögen', '#finanzen', body);
}

function monthCard(ctx, t) {
  const r = periodRange('monat', t), tx = filterTx(db.list(ctx, 'tx'), { range: r }), m = totals(tx, db.list(ctx, 'cat')), l = logStats(db.list(ctx, 'log'), { range: r });
  const row = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  return card(`Diesen Monat · ${MONTHS[+t.slice(5, 7) - 1]}`, '', `<div class="kv2">${row('Einnahmen', money(m.inc, 'EUR', true))}${row('Ausgaben', money(m.exp, 'EUR', true))}${row('Zurückgelegt', money(m.save, 'EUR', true))}</div>
  ${csvNote(ctx, tx)}<p class="fl note">Business Log</p><div class="kv2">${row('Gewinn', money(l.profit, 'EUR', true))}${row('Stunden', fmtDur(l.min))}${row('Einträge', l.n)}</div>`,
  `Finanzen aus ${tx.length} Buchungen · Business aus ${l.n} Log-Einträgen`);
}

function schoolCard(ctx, t) {
  const depts = db.list(ctx, 'dept'), d = currentDept(depts, t), avg = gradeAvg(db.list(ctx, 'exam'));
  const body = d ? `<p class="lead"><b>${esc(d.name)}</b></p><p class="note">seit ${dfmt(d.from)}${d.to ? ` · bis ${dfmt(d.to)}` : ''}</p>` : '<p class="note">Keine aktuelle Abteilung eingetragen.</p>';
  return card('Ausbildung', '#ausbildung', body + (avg ? `<p class="note">Schnitt bisher: <b>${fmtGrade(avg)}</b></p>` : ''), depts.length ? srcLine(srcOf(depts), latest(depts), ctx, { label: 'aktualisiert' }) : '');
}

function projectsCard(ctx) {
  const ps = db.list(ctx, 'project').filter(p => p.status === 'aktiv');
  const body = ps.length ? `<ul class="crows">${ps.map(p => `<li class="pj"><a class="nm" href="#projekte/p-${esc(p.id)}"><b>${esc(p.name)}</b><small>${p.goal ? 'Ziel: ' + esc(p.goal) : 'Kein nächstes Ziel eingetragen'}</small></a><span class="vr">${p.prog} %</span>${pbar(p.prog, `${p.name}: ${p.prog} Prozent`)}${p.upd ? srcLine(p.src, p.upd, ctx, { label: 'aktualisiert' }) : '<span class="src">noch nicht bearbeitet</span>'}</li>`).join('')}</ul>` : '<p class="note">Keine aktiven Projekte.</p>';
  return card('Aktive Projekte', '#projekte', body);
}

function healthCard(ctx) {
  const tr = safe(() => trainingSummary(ctx.store, ctx.now())), rec = safe(() => recoverySummary(ctx));
  const rows = [];
  if (tr) rows.push(`<li><div class="nm"><b>Training</b><small>${esc(tr.type === 'ruhe' ? 'Ruhetag' : tr.name)}</small></div><span class="vr">${tr.type === 'ruhe' ? '–' : `${tr.done}/${tr.total} Sätze`}</span></li>`);
  if (rec) rows.push(`<li><div class="nm"><b>Morgen-Check</b><small>${rec.ampel ? esc(rec.ampel.label) : 'noch offen'}</small></div><span class="vr">${rec.ampel ? `${rec.sum}/15` : '–'}</span></li>`);
  if (rec && rec.mobility) rows.push(`<li><div class="nm"><b>Mobility</b><small>${esc(rec.mobility.routine + ' · ' + rec.mobility.name)}</small></div><span class="vr">${rec.mobility.done ? '✓' : 'offen'}</span></li>`);
  return card('Training & Erholung', '#heute', rows.length ? `<ul class="crows">${rows.join('')}</ul>` : '<p class="note">Keine Daten.</p>', 'aus KI-Apps auf diesem Gerät');
}

function agentsCard(ctx) {
  const ags = db.list(ctx, 'agent');
  if (!ags.length) return card('KI-Agents', '#agents', '<p class="note">Noch keine Agents eingetragen.</p>', 'nicht verbunden');
  const counts = AGENT_STATUS.map(([k, l]) => [l, ags.filter(a => a.status === k).length]).filter(x => x[1]);
  return card('KI-Agents', '#agents', `<p class="lead">${counts.map(([l, n]) => `<b>${n}</b> ${esc(l)}`).join(' · ')}</p>${ags.filter(a => a.status === 'fehlgeschlagen').map(a => `<p class="note err">${esc(a.name)}: ${esc(a.issues || 'fehlgeschlagen')}</p>`).join('')}`, 'nicht verbunden · Status manuell gepflegt');
}

export function render(route, ctx) {
  const t = today(ctx), now = ctx.now();
  const emptyAll = !db.isDemo(ctx) && !['account', 'tx', 'exam', 'log', 'note', 'agent', 'dept'].some(n => db.list(ctx, n).length);
  const intro = emptyAll ? `<section class="ccard intro"><b>Dein Cockpit ist noch leer.</b><p>Trag Konten, Klassenarbeiten oder Business-Einträge ein – oder sieh dir alles erst mit Beispieldaten an. Deine echten Einträge bleiben davon getrennt.</p><div class="tools"><button class="btn pri" type="button" data-a="demostart">Beispieldaten ansehen</button></div></section>` : '';
  return `${banner(ctx)}${hero('Cockpit', 'Überblick', now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}${intro}
  <div class="cgrid">${examsCard(ctx, t)}${tasksCard(ctx, t)}${moneyCard(ctx)}${monthCard(ctx, t)}${schoolCard(ctx, t)}${projectsCard(ctx)}${healthCard(ctx)}${agentsCard(ctx)}</div>`;
}
export function onClick(e, route, ctx) { const t = target(e); if (t) common(t, ctx); }
export function onNavigate() { onNavigateCommon(); }
export function mount() { mountCommon(); }
