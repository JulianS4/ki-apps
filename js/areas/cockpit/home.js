// Übersicht: the day and the big picture. First what needs doing now, then a few
// figures, then sections that open on demand. Every figure names its source.
import { esc } from '../../core/html.js';
import { dfmt, dshort, dayIdx, DAYS, DN } from '../../core/dates.js';
import { nowNext } from '../../core/schedule.js';
import * as db from './db.js';
import { netWorth, nextExams, currentDept, totals, filterTx, periodRange, logStats, dueTasks, daysUntil, gradeAvg, fmtDur, MONTHS } from './logic.js';
import { PREP, AGENT_STATUS, label } from './data.js';
import { banner, hero, money, amountsShown, srcLine, pbar, common, target, today, onNavigateCommon, mountCommon, csvNote } from './ui.js';
import { icon } from './nav.js';
import { trainingSummary, recoverySummary, bodySummary } from '../heute.js';

export const inDays = n => (n === 0 ? 'heute' : n === 1 ? 'morgen' : n < 0 ? 'vorbei' : `in ${n} Tagen`);
export const fmtGrade = g => g.toFixed(Math.round(g * 100) % 10 ? 2 : 1).replace('.', ',');
const latest = items => items.map(i => i.upd).filter(Boolean).sort().pop() || null;
const srcOf = items => (items.some(i => i.src === 'beispiel') ? 'beispiel' : items.some(i => i.src === 'csv') ? 'csv' : items.some(i => i.src === 'import') ? 'import' : 'manuell');
const safe = fn => { try { return fn(); } catch (e) { return null; } };
const open = new Set();
const row = (ic, title, line, href, att = false) => ({ ic, title, line, href, att });

// What needs doing now, most urgent first; at most six lines.
function agenda(ctx, t) {
  const now = ctx.now(), out = [];
  const rec = safe(() => recoverySummary(ctx)), bd = safe(() => bodySummary(ctx));
  const projs = db.list(ctx, 'project'), pt = db.list(ctx, 'ptask');
  const due = dueTasks({ tasks: db.list(ctx, 'stask') }, projs.map(p => ({ ...p, tasks: pt.filter(x => x.proj === p.id) })), t, 0);
  const late = due.filter(x => x.overdue), todayDue = due.filter(x => !x.overdue);
  if (late.length) out.push(row('projects', late.length === 1 ? late[0].text : `${late.length} Aufgaben überfällig`, late.length === 1 ? `${late[0].where} · überfällig seit ${dfmt(late[0].due)}` : late.map(x => x.text).slice(0, 3).join(' · '), late[0].href, true));
  for (const a of db.list(ctx, 'agent').filter(x => x.status === 'fehlgeschlagen')) out.push(row('agents', `${a.name} fehlgeschlagen`, a.issues || 'Status manuell eingetragen', '#agents', true));
  for (const e of nextExams(db.list(ctx, 'exam'), t).filter(x => daysUntil(t, x.d) <= 3)) out.push(row('school', `Klassenarbeit ${e.subj} ${inDays(daysUntil(t, e.d))}`, `${dfmt(e.d)}${e.time ? ' · ' + e.time : ''} · Vorbereitung: ${label(PREP, e.prep)}`, '#ausbildung', daysUntil(t, e.d) <= 1 && e.prep !== 'fertig'));
  if (todayDue.length) out.push(row('projects', todayDue.length === 1 ? todayDue[0].text : `${todayDue.length} Aufgaben heute fällig`, todayDue.length === 1 ? `${todayDue[0].where} · heute fällig` : todayDue.map(x => x.text).slice(0, 3).join(' · '), todayDue[0].href));
  if (rec && !rec.ampel) out.push(row('health', 'Morgen-Check offen', 'Schlaf, Energie, Muskeln · 30 Sekunden', '#recovery'));
  else if (rec && rec.ampel && rec.ampel.key !== 'gruen') out.push(row('health', `Morgen-Check: ${rec.ampel.label}`, rec.ampel.advice, '#recovery', true));
  if (rec && rec.suggest) out.push(row('health', 'Deload vorziehen?', 'Mehrere Anzeichen treffen zu', '#recovery/zyklus', true));
  const last = ctx.store.get('meta.lastBackup'), age = last ? daysUntil(last, t) : null;
  if (age === null || age > 14) out.push(row('settings', age === null ? 'Noch kein Backup' : `Letztes Backup vor ${age} Tagen`, 'Deine Daten liegen nur auf diesem Gerät', '#einstellungen', true));
  if (bd && bd.quarter && bd.quarter.done < bd.quarter.total) out.push(row('health', `Quartals-Check fällig · ${bd.quarter.done}/${bd.quarter.total}`, 'Messen, Fotos, Tests abhaken', '#koerper'));
  const { now: cur, next } = nowNext(now);
  if (cur) out.push(row('cockpit', `Jetzt: ${cur.title}`, `bis ${cur.end}`, /^(Morgen|Abend)routine$/.test(cur.title) ? '#routinen/halterung' : '#routinen'));
  else if (next) out.push(row('cockpit', `Als Nächstes: ${next.title}`, (next.day === DAYS[dayIdx(now)] ? '' : DN[next.day] + ' ') + next.start, '#routinen'));
  return [...out.filter(x => x.att), ...out.filter(x => !x.att)].slice(0, 6);
}
const agendaHtml = items => `<ul class="agenda">${items.map(x => `<li${x.att ? ' class="att"' : ''}><a class="rowlink" href="${esc(x.href)}">${icon(x.ic)}<span class="tx2"><b>${esc(x.title)}</b><small>${esc(x.line)}</small></span><span class="chev" aria-hidden="true">›</span></a></li>`).join('') || '<li class="done">Nichts Dringendes. ✓</li>'}</ul>`;

function figures(ctx, t) {
  const acc = db.list(ctx, 'account'), nw = netWorth(acc), r = periodRange('monat', t), tx = filterTx(db.list(ctx, 'tx'), { range: r }), m = totals(tx, db.list(ctx, 'cat')), l = logStats(db.list(ctx, 'log'), { range: r }), mon = MONTHS[+t.slice(5, 7) - 1];
  const fig = (href, k, b, sub) => `<a class="fig" href="${href}"><span class="k">${k}</span><b>${b}</b><span class="sub">${sub}</span></a>`;
  return `<div class="figs">
    ${acc.length ? fig('#finanzen', 'Gesamtvermögen', money(nw.total, 'EUR', true), `${acc.length} ${acc.length === 1 ? 'Konto' : 'Konten'} · ältester Stand ${dshort(nw.oldest)}`) : fig('#finanzen', 'Gesamtvermögen', '–', 'Noch kein Konto eingetragen')}
    ${fig('#finanzen', `Ausgaben ${mon}`, money(m.exp, 'EUR', true), `Einnahmen ${money(m.inc, 'EUR', true)} · aus ${tx.length} Buchungen`)}
    ${fig('#business-log', `Arbeitsstunden ${mon}`, fmtDur(l.min), `Business Log · Gewinn ${money(l.profit, 'EUR', true)} · ${l.n} Einträge`)}
  </div>${csvNote(ctx, tx)}
  <div class="mask"><button class="btn sm" type="button" data-a="shown" aria-pressed="${amountsShown()}">${amountsShown() ? 'Beträge verbergen' : 'Beträge zeigen'}</button></div>`;
}

function section(k, ic, title, summary, body) {
  return `<details class="dsc"${open.has(k) ? ' open' : ''}><summary data-a="dsc" data-k="${k}">${icon(ic)}<span class="tx2"><b>${title}</b><small>${summary}</small></span></summary><div class="dbody">${body}</div></details>`;
}

function schoolSec(ctx, t) {
  const exams = db.list(ctx, 'exam'), next = nextExams(exams, t), d = currentDept(db.list(ctx, 'dept'), t), avg = gradeAvg(exams);
  const sum = [d ? `Abteilung ${esc(d.name)}` : 'Keine aktuelle Abteilung', next.length ? `nächste Arbeit ${esc(next[0].subj)} ${inDays(daysUntil(t, next[0].d))}` : 'Keine Klassenarbeiten eingetragen'].join(' · ');
  const body = `${next.length ? `<ul class="crows">${next.map(e => `<li><div class="nm"><b>${esc(e.subj)}</b><small>${dfmt(e.d)}${e.time ? ' · ' + e.time : ''}${e.place ? ' · ' + esc(e.place) : ''}</small></div><div class="vr"><span class="pill${daysUntil(t, e.d) <= 3 ? ' hot' : ''}">${inDays(daysUntil(t, e.d))}</span><small>${esc(label(PREP, e.prep))}</small></div></li>`).join('')}</ul>` : '<p class="note">Keine Klassenarbeiten eingetragen.</p>'}
    ${avg ? `<p class="note">Schnitt bisher: <b>${fmtGrade(avg)}</b></p>` : ''}${exams.length ? srcLine(srcOf(exams), latest(exams), ctx, { label: 'aktualisiert' }) : ''}<a class="sublink" href="#ausbildung">Zur Ausbildung ›</a>`;
  return section('school', 'school', 'Ausbildung', sum, body);
}

function projectsSec(ctx, t) {
  const ps = db.list(ctx, 'project').filter(p => p.status === 'aktiv'), pt = db.list(ctx, 'ptask');
  const step = p => { const o = pt.filter(x => x.proj === p.id && !x.done).sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : 1))[0]; return o ? `Nächster Schritt: ${o.text}${o.due ? ` (${o.due < t ? 'überfällig' : dfmt(o.due)})` : ''}` : p.goal ? `Ziel: ${p.goal}` : 'Kein nächster Schritt eingetragen'; };
  const body = ps.length ? `<ul class="crows">${ps.map(p => `<li class="pj"><a class="nm" href="#projekte/p-${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(step(p))}</small></a><span class="vr">${p.prog} %</span>${pbar(p.prog, `${p.name}: ${p.prog} Prozent`)}${p.upd ? srcLine(p.src, p.upd, ctx, { label: 'aktualisiert' }) : '<span class="src">noch nicht bearbeitet</span>'}</li>`).join('')}</ul>` : '<p class="note">Keine aktiven Projekte.</p>';
  return section('projects', 'projects', 'Aktive Projekte', `${ps.length} aktiv${ps.length ? ' · ' + esc(ps.map(p => p.name).join(', ')) : ''}`, body + '<a class="sublink" href="#projekte">Zu den Projekten ›</a>');
}

function accountsSec(ctx) {
  const acc = db.list(ctx, 'account'), nw = netWorth(acc);
  const body = acc.length ? `<ul class="crows">${acc.map(a => `<li><div class="nm"><b>${esc(a.name)}</b>${srcLine(a.src, a.asOf, ctx, { warnDays: 30 })}</div><span class="vr">${money(a.bal, a.cur, true)}</span></li>`).join('')}</ul>${nw.skipped.length ? `<p class="note">Nicht eingerechnet (andere Währung): ${esc(nw.skipped.join(', '))}</p>` : ''}`
    : '<p class="note">Noch kein Konto eingetragen.</p>';
  return section('accounts', 'finance', 'Konten', acc.length ? `${acc.length} ${acc.length === 1 ? 'Konto' : 'Konten'} · ältester Stand ${dshort(nw.oldest)}` : 'Noch kein Konto', body + '<a class="sublink" href="#finanzen">Zu den Finanzen ›</a>');
}

function healthSec(ctx) {
  const tr = safe(() => trainingSummary(ctx.store, ctx.now())), rec = safe(() => recoverySummary(ctx)), rows = [];
  if (tr) rows.push(`<li><div class="nm"><b>Training</b><small>${esc(tr.type === 'ruhe' ? 'Ruhetag' : tr.name)}</small></div><span class="vr">${tr.type === 'ruhe' ? '–' : `${tr.done}/${tr.total} Sätze`}</span></li>`);
  if (rec) rows.push(`<li><div class="nm"><b>Morgen-Check</b><small>${rec.ampel ? esc(rec.ampel.label) : 'noch offen'}</small></div><span class="vr">${rec.ampel ? `${rec.sum}/15` : '–'}</span></li>`);
  if (rec && rec.mobility) rows.push(`<li><div class="nm"><b>Mobility</b><small>${esc(rec.mobility.routine + ' · ' + rec.mobility.name)}</small></div><span class="vr">${rec.mobility.done ? '✓ erledigt' : 'offen'}</span></li>`);
  const sum = [tr ? (tr.type === 'ruhe' ? 'Ruhetag' : `${esc(tr.name)} · ${tr.done}/${tr.total} Sätze`) : '', rec ? (rec.ampel ? `Morgen-Check ${esc(rec.ampel.label)}` : 'Morgen-Check offen') : ''].filter(Boolean).join(' · ');
  return section('health', 'health', 'Training & Erholung', sum || 'Keine Daten', `${rows.length ? `<ul class="crows">${rows.join('')}</ul>` : ''}<span class="src">aus Training und Recovery auf diesem Gerät</span><a class="sublink" href="#heute">Zu Training & Erholung ›</a>`);
}

function agentsSec(ctx) {
  const ags = db.list(ctx, 'agent'), counts = AGENT_STATUS.map(([k, l]) => [l, ags.filter(a => a.status === k).length]).filter(x => x[1]);
  const body = ags.length ? `<ul class="crows">${ags.map(a => `<li><div class="nm"><b>${esc(a.name)}</b>${srcLine(a.src, a.asOf, ctx)}</div><span class="vr">${a.status === 'fehlgeschlagen' ? '<span class="pill late">fehlgeschlagen</span>' : esc(label(AGENT_STATUS, a.status))}</span></li>`).join('')}</ul>` : '<p class="note">Noch keine Agents eingetragen.</p>';
  return section('agents', 'agents', 'KI-Agents', `${ags.length ? counts.map(([l, n]) => `${n} ${esc(l)}`).join(' · ') + ' · ' : ''}nicht verbunden`, body + '<span class="src">nicht verbunden · Status manuell gepflegt</span><a class="sublink" href="#agents">Zu den Agents ›</a>');
}

const greet = h => (h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend');
export function render(route, ctx) {
  const t = today(ctx), now = ctx.now(), items = agenda(ctx, t);
  const emptyAll = !db.isDemo(ctx) && !['account', 'tx', 'exam', 'log', 'note', 'agent', 'dept'].some(n => db.list(ctx, n).length);
  const intro = emptyAll ? `<section class="ccard intro"><b>Life OS ist noch leer.</b><p>Trag Konten, Klassenarbeiten oder Business-Einträge ein – oder sieh dir alles erst mit Beispieldaten an. Deine echten Einträge bleiben davon getrennt.</p><div class="tools"><button class="btn pri" type="button" data-a="demostart">Beispieldaten ansehen</button><a class="btn" href="#finanzen">Konto hinzufügen</a></div></section>` : '';
  const dateLine = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `${banner(ctx)}${hero(dateLine, greet(now.getHours()), items.length ? `${items.length} ${items.length === 1 ? 'Punkt steht' : 'Punkte stehen'} an.` : 'Heute ist nichts Dringendes offen.')}${intro}
  <section class="blk"><div class="bh"><h2>Jetzt wichtig</h2></div>${agendaHtml(items)}</section>
  <section class="blk"><div class="bh"><h2>Zahlen</h2><p>tippen für Details</p></div>${figures(ctx, t)}</section>
  <section class="blk"><div class="bh"><h2>Bereiche</h2><p>zum Aufklappen</p></div><div class="ovgrid"><div>${schoolSec(ctx, t)}${projectsSec(ctx, t)}${accountsSec(ctx)}</div><div>${healthSec(ctx)}${agentsSec(ctx)}</div></div></section>`;
}
export function onClick(e, route, ctx) {
  const t = target(e);
  if (!t) return;
  if (t.dataset.a === 'dsc') { const k = t.dataset.k; if (open.has(k)) open.delete(k); else open.add(k); return; }
  common(t, ctx);
}
export function onNavigate() { onNavigateCommon(); }
export function mount() { mountCommon(); }
