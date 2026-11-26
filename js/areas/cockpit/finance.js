// Finanzen: net worth, accounts, transactions with filters, costs, budget, subscriptions, CSV import.
import { esc } from '../../core/html.js';
import { dfmt, dshort } from '../../core/dates.js';
import * as db from './db.js';
import { netWorth, netWorthSeries, filterTx, totals, byCategory, budgetRows, periodRange, PERIODS, subTotals, subMonthly, nextBilling, parseCsv, guessMap, csvToTx, dedupe, parseMoney, fmtMoney, fmtEuro0, addMonths, MONTHS } from './logic.js';
import { ACC_TYPES, EVERY, SUB_STATUS, label } from './data.js';
import { banner, hero, money, signed, srcLine, srcName, bars, empty, newBtn, editBtn, seg, formIf, common, target, today, edInput, onNavigateCommon, mountCommon, blurActive } from './ui.js';
import { lineChart } from '../body/chart.js';
import { bindChart } from '../training/chart.js';

const TABS = [['overview', '', 'Übersicht'], ['accounts', 'konten', 'Konten'], ['tx', 'buchungen', 'Buchungen'], ['costs', 'kosten', 'Kosten'], ['budget', 'budget', 'Budget'], ['subs', 'abos', 'Abos']];
let flt = { acc: '', cat: '', per: 'monat' }, csv = null, csvMsg = '', CH = null;
const tabs = v => `<nav class="csub" aria-label="Finanzen">${TABS.map(([k, p, l]) => `<a href="#finanzen${p ? '/' + p : ''}"${k === v ? ' class="on" aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
const opt = (v, l, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`;
const kv = rows => `<div class="kv2">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;

function overview(ctx, t) {
  const acc = db.list(ctx, 'account'), nw = netWorth(acc), series = netWorthSeries(acc), m = totals(filterTx(db.list(ctx, 'tx'), { range: periodRange('monat', t) }), db.list(ctx, 'cat'));
  CH = null;
  let chart = '';
  if (series.length >= 2) {
    const w = typeof document !== 'undefined' && document.getElementById('main') ? document.getElementById('main').clientWidth : 600;
    const c = lineChart({ pts: series.map(p => ({ date: p.date, y: p.c / 100 })), label: 'Vermögensverlauf', unit: '€', fmt: fmtEuro0, step: 1, width: w });
    CH = c.ch;
    const firsts = acc.filter(a => a.cur === 'EUR').map(a => a.hist[0].d), cut = new Set(firsts).size > 1;
    chart = `<section class="blk"><div class="bh"><h2>Verlauf</h2><p>aus den Kontoständen</p></div><div class="nwchart">${c.html}</div>${cut ? `<p class="note">Ab ${dshort(series[0].date)}: erst seitdem hat jedes Konto einen Stand.</p>` : ''}</section>`;
  }
  const accRows = acc.length ? `<ul class="crows card-l">${acc.map(a => `<li><div class="nm"><b>${esc(a.name)}</b><small>${esc(label(ACC_TYPES, a.type))}</small>${srcLine(a.src, a.asOf, ctx, { warnDays: 30 })}</div><span class="vr">${money(a.bal, a.cur)}</span></li>`).join('')}</ul>`
    : empty('Noch kein Konto. Trag deine Konten mit dem aktuellen Stand ein – das Gesamtvermögen rechnet sich dann von selbst.', '<a class="btn pri" href="#finanzen/konten">Konto anlegen</a>');
  return `<section class="blk"><div class="nwbig"><span class="k">Gesamtvermögen</span><b>${money(nw.total)}</b><span class="note">${acc.length} ${acc.length === 1 ? 'Konto' : 'Konten'}${nw.oldest ? ` · ältester Stand ${dshort(nw.oldest)}` : ''}${nw.skipped.length ? ` · ohne ${esc(nw.skipped.join(', '))} (andere Währung)` : ''}</span></div></section>
  ${chart}
  <section class="blk"><div class="bh"><h2>Konten</h2><p><a href="#finanzen/konten">Bearbeiten ›</a></p></div>${accRows}</section>
  <section class="blk"><div class="bh"><h2>${MONTHS[+t.slice(5, 7) - 1]}</h2><p><a href="#finanzen/kosten">Kosten ›</a></p></div>${kv([['Einnahmen', money(m.inc)], ['Ausgaben', money(m.exp)], ['Zurückgelegt', money(m.save)]])}<p class="note">Kontostände kommen aus deinen Einträgen, Einnahmen und Ausgaben aus den Buchungen.</p></section>`;
}

function accounts(ctx) {
  const acc = db.list(ctx, 'account');
  return `<section class="blk"><div class="bh"><h2>Konten</h2></div>${formIf(ctx, 'account')}
  <p class="note">Einen neuen Kontostand trägst du über „Bearbeiten“ ein: Betrag und „Stand vom“ ändern. Jeder Stand bleibt im Verlauf.</p>
  ${acc.length ? `<ul class="crows card-l">${acc.map(a => `<li><div class="nm"><b>${esc(a.name)}</b><small>${esc(label(ACC_TYPES, a.type))} · ${a.hist.length} ${a.hist.length === 1 ? 'Stand' : 'Stände'}</small>${srcLine(a.src, a.asOf, ctx, { warnDays: 30 })}</div><span class="vr">${money(a.bal, a.cur)}</span>${editBtn('account', a.id)}</li>`).join('')}</ul>` : ''}
  <div class="tools">${newBtn('account', 'Konto')}</div></section>`;
}

function filters(ctx, withCat = true) {
  const acc = db.list(ctx, 'account'), cats = db.list(ctx, 'cat');
  return `<div class="cflt">
  <label class="dsel">Konto<select data-a="flt" data-k="acc">${opt('', 'Alle', flt.acc)}${acc.map(a => opt(a.id, a.name, flt.acc)).join('')}</select></label>
  ${withCat ? `<label class="dsel">Kategorie<select data-a="flt" data-k="cat">${opt('', 'Alle', flt.cat)}${cats.map(c => opt(c.id, c.name, flt.cat)).join('')}</select></label>` : ''}
  <label class="dsel">Zeitraum<select data-a="flt" data-k="per">${PERIODS.map(([v, l]) => opt(v, l, flt.per)).join('')}</select></label></div>`;
}

function csvBox(ctx) {
  const msg = csvMsg ? `<p class="note ok" role="status">${esc(csvMsg)}</p>` : '';
  if (!csv) return `<section class="blk"><div class="bh"><h2>CSV-Import</h2><p>aus dem Online-Banking</p></div><div class="ex">
  <p>Exportiere die Umsätze im Online-Banking als CSV-Datei und wähle sie hier aus. Die Datei wird nur auf diesem Gerät gelesen. Importierte Buchungen sind so aktuell wie die Datei.</p>
  <div class="tools"><label class="btn" for="csvf">CSV-Datei wählen<input id="csvf" type="file" accept=".csv,text/csv,text/plain" hidden></label></div>${msg}</div></section>`;
  if (csv.error) return `<section class="blk"><div class="bh"><h2>CSV-Import</h2></div><div class="ex"><p class="err">${esc(csv.error)}</p><div class="tools"><button class="btn" type="button" data-a="csvx">Andere Datei</button></div></div></section>`;
  const head = csv.rows[0], acc = db.list(ctx, 'account');
  const colSel = (k, l) => `<label class="dsel">${l}<select data-a="csvmap" data-k="${k}">${opt('-1', '—', String(csv.map[k]))}${head.map((h, i) => opt(String(i), h || `Spalte ${i + 1}`, String(csv.map[k]))).join('')}</select></label>`;
  const prev = csvToTx(csv.rows.slice(1, 4), csv.map, csv.acc).tx;
  return `<section class="blk"><div class="bh"><h2>CSV-Import</h2><p>${esc(csv.file)} · ${csv.rows.length - 1} Zeilen</p></div><div class="ex">
  <p class="note">Spalten prüfen – erkannt wurde, was nach Datum, Betrag, Empfänger und Verwendungszweck aussieht.</p>
  <div class="cflt">${colSel('date', 'Datum')}${colSel('amount', 'Betrag')}${colSel('payee', 'Empfänger')}${colSel('purpose', 'Zweck')}</div>
  <div class="cflt"><label class="dsel">In Konto<select data-a="csvacc">${opt('', 'Konto wählen', csv.acc)}${acc.map(a => opt(a.id, a.name, csv.acc)).join('')}</select></label></div>
  ${prev.length ? `<ul class="crows">${prev.map(x => `<li><div class="nm"><b>${esc(x.payee || x.note || '—')}</b><small>${dfmt(x.d)}</small></div><span class="vr">${signed(x.amt)}</span></li>`).join('')}</ul>` : '<p class="err">Mit dieser Zuordnung ist keine Zeile lesbar.</p>'}
  ${csv.msg ? `<p class="err" role="alert">${esc(csv.msg)}</p>` : ''}
  <div class="tools"><button class="btn pri" type="button" data-a="csvgo">Importieren</button><button class="btn" type="button" data-a="csvx">Abbrechen</button></div></div></section>`;
}

function txView(ctx, t) {
  const r = periodRange(flt.per, t), all = db.list(ctx, 'tx'), cats = db.list(ctx, 'cat'), acc = db.list(ctx, 'account');
  const tx = filterTx(all, { acc: flt.acc, cat: flt.cat, range: r }).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)), m = totals(tx, cats);
  const cn = id => (cats.find(c => c.id === id) || { name: 'Ohne Kategorie' }).name, an = id => (acc.find(a => a.id === id) || { name: 'Konto gelöscht' }).name;
  const list = tx.length ? `<ul class="crows card-l">${tx.map(x => `<li><div class="nm"><b>${esc(x.payee || x.note || '—')}</b><small>${dfmt(x.d)} · ${esc(cn(x.cat))} · ${esc(an(x.acc))}${x.src !== 'manuell' ? ' · ' + esc(srcName(x.src)) : ''}</small></div><span class="vr${x.amt > 0 ? ' pos' : ''}">${signed(x.amt)}</span>${editBtn('tx', x.id)}</li>`).join('')}</ul>`
    : empty(all.length ? 'Keine Buchungen für diese Auswahl.' : 'Noch keine Buchungen. Trag sie einzeln ein oder importiere eine CSV-Datei aus dem Online-Banking.');
  return `<section class="blk"><div class="bh"><h2>Buchungen</h2><p>${esc(r.label)}</p></div>${filters(ctx)}
  ${kv([['Einnahmen', money(m.inc)], ['Ausgaben', money(m.exp)], ['Zurückgelegt', money(m.save)]])}
  ${formIf(ctx, 'tx')}<div class="tools">${acc.length ? newBtn('tx', 'Buchung', flt.acc ? { acc: flt.acc } : null) : '<a class="btn" href="#finanzen/konten">Zuerst ein Konto anlegen</a>'}</div>
  ${list}</section>${csvBox(ctx)}`;
}

function costs(ctx, t) {
  const r = periodRange(flt.per, t), cats = db.list(ctx, 'cat'), all = filterTx(db.list(ctx, 'tx'), { acc: flt.acc });
  const rows = byCategory(filterTx(all, { range: r }), cats), sum = rows.reduce((s, x) => s + x.c, 0);
  const months = [5, 4, 3, 2, 1, 0].map(i => { const first = addMonths(t.slice(0, 8) + '01', -i), rr = periodRange('monat', first); return { name: `${MONTHS[+first.slice(5, 7) - 1].slice(0, 3)} ${first.slice(2, 4)}`, c: totals(filterTx(all, { range: rr }), cats).exp }; });
  return `<section class="blk"><div class="bh"><h2>Kosten nach Kategorie</h2><p>${esc(r.label)}</p></div>${filters(ctx, false)}
  ${rows.length ? `<p class="sum">Ausgaben gesamt <b>${fmtMoney(sum)}</b></p>${bars(rows, c => fmtMoney(c))}` : empty('Keine Ausgaben in diesem Zeitraum.')}
  <p class="note">Sparen und Überträge zählen nicht als Ausgabe, sondern als „Zurückgelegt“.</p></section>
  <section class="blk"><div class="bh"><h2>Ausgaben pro Monat</h2><p>letzte 6 Monate</p></div>${months.some(x => x.c > 0) ? bars(months, c => fmtMoney(c)) : empty('Noch keine Ausgaben erfasst.')}</section>`;
}

function budget(ctx, t) {
  const r = periodRange('monat', t), cats = db.list(ctx, 'cat').filter(c => c.kind !== 'einnahme'), b = db.budgets(ctx), tx = db.list(ctx, 'tx');
  const rows = budgetRows(b, tx, cats, r), plan = rows.reduce((s, x) => s + x.plan, 0), act = rows.reduce((s, x) => s + x.actual, 0);
  const inputs = cats.map(c => { const row = rows.find(x => x.cat === c.id); return `<li class="bud${row && row.over ? ' over' : ''}"><div class="nm"><b>${esc(c.name)}</b>${row ? `<small>${fmtMoney(row.actual)} von ${fmtMoney(row.plan)} · ${row.over ? `<span class="err">${fmtMoney(-row.rest)} drüber</span>` : `${fmtMoney(row.rest)} übrig`}</small><span class="bbar" role="img" aria-label="${Math.round(row.actual / row.plan * 100)} Prozent verbraucht"><i style="width:${Math.min(100, row.actual / row.plan * 100).toFixed(1)}%"></i></span>` : '<small>kein Budget</small>'}</div>
  <label class="gin">€<input data-a="bud" data-cat="${esc(c.id)}" inputmode="decimal" value="${b[c.id] ? (b[c.id] / 100).toFixed(2).replace('.', ',') : ''}" placeholder="0" aria-label="Budget ${esc(c.name)} pro Monat"></label></li>`; }).join('');
  return `<section class="blk"><div class="bh"><h2>Budget ${esc(r.label)}</h2><p>geplant gegen ausgegeben</p></div>
  ${rows.length ? kv([['Geplant', fmtMoney(plan)], ['Ausgegeben', fmtMoney(act)], [plan - act >= 0 ? 'Übrig' : 'Drüber', fmtMoney(Math.abs(plan - act))]]) : ''}
  <p class="note">Trag pro Kategorie ein, wie viel du im Monat ausgeben oder zurücklegen willst. Leer lassen = kein Budget.</p>
  <ul class="crows card-l">${inputs}</ul></section>`;
}

function subs(ctx, t) {
  const all = db.list(ctx, 'sub'), tot = subTotals(all), cats = db.list(ctx, 'cat');
  const order = { aktiv: 0, pausiert: 1, gekuendigt: 2 }, list = [...all].sort((a, b) => order[a.status] - order[b.status] || (nextBilling(a, t) < nextBilling(b, t) ? -1 : 1));
  const cn = id => (cats.find(c => c.id === id) || { name: '' }).name;
  return `<section class="blk"><div class="bh"><h2>Abonnements</h2><p>${tot.active} aktiv</p></div>
  <div class="stats s3"><div><b>${fmtMoney(tot.month)}</b><span>pro Monat</span></div><div><b>${fmtMoney(tot.year)}</b><span>pro Jahr</span></div><div><b>${tot.active}</b><span>aktiv</span></div></div>
  ${tot.other ? `<p class="note">${tot.other} aktive ${tot.other === 1 ? 'Abo' : 'Abos'} in anderer Währung nicht eingerechnet.</p>` : ''}
  ${formIf(ctx, 'sub')}<div class="tools">${newBtn('sub', 'Abo')}</div>
  ${list.length ? `<ul class="crows card-l">${list.map(s => `<li class="${s.status !== 'aktiv' ? 'off' : ''}"><div class="nm"><b>${esc(s.name)}</b><small>${fmtMoney(s.amt, s.cur)} ${esc(label(EVERY, s.every))}${s.every !== 'monat' && s.cur === 'EUR' ? ` · ${fmtMoney(subMonthly(s))}/Monat` : ''}${s.pay ? ' · ' + esc(s.pay) : ''}${cn(s.cat) ? ' · ' + esc(cn(s.cat)) : ''}</small>${srcLine(s.src, s.upd, ctx, { label: 'aktualisiert' })}</div><div class="vr"><span class="pill${s.status === 'aktiv' ? '' : ' mute'}">${esc(label(SUB_STATUS, s.status))}</span>${s.status === 'aktiv' ? `<small>nächste ${dfmt(nextBilling(s, t))}</small>` : ''}</div>${editBtn('sub', s.id)}</li>`).join('')}</ul>`
    : empty('Noch keine Abos. Trag Dienste ein, die regelmäßig abbuchen – Monats- und Jahressumme rechnen sich dann von selbst. Erkannt wird nichts automatisch.')}</section>`;
}

const VIEWS = { overview, accounts, tx: txView, costs, budget, subs };
export function render(route, ctx) {
  const v = VIEWS[route.view] ? route.view : 'overview';
  return `${banner(ctx)}${hero('Finanzen', TABS.find(x => x[0] === v)[2])}${tabs(v)}${VIEWS[v](ctx, today(ctx))}`;
}
export const redrawOnResize = route => route.view === 'overview';
export function mount(root) { mountCommon(); if (CH && root) bindChart(root.querySelector('.nwchart') || root, CH); }
// Filters hold while moving between the Finanzen tabs and reset on leaving.
export function onNavigate(next) {
  onNavigateCommon();
  csv = null;
  csvMsg = '';
  if (!next || next.area !== 'finance') flt = { acc: '', cat: '', per: 'monat' };
}

export function csvLoad(ctx, text, file) {
  csvMsg = '';
  const rows = parseCsv(text);
  if (rows.length < 2 || rows[0].length < 2) { csv = { file, error: 'Keine Buchungen erkannt. Ist das eine CSV-Datei mit Kopfzeile aus dem Online-Banking?' }; return; }
  csv = { file, rows, map: guessMap(rows[0]), acc: flt.acc || '', msg: '' };
}
function csvImport(ctx) {
  if (!csv.acc) { csv.msg = 'Konto wählen, in das die Buchungen sollen.'; return; }
  const { tx, bad } = csvToTx(csv.rows.slice(1), csv.map, csv.acc);
  if (!tx.length) { csv.msg = 'Keine Zeile lesbar – Spalten für Datum und Betrag prüfen.'; return; }
  const all = db.list(ctx, 'tx'), { add, dup } = dedupe(all, tx);
  db.setRaw(ctx, 'tx', [...all, ...add]);
  db.upsert(ctx, 'import', { kind: 'csv', file: csv.file.slice(0, 120), at: today(ctx), n: add.length, acc: csv.acc });
  csvMsg = `Import fertig: ${add.length} neu · ${dup} schon vorhanden${bad ? ` · ${bad} Zeilen unlesbar` : ''}. Neue Buchungen haben noch keine Kategorie.`;
  csv = null;
}

export function onClick(e, route, ctx) {
  const t = target(e);
  if (!t || common(t, ctx)) return;
  const a = t.dataset.a;
  if (a === 'csvgo' && csv && !csv.error) csvImport(ctx);
  else if (a === 'csvx') { csv = null; csvMsg = ''; }
  else return;
  blurActive();
  ctx.rerender();
}
export function onInput(e) { edInput(e.target); }
export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (edInput(t)) return undefined;
  if (a === 'flt') { flt[t.dataset.k] = t.value; return ctx.rerender(); }
  if (a === 'bud') {
    const v = String(t.value).trim(), c = v ? parseMoney(v) : null;
    if (v && (c == null || c < 0)) { ctx.toast('Budget nicht gespeichert', 'Betrag wie 250 oder 99,50 eingeben'); return undefined; }
    db.setBudget(ctx, t.dataset.cat, c);
    return ctx.rerender();
  }
  if (a === 'csvmap' && csv) { csv.map[t.dataset.k] = +t.value; return ctx.rerender(); }
  if (a === 'csvacc' && csv) { csv.acc = t.value; csv.msg = ''; return ctx.rerender(); }
  if (t.id === 'csvf' && t.files && t.files[0]) {
    const f = t.files[0];
    return f.text().then(txt => { csvLoad(ctx, txt, f.name); ctx.rerender(); }, () => { csv = { file: f.name, error: 'Die Datei konnte nicht gelesen werden.' }; ctx.rerender(); });
  }
  return undefined;
}
