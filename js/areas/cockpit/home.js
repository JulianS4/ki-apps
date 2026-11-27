// Übersicht: the day as a dashboard. "Jetzt wichtig" first, then one tile per area
// with its own measure (rings, pill bars, a mini knowledge graph). Every figure
// names its source; each tile leads to its area for the details.
import { esc } from '../../core/html.js';
import { dfmt, dshort, dayIdx, DAYS, DN } from '../../core/dates.js';
import { nowNext } from '../../core/schedule.js';
import * as db from './db.js';
import { netWorth, netWorthSeries, nextExams, currentDept, totals, filterTx, periodRange, logStats, dueTasks, daysUntil, gradeAvg, fmtDur, budgetRows, buckets, inRange, MONTHS } from './logic.js';
import { PREP, AGENT_STATUS, label } from './data.js';
import { banner, money, amountsShown, srcLine, common, target, today, onNavigateCommon, mountCommon, csvNote, newBtn, formIf, edInput } from './ui.js';
import { knowledgeBox, kbInput } from './knowledge.js';
import { ring, pills } from './charts.js';
import { graphData } from './graph.js';
import { brainHtml, cachedLayout, bindBrains } from './brain.js';
import { makeResolver } from './md.js';
import { icon } from './nav.js';
import { trainingSummary, recoverySummary, bodySummary } from '../heute.js';

export const inDays = n => (n === 0 ? 'heute' : n === 1 ? 'morgen' : n < 0 ? 'vorbei' : `in ${n} Tagen`);
export const fmtGrade = g => g.toFixed(Math.round(g * 100) % 10 ? 2 : 1).replace('.', ',');
const latest = items => items.map(i => i.upd).filter(Boolean).sort().pop() || null;
const srcOf = items => (items.some(i => i.src === 'beispiel') ? 'beispiel' : items.some(i => i.src === 'csv') ? 'csv' : items.some(i => i.src === 'import') ? 'import' : 'manuell');
const safe = fn => { try { return fn(); } catch (e) { return null; } };
const row = (ic, title, line, href, att = false) => ({ ic, title, line, href, att });
const pct = (a, b) => (b > 0 ? Math.round(a / b * 100) : 0);

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

// One tile: title, the way to its area, the measure, and a foot with the source.
// HUD numbering of the tiles, like the readouts of a cockpit display.
const NUM = { agenda: '01', money: '02', month: '03', train: '04', school: '05', projects: '06', log: '07', agents: '08', wissen: '09' };
const tile = (k, title, href, go, body, foot = '') => `<section class="w w-${k}" data-w="${k}" aria-labelledby="w-${k}"><div class="wh"><h2 id="w-${k}"><span class="wn" aria-hidden="true">${NUM[k] || ''}</span>${title}</h2>${href ? `<a class="wgo" href="${href}">${go} <span aria-hidden="true">›</span></a>` : ''}</div><div class="wb">${body}</div>${foot ? `<div class="wf">${foot}</div>` : ''}</section>`;

// Net worth over time as a soft line; the shape only, no amounts.
function spark(series) {
  if (series.length < 2) return '';
  const w = 300, h = 64, ys = series.map(p => p.c), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const pts = series.map((p, i) => [(i / (series.length - 1)) * w, h - 6 - ((p.c - lo) / span) * (h - 14)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '), up = ys[ys.length - 1] >= ys[0];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Vermögensverlauf seit ${dshort(series[0].date)}: ${up ? 'gestiegen' : 'gesunken'}"><path class="sa" d="${line} L${w} ${h} L0 ${h} Z"/><path class="sl" d="${line}"/></svg>`;
}

function moneyTile(ctx) {
  const acc = db.list(ctx, 'account'), nw = netWorth(acc);
  if (!acc.length) return tile('money', 'Gesamtvermögen', '#finanzen', 'Finanzen', `<b class="big">–</b><p class="note">Noch kein Konto eingetragen.</p>${newBtn('account', 'Konto hinzufügen', null, 'btn sm')}`);
  const body = `<b class="big">${money(nw.total, 'EUR', true)}</b><span class="sub">${acc.length} ${acc.length === 1 ? 'Konto' : 'Konten'}${nw.skipped.length ? ` · ohne ${esc(nw.skipped.join(', '))} (andere Währung)` : ''}</span>${spark(netWorthSeries(acc))}
  <ul class="mini">${acc.slice(0, 3).map(a => `<li><span class="nm">${esc(a.name)}${srcLine(a.src, a.asOf, ctx, { warnDays: 30 })}</span><b>${money(a.bal, a.cur, true)}</b></li>`).join('')}</ul>`;
  return tile('money', 'Gesamtvermögen', '#finanzen', 'Finanzen', body, acc.length > 3 ? `und ${acc.length - 3} weitere` : '');
}

function monthTile(ctx, t) {
  const r = periodRange('monat', t), cats = db.list(ctx, 'cat'), tx = filterTx(db.list(ctx, 'tx'), { range: r }), m = totals(tx, cats), mon = MONTHS[+t.slice(5, 7) - 1];
  if (!tx.length) return tile('month', mon, '#finanzen', 'Buchungen', '<p class="note">Noch keine Buchungen in diesem Monat.</p>');
  const rows = budgetRows(db.budgets(ctx), tx, cats, r), plan = rows.reduce((a, x) => a + x.plan, 0), used = rows.reduce((a, x) => a + Math.max(0, x.actual), 0);
  const g = plan ? ring(pct(used, plan), { label: 'Budget genutzt', value: `${pct(used, plan)} %`, sub: 'vom Budget' })
    : m.inc ? ring(pct(m.exp, m.inc), { label: 'Ausgegeben', value: `${pct(m.exp, m.inc)} %`, sub: 'der Einnahmen' }) : '';
  const body = `<div class="wsplit">${g}<div class="kvs"><div><span>Einnahmen</span><b>${money(m.inc, 'EUR', true)}</b></div><div><span>Ausgaben</span><b>${money(m.exp, 'EUR', true)}</b></div><div><span>Zurückgelegt</span><b>${money(m.save, 'EUR', true)}</b></div></div></div>${csvNote(ctx, tx)}`;
  return tile('month', mon, '#finanzen', 'Ausgaben', body, `aus ${tx.length} Buchungen${rows.some(x => x.over) ? ` · <span class="warnx">${rows.filter(x => x.over).length} Budget überschritten</span>` : ''}`);
}

function trainTile(ctx) {
  const tr = safe(() => trainingSummary(ctx.store, ctx.now())), rec = safe(() => recoverySummary(ctx));
  const rings = [];
  if (tr) rings.push(tr.type === 'ruhe' ? ring(100, { label: 'Training heute', value: 'Ruhe', sub: 'tag' }) : ring(pct(tr.done, tr.total), { label: 'Sätze heute', value: `${tr.done}/${tr.total}`, sub: 'Sätze' }));
  if (rec && rec.ampel) rings.push(ring(pct(rec.sum, 15), { label: 'Morgen-Check', value: `${rec.sum}/15`, sub: rec.ampel.label }));
  const chips = [tr && tr.type !== 'ruhe' ? `<span class="chip">${esc(tr.name)}</span>` : '', rec ? `<span class="chip${rec.ampel ? '' : ' open'}">Morgen-Check ${rec.ampel ? esc(rec.ampel.label) : 'offen'}</span>` : '', rec && rec.mobility ? `<span class="chip${rec.mobility.done ? '' : ' open'}">Mobility ${rec.mobility.done ? '✓' : 'offen'}</span>` : ''].join('');
  return tile('train', 'Training & Erholung', '#heute', 'Öffnen', `${rings.length ? `<div class="rings">${rings.join('')}</div>` : '<p class="note">Keine Daten.</p>'}<div class="chips">${chips}</div>`, 'aus Training und Recovery auf diesem Gerät');
}

function schoolTile(ctx, t) {
  const exams = db.list(ctx, 'exam'), next = nextExams(exams, t), d = currentDept(db.list(ctx, 'dept'), t), avg = gradeAvg(exams);
  const n = next.length ? daysUntil(t, next[0].d) : null;
  const count = n === null ? '' : `<div class="count">${n <= 1 ? `<b>${inDays(n)}</b>` : `<b>${n}</b><span>Tage</span>`}<small>bis ${esc(next[0].subj)}</small></div>`;
  const list = next.length ? `<ul class="mini">${next.map(e => `<li><span class="nm"><b>${esc(e.subj)}</b><small>${dfmt(e.d)}${e.time ? ' · ' + e.time : ''} · ${esc(label(PREP, e.prep))}</small></span><span class="pill${daysUntil(t, e.d) <= 3 ? ' hot' : ''}">${inDays(daysUntil(t, e.d))}</span></li>`).join('')}</ul>` : '<p class="note">Keine Klassenarbeiten eingetragen.</p>';
  const meta = [d ? `Abteilung ${esc(d.name)}` : 'Keine aktuelle Abteilung', avg ? `Schnitt ${fmtGrade(avg)}` : ''].filter(Boolean).join(' · ');
  return tile('school', 'Ausbildung', '#ausbildung', 'Öffnen', `${count}${list}<p class="note">${meta}</p>`, exams.length ? srcLine(srcOf(exams), latest(exams), ctx, { label: 'aktualisiert' }) : '');
}

function projectsTile(ctx, t) {
  const ps = db.list(ctx, 'project').filter(p => p.status === 'aktiv'), pt = db.list(ctx, 'ptask');
  const step = p => { const o = pt.filter(x => x.proj === p.id && !x.done).sort((a, b) => ((a.due || '9') < (b.due || '9') ? -1 : 1))[0]; return o ? `Nächster Schritt: ${o.text}${o.due ? ` (${o.due < t ? 'überfällig' : dfmt(o.due)})` : ''}` : p.goal ? `Ziel: ${p.goal}` : 'Kein nächster Schritt eingetragen'; };
  const body = ps.length ? `<ul class="plist">${ps.map(p => `<li><a href="#projekte/p-${esc(p.id)}">${ring(p.prog, { label: p.name, value: `${p.prog} %`, sub: 'Fortschritt', small: true })}<span class="tx2"><b>${esc(p.name)}</b><small>${esc(step(p))}</small></span></a></li>`).join('')}</ul>` : '<p class="note">Keine aktiven Projekte.</p>';
  return tile('projects', 'Aktive Projekte', '#projekte', 'Projekte', body, ps.length ? srcLine(srcOf(ps), latest(ps), ctx, { label: 'aktualisiert' }) : '');
}

function logTile(ctx, t) {
  const r = periodRange('monat', t), log = db.list(ctx, 'log'), l = logStats(log, { range: r }), mon = MONTHS[+t.slice(5, 7) - 1];
  const weeks = buckets(r).map(b => ({ label: b.label, long: b.long, v: log.filter(e => inRange(e.d, b)).reduce((a, e) => a + e.min, 0) }));
  const body = `<b class="big">${fmtDur(l.min)}</b><span class="sub">Arbeitsstunden ${mon} · Gewinn ${money(l.profit, 'EUR', true)}</span>${l.n ? pills(weeks, { label: `Stunden je Woche im ${mon}`, fmt: fmtDur }) : '<p class="note">Noch keine Einträge in diesem Monat.</p>'}`;
  return tile('log', 'Business Log', '#business-log', 'Öffnen', body, `${l.n} ${l.n === 1 ? 'Eintrag' : 'Einträge'}${l.n ? ' · ' + srcLine(srcOf(log), latest(log), ctx, { label: 'aktualisiert' }) : ''}`);
}

function agentsTile(ctx) {
  const ags = db.list(ctx, 'agent'), counts = AGENT_STATUS.map(([k, l]) => [k, l, ags.filter(a => a.status === k).length]).filter(x => x[2]);
  const body = ags.length ? `<ul class="stat">${counts.map(([k, l, n]) => `<li class="st-${k}"><i aria-hidden="true"></i><b>${n}</b><span>${esc(l)}</span></li>`).join('')}</ul>
  <ul class="mini">${ags.slice(0, 3).map(a => `<li><span class="nm">${esc(a.name)}${srcLine(a.src, a.asOf, ctx)}</span>${a.status === 'fehlgeschlagen' ? '<span class="pill late">fehlgeschlagen</span>' : `<span class="pill mute">${esc(label(AGENT_STATUS, a.status))}</span>`}</li>`).join('')}</ul>` : '<p class="note">Noch keine Agents eingetragen.</p>';
  return tile('agents', 'KI-Agents', '#agents', 'Öffnen', body, 'nicht verbunden · Status manuell gepflegt');
}

function wissenTile(ctx) {
  const notes = db.list(ctx, 'note');
  if (!notes.length) return tile('wissen', 'Wissen', '#wissen', 'Öffnen', '<p class="note">Noch keine Notizen – schreib die erste oder importiere deinen Obsidian-Vault.</p>');
  // the knowledge as a small turning brain; the whole picture opens the Wissen tab
  const g = graphData(notes, makeResolver(notes, db.getRaw(ctx, 'vatt', []) || [])), n = g.links.length;
  return tile('wissen', 'Wissen', '#wissen', 'Gehirn', `<a class="brainlink" href="#wissen" aria-label="Wissensnetz öffnen: ${notes.length} ${notes.length === 1 ? 'Notiz' : 'Notizen'}, ${n} ${n === 1 ? 'Verbindung' : 'Verbindungen'}">${brainHtml('mini', g, cachedLayout(g), { mini: true })}</a><span class="sub">${notes.length} ${notes.length === 1 ? 'Notiz' : 'Notizen'} · ${n} ${n === 1 ? 'Verbindung' : 'Verbindungen'}</span>`);
}

const greet = h => (h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend');
export function render(route, ctx) {
  const t = today(ctx), now = ctx.now(), items = agenda(ctx, t);
  const emptyAll = !db.isDemo(ctx) && !['account', 'tx', 'exam', 'log', 'note', 'agent', 'dept'].some(n => db.list(ctx, n).length);
  const intro = emptyAll ? `<section class="ccard intro"><b>Life OS ist noch leer.</b><p>Trag Konten, Klassenarbeiten oder Business-Einträge ein – oder sieh dir alles erst mit Beispieldaten an. Deine echten Einträge bleiben davon getrennt.</p><div class="tools"><button class="btn pri" type="button" data-a="demostart">Beispieldaten ansehen</button>${newBtn('account', 'Konto hinzufügen')}</div></section>` : '';
  const dateLine = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `${banner(ctx)}<div class="hero dhead"><div><p class="k">${dateLine}</p><h1>${greet(now.getHours())}</h1><p class="m">${items.length ? `${items.length} ${items.length === 1 ? 'Punkt steht' : 'Punkte stehen'} an.` : 'Heute ist nichts Dringendes offen.'}</p>
  <p class="hudl"><i aria-hidden="true"></i>System bereit · alle Daten lokal · Stand ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}</p></div>
  <button class="btn sm" type="button" data-a="shown" aria-pressed="${amountsShown()}">${amountsShown() ? 'Beträge verbergen' : 'Beträge zeigen'}</button></div>${intro}${formIf(ctx, 'account')}
  <div class="bento">${tile('agenda', 'Jetzt wichtig', '', '', agendaHtml(items))}${moneyTile(ctx)}${monthTile(ctx, t)}${trainTile(ctx)}${schoolTile(ctx, t)}${projectsTile(ctx, t)}${logTile(ctx, t)}${agentsTile(ctx)}${wissenTile(ctx)}</div>
  ${formIf(ctx, 'note')}${knowledgeBox(ctx, { id: 'home' })}`;
}
export function onClick(e, route, ctx) {
  const t = target(e);
  if (t) common(t, ctx);
}
// Forms on this page (first account, a note from the knowledge box) and the box's search.
export function onInput(e, route, ctx) { if (!kbInput(e.target, ctx)) edInput(e.target); }
export function onChange(e) { edInput(e.target); }
export function onNavigate() { onNavigateCommon(); }
export function mount(root) { mountCommon(); if (root) bindBrains(root); }
