// Finanzen: overview (figures, money flow, accounts, net worth), transactions with
// filters and CSV import, spending with budget, subscriptions.
import { esc } from '../../core/html.js';
import { dfmt, dshort } from '../../core/dates.js';
import * as db from './db.js';
import { netWorth, netWorthSeries, filterTx, totals, byCategory, budgetRows, periodRange, subTotals, subMonthly, nextBilling, parseCsv, guessMap, findHeader, csvToTx, dedupe, parseMoney, fmtMoney, fmtEuro0, MONTHS, buckets, flowSeries } from './logic.js';
import { ACC_TYPES, EVERY, SUB_STATUS, label } from './data.js';
import { banner, hero, money, signed, srcLine, srcName, bars, empty, newBtn, editBtn, formIf, common, target, today, edInput, onNavigateCommon, mountCommon, blurActive, csvNote, DEMO_NO_IMPORT } from './ui.js';
import { barChart, bindBars, periodPicker, rangeOf, chartState, chartClick, chartChange, resetCharts } from './charts.js';
import { STORAGE_FAILED } from '../../core/backup.js';
import { knowledgeBox, kbInput } from './knowledge.js';
import { lineChart } from '../body/chart.js';
import { bindChart } from '../training/chart.js';

const TABS = [['overview', '', 'Übersicht'], ['tx', 'buchungen', 'Buchungen'], ['costs', 'ausgaben', 'Ausgaben & Budget'], ['subs', 'abos', 'Abos']];
const ORIENT = {
  overview: 'Vermögen, Konten und wie sich Einnahmen und Ausgaben entwickeln.',
  tx: 'Alle Buchungen: filtern, eintragen oder aus dem Online-Banking importieren.',
  costs: 'Wofür das Geld weggeht und wie viel vom Monatsbudget übrig ist.',
  subs: 'Laufende Abos mit Kosten pro Monat und Jahr.',
};
const CHARTS = ['flow', 'tx', 'costs'];
let flt = { acc: '', cat: '' }, csv = null, csvMsg = '', CH = null, BARS = {}, budEdit = false;
const tabs = v => `<nav class="csub" aria-label="Finanzen">${TABS.map(([k, p, l]) => `<a href="#finanzen${p ? '/' + p : ''}"${k === v ? ' class="on" aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</nav>`;
const opt = (v, l, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`;
const kv = rows => `<div class="kv2">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
const width = () => (typeof document !== 'undefined' && document.getElementById('main') ? document.getElementById('main').clientWidth : 600);
const addTx = ctx => (db.list(ctx, 'account').length
  ? `${newBtn('tx', 'Ausgabe hinzufügen', { dir: 'aus', ...(flt.acc ? { acc: flt.acc } : {}) }, 'btn pri')}${newBtn('tx', 'Einnahme hinzufügen', { dir: 'ein', ...(flt.acc ? { acc: flt.acc } : {}) })}`
  : newBtn('account', 'Zuerst ein Konto hinzufügen', null, 'btn pri'));

function flowChart(ctx, t) {
  const r = rangeOf('flow', t), bks = buckets(r), all = db.list(ctx, 'tx'), f = flowSeries(all, db.list(ctx, 'cat'), bks), inR = filterTx(all, { range: r });
  const c = barChart({
    id: 'flow', q: 'Wie entwickeln sich Einnahmen, Ausgaben und Zurückgelegtes?', qs: `${esc(r.label)} · aus ${inR.length} Buchungen`,
    buckets: bks, hidden: chartState('flow').hidden, fmt: v => fmtMoney(v), axisFmt: v => fmtEuro0(v / 100), div: 100, width: width(),
    series: [{ key: 'inc', name: 'Einnahmen', cls: 's1', values: f.inc }, { key: 'exp', name: 'Ausgaben', cls: 's2', values: f.exp }, { key: 'save', name: 'Zurückgelegt', cls: 's3', values: f.save }],
    missing: f.n.map(n => n === 0),
    foot: `${f.n.some(n => n === 0) && inR.length ? '<p class="note miss">„–“ = keine Buchungen in diesem Abschnitt.</p>' : ''}${csvNote(ctx, inR)}`,
  });
  if (c.data) BARS.flow = c.data;
  return `<section class="blk">${periodPicker('flow', t)}${c.html}</section>`;
}

function overview(ctx, t) {
  const acc = db.list(ctx, 'account'), nw = netWorth(acc), series = netWorthSeries(acc), mtx = filterTx(db.list(ctx, 'tx'), { range: periodRange('monat', t) }), m = totals(mtx, db.list(ctx, 'cat'));
  CH = null;
  let chart = '';
  if (series.length >= 2) {
    const c = lineChart({ pts: series.map(p => ({ date: p.date, y: p.c / 100 })), label: 'Vermögensverlauf', unit: '€', fmt: fmtEuro0, step: 1, width: width() });
    CH = c.ch;
    const firsts = acc.filter(a => a.cur === 'EUR').map(a => a.hist[0].d), cut = new Set(firsts).size > 1;
    chart = `<section class="blk"><div class="bh"><h2>Vermögensverlauf</h2><p>aus deinen Kontoständen</p></div><div class="nwchart">${c.html}</div>
    ${cut ? `<p class="note">Ab ${dshort(series[0].date)}: erst seitdem hat jedes Konto einen Stand.</p>` : ''}
    <details class="tbld"><summary>Werte als Tabelle</summary><div class="tblw"><table class="tbl"><thead><tr><th>Datum</th><th>Vermögen</th></tr></thead><tbody>${series.map(p => `<tr><td>${dfmt(p.date)}</td><td>${fmtMoney(p.c)}</td></tr>`).join('')}</tbody></table></div></details></section>`;
  }
  const accRows = acc.length ? `<ul class="crows card-l">${acc.map(a => `<li><div class="nm"><b>${esc(a.name)}</b><small>${esc(label(ACC_TYPES, a.type))}</small>${srcLine(a.src, a.asOf, ctx, { warnDays: 30 })}</div><span class="vr">${money(a.bal, a.cur)}</span>${editBtn('account', a.id, 'Stand ändern')}</li>`).join('')}</ul>`
    : empty('Noch kein Konto. Trag deine Konten mit dem aktuellen Stand ein – das Gesamtvermögen rechnet sich dann von selbst.');
  return `<div class="figs">
    <div class="fig"><span class="k">Gesamtvermögen</span><b>${money(nw.total)}</b><span class="sub">${acc.length} ${acc.length === 1 ? 'Konto' : 'Konten'}${nw.oldest ? ` · ältester Stand ${dshort(nw.oldest)}` : ''}${nw.skipped.length ? ` · ohne ${esc(nw.skipped.join(', '))} (andere Währung)` : ''}</span></div>
    <div class="fig"><span class="k">${MONTHS[+t.slice(5, 7) - 1]}: Einnahmen</span><b>${money(m.inc)}</b><span class="sub">aus ${mtx.length} Buchungen</span></div>
    <div class="fig"><span class="k">${MONTHS[+t.slice(5, 7) - 1]}: Ausgaben</span><b>${money(m.exp)}</b><span class="sub">Zurückgelegt ${money(m.save)}</span></div>
  </div>${csvNote(ctx, mtx)}
  ${flowChart(ctx, t)}
  <section class="blk"><div class="bh"><h2>Konten</h2><p>Stand = zuletzt eingetragener Kontostand</p></div>${formIf(ctx, 'account')}${formIf(ctx, 'tx')}
  ${accRows}<div class="tools">${newBtn('account', 'Konto hinzufügen')}</div>
  <p class="note">Neuen Kontostand eintragen: „Stand ändern“, Betrag und Datum anpassen. Jeder Stand bleibt im Verlauf.</p></section>
  ${chart}${formIf(ctx, 'note')}${knowledgeBox(ctx, {
    id: 'fin', about: 'Finanzen', mode: 'any', q: 'finanzen geld budget sparen sparziel konto abo ausgaben einnahmen versicherung steuer vertrag',
    prefer: db.list(ctx, 'note').filter(n => n.topic === 'finanzen').map(n => n.id), preset: { topic: 'finanzen' },
  })}`;
}

function filters(ctx) {
  const acc = db.list(ctx, 'account'), cats = db.list(ctx, 'cat');
  return `<div class="cflt">
  <label class="dsel">Konto<select data-a="flt" data-k="acc">${opt('', 'Alle', flt.acc)}${acc.map(a => opt(a.id, a.name, flt.acc)).join('')}</select></label>
  <label class="dsel">Kategorie<select data-a="flt" data-k="cat">${opt('', 'Alle', flt.cat)}${cats.map(c => opt(c.id, c.name, flt.cat)).join('')}</select></label></div>`;
}

function csvBox(ctx) {
  const msg = csvMsg ? `<p class="note ok" role="status">${esc(csvMsg)}</p>` : '';
  if (db.isDemo(ctx)) return `<section class="blk" id="csv"><div class="bh"><h2>CSV-Import</h2></div><div class="ex"><p class="note">${DEMO_NO_IMPORT}</p></div></section>`;
  if (!csv) return `<section class="blk" id="csv"><div class="bh"><h2>CSV-Import</h2><p>aus dem Online-Banking</p></div><div class="ex">
  <p>Exportiere die Umsätze im Online-Banking als CSV-Datei und wähle sie hier aus. Die Datei wird nur auf diesem Gerät gelesen. Importierte Buchungen sind so aktuell wie die Datei.</p>
  <div class="tools"><label class="btn" for="csvf">CSV-Datei wählen<input id="csvf" type="file" accept=".csv,text/csv,text/plain" hidden></label></div>${msg}</div></section>`;
  if (csv.error) return `<section class="blk" id="csv"><div class="bh"><h2>CSV-Import</h2></div><div class="ex"><p class="err">${esc(csv.error)}</p><div class="tools"><button class="btn" type="button" data-a="csvx">Andere Datei wählen</button></div></div></section>`;
  const head = csv.rows[0], acc = db.list(ctx, 'account'), n = csv.rows.length - 1;
  const colSel = (k, l) => `<label class="dsel">${l}<select data-a="csvmap" data-k="${k}">${opt('-1', '—', String(csv.map[k]))}${head.map((h, i) => opt(String(i), h || `Spalte ${i + 1}`, String(csv.map[k]))).join('')}</select></label>`;
  const prev = csvToTx(csv.rows.slice(1, 4), csv.map, csv.acc).tx;
  return `<section class="blk" id="csv"><div class="bh"><h2>CSV-Import</h2><p>${esc(csv.file)} · ${n} ${n === 1 ? 'Zeile' : 'Zeilen'}</p></div><div class="ex">
  <p class="note">Spalten prüfen – erkannt wurde, was nach Datum, Betrag, Empfänger und Verwendungszweck aussieht.</p>
  <div class="cflt">${colSel('date', 'Datum')}${colSel('amount', 'Betrag')}${colSel('payee', 'Empfänger')}${colSel('purpose', 'Zweck')}</div>
  <div class="cflt"><label class="dsel">In Konto<select data-a="csvacc">${opt('', 'Konto wählen', csv.acc)}${acc.map(a => opt(a.id, a.name, csv.acc)).join('')}</select></label></div>
  ${prev.length ? `<p class="fl note">Vorschau</p><ul class="crows">${prev.map(x => `<li><div class="nm"><b>${esc(x.payee || x.note || '—')}</b><small>${dfmt(x.d)}</small></div><span class="vr">${signed(x.amt)}</span></li>`).join('')}</ul>` : '<p class="err">Mit dieser Zuordnung ist keine Zeile lesbar.</p>'}
  ${csv.msg ? `<p class="err" role="alert">${esc(csv.msg)}</p>` : ''}
  <div class="tools"><button class="btn pri" type="button" data-a="csvgo">${n} ${n === 1 ? 'Buchung' : 'Buchungen'} importieren</button><button class="btn" type="button" data-a="csvx">Abbrechen</button></div></div></section>`;
}

function txView(ctx, t) {
  const r = rangeOf('tx', t), all = db.list(ctx, 'tx'), cats = db.list(ctx, 'cat'), acc = db.list(ctx, 'account');
  const tx = filterTx(all, { acc: flt.acc, cat: flt.cat, range: r }).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)), m = totals(tx, cats);
  const cn = id => (cats.find(c => c.id === id) || { name: 'Ohne Kategorie' }).name, an = id => (acc.find(a => a.id === id) || { name: 'Konto gelöscht' }).name;
  const list = tx.length ? `<ul class="crows card-l">${tx.map(x => `<li><div class="nm"><b>${esc(x.payee || x.note || '—')}</b><small>${dfmt(x.d)} · ${esc(cn(x.cat))} · ${esc(an(x.acc))}${x.src !== 'manuell' ? ' · ' + esc(srcName(x.src)) : ''}</small></div><span class="vr${x.amt > 0 ? ' pos' : ''}">${signed(x.amt)}</span>${editBtn('tx', x.id)}</li>`).join('')}</ul>`
    : empty(all.length ? 'Keine Buchungen für diese Auswahl.' : 'Noch keine Buchungen. Trag sie einzeln ein oder importiere eine CSV-Datei aus dem Online-Banking.');
  return `<section class="blk">${periodPicker('tx', t)}${filters(ctx)}
  ${kv([['Einnahmen', money(m.inc)], ['Ausgaben', money(m.exp)], ['Zurückgelegt', money(m.save)]])}${csvNote(ctx, tx)}
  ${formIf(ctx, 'account')}${formIf(ctx, 'tx')}${list}</section>${csvBox(ctx)}`;
}

function costs(ctx, t) {
  const r = rangeOf('costs', t), cats = db.list(ctx, 'cat'), all = db.list(ctx, 'tx'), inR = filterTx(all, { range: r });
  const rows = byCategory(inR, cats), sum = rows.reduce((s, x) => s + x.c, 0), month = chartState('costs').per === 'monat';
  const b = db.budgets(ctx), brows = budgetRows(b, all, cats.filter(c => c.kind !== 'einnahme'), r);
  const plan = brows.reduce((s, x) => s + x.plan, 0), act = brows.reduce((s, x) => s + x.actual, 0);
  const budget = month ? `<section class="blk"><div class="bh"><h2>Budget ${esc(r.label)}</h2><p>geplant gegen ausgegeben</p></div>
    ${brows.length ? kv([['Geplant', fmtMoney(plan)], ['Ausgegeben', fmtMoney(act)], [plan - act >= 0 ? 'Übrig' : 'Drüber', fmtMoney(Math.abs(plan - act))]]) : ''}
    <ul class="crows card-l">${cats.filter(c => c.kind !== 'einnahme' && (budEdit || b[c.id])).map(c => { const row = brows.find(x => x.cat === c.id); return `<li class="bud${row && row.over ? ' over' : ''}"><div class="nm"><b>${esc(c.name)}</b>${row ? `<small>${fmtMoney(row.actual)} von ${fmtMoney(row.plan)} · ${row.over ? `<span class="err">${fmtMoney(-row.rest)} drüber</span>` : `${fmtMoney(row.rest)} übrig`}</small><span class="bbar" role="img" aria-label="${Math.round(row.actual / row.plan * 100)} Prozent verbraucht"><i style="width:${Math.min(100, row.actual / row.plan * 100).toFixed(1)}%"></i></span>` : '<small>kein Budget</small>'}</div>
    ${budEdit ? `<label class="gin">€<input data-a="bud" data-cat="${esc(c.id)}" inputmode="decimal" value="${b[c.id] ? (b[c.id] / 100).toFixed(2).replace('.', ',') : ''}" placeholder="0" aria-label="Budget ${esc(c.name)} pro Monat"></label>` : ''}</li>`; }).join('') || '<li><div class="nm"><small>Noch keine Budgets. Mit „Budgets festlegen“ trägst du pro Kategorie einen Monatsbetrag ein.</small></div></li>'}</ul>
    <div class="tools"><button class="btn" type="button" data-a="budedit" aria-pressed="${budEdit}">${budEdit ? 'Fertig' : 'Budgets festlegen'}</button></div>
    ${budEdit ? '<p class="note">Betrag pro Monat eintragen, leer lassen = kein Budget. Gespeichert wird beim Verlassen des Feldes.</p>' : ''}</section>`
    : '<p class="note">Budgets gelten pro Monat – für den Vergleich mit dem Budget oben „Monat“ wählen.</p>';
  return `<section class="blk">${periodPicker('costs', t)}<div class="bh"><h2>Ausgaben nach Kategorie</h2><p>${esc(r.label)}</p></div>
  ${rows.length ? `<p class="sum">Ausgaben gesamt <b>${fmtMoney(sum)}</b></p>${bars(rows, c => fmtMoney(c))}` : empty('Keine Ausgaben in diesem Zeitraum.')}${csvNote(ctx, inR)}
  <p class="note">Sparen und Überträge zählen nicht als Ausgabe, sondern als „Zurückgelegt“.</p></section>${budget}`;
}

function subs(ctx, t) {
  const all = db.list(ctx, 'sub'), tot = subTotals(all), cats = db.list(ctx, 'cat');
  const order = { aktiv: 0, pausiert: 1, gekuendigt: 2 }, list = [...all].sort((a, b) => order[a.status] - order[b.status] || (nextBilling(a, t) < nextBilling(b, t) ? -1 : 1));
  const cn = id => (cats.find(c => c.id === id) || { name: '' }).name;
  return `<section class="blk"><div class="stats s3"><div><b>${fmtMoney(tot.month)}</b><span>pro Monat</span></div><div><b>${fmtMoney(tot.year)}</b><span>pro Jahr</span></div><div><b>${tot.active}</b><span>aktiv</span></div></div>
  ${tot.other ? `<p class="note">${tot.other} aktive ${tot.other === 1 ? 'Abo' : 'Abos'} in anderer Währung nicht eingerechnet.</p>` : ''}
  ${formIf(ctx, 'sub')}
  ${list.length ? `<ul class="crows card-l">${list.map(s => `<li class="${s.status !== 'aktiv' ? 'off' : ''}"><div class="nm"><b>${esc(s.name)}</b><small>${fmtMoney(s.amt, s.cur)} ${esc(label(EVERY, s.every))}${s.every !== 'monat' && s.cur === 'EUR' ? ` · ${fmtMoney(subMonthly(s))}/Monat` : ''}${s.pay ? ' · ' + esc(s.pay) : ''}${cn(s.cat) ? ' · ' + esc(cn(s.cat)) : ''}</small>${srcLine(s.src, s.upd, ctx, { label: 'aktualisiert' })}</div><div class="vr"><span class="pill${s.status === 'aktiv' ? '' : ' mute'}">${esc(label(SUB_STATUS, s.status))}</span>${s.status === 'aktiv' ? `<small>nächste ${dfmt(nextBilling(s, t))}</small>` : ''}</div>${editBtn('sub', s.id)}</li>`).join('')}</ul>`
    : empty('Noch keine Abos. Trag Dienste ein, die regelmäßig abbuchen – Monats- und Jahressumme rechnen sich dann von selbst. Erkannt wird nichts automatisch.')}</section>`;
}

const VIEWS = { overview, tx: txView, costs, subs };
const ALIAS = { accounts: 'overview', budget: 'costs' };
const ACTIONS = {
  overview: ctx => addTx(ctx),
  tx: ctx => `${addTx(ctx)}${db.isDemo(ctx) ? '' : '<button class="btn" type="button" data-a="tocsv">CSV importieren</button>'}`,
  costs: () => '',
  subs: () => newBtn('sub', 'Abo hinzufügen', null, 'btn pri'),
};
export function render(route, ctx) {
  const v = VIEWS[route.view] ? route.view : ALIAS[route.view] || 'overview', t = today(ctx);
  BARS = {};
  const acts = ACTIONS[v](ctx);
  return `${banner(ctx)}${hero('', 'Finanzen', ORIENT[v])}${acts ? `<div class="pact">${acts}</div>` : ''}${tabs(v)}${VIEWS[v](ctx, t)}`;
}
export const redrawOnResize = route => route.view === 'overview' || !route.view;
export function mount(root) {
  mountCommon();
  if (CH && root) bindChart(root.querySelector('.nwchart') || root, CH);
  bindBars(root, BARS);
}
// Filters and charts hold while moving between the Finanzen tabs and reset on leaving.
export function onNavigate(next) {
  onNavigateCommon();
  csv = null;
  csvMsg = '';
  if (!next || next.area !== 'finance') { flt = { acc: '', cat: '' }; budEdit = false; resetCharts(CHARTS); chartState('flow', { per: 'jahr' }); }
}

export function csvLoad(ctx, text, file) {
  csvMsg = '';
  if (db.isDemo(ctx)) { csv = null; return; }
  const all = parseCsv(text), rows = all.slice(findHeader(all));
  if (rows.length < 2 || rows[0].length < 2) { csv = { file, error: 'Keine Buchungen erkannt. Ist das eine CSV-Datei mit Kopfzeile aus dem Online-Banking?' }; return; }
  csv = { file, rows, map: guessMap(rows[0]), acc: flt.acc || '', msg: '' };
}
function csvImport(ctx) {
  if (db.isDemo(ctx)) { csv = null; return; }
  if (!csv.acc) { csv.msg = 'Konto wählen, in das die Buchungen sollen.'; return; }
  const { tx, bad } = csvToTx(csv.rows.slice(1), csv.map, csv.acc);
  if (!tx.length) { csv.msg = 'Keine Zeile lesbar – Spalten für Datum und Betrag prüfen.'; return; }
  const all = db.list(ctx, 'tx'), { add, dup } = dedupe(all, tx);
  if (!db.setRaw(ctx, 'tx', [...all, ...add])) { csv.msg = STORAGE_FAILED; return; }
  db.upsert(ctx, 'import', { kind: 'csv', file: csv.file.slice(0, 120), at: today(ctx), n: add.length, acc: csv.acc });
  csvMsg = `Import fertig: ${add.length} neu · ${dup} schon vorhanden${bad ? ` · ${bad} Zeilen unlesbar` : ''}. Neue Buchungen haben noch keine Kategorie.`;
  csv = null;
  ctx.toast('Import fertig', `${add.length} neue Buchungen`);
}

export function onClick(e, route, ctx) {
  const t = target(e);
  if (!t || common(t, ctx)) return;
  const a = t.dataset.a;
  if (chartClick(t, today(ctx))) { /* period, series */ }
  else if (a === 'csvgo' && csv && !csv.error) csvImport(ctx);
  else if (a === 'csvx') { csv = null; csvMsg = ''; }
  else if (a === 'budedit') budEdit = !budEdit;
  else if (a === 'tocsv') { const el = typeof document !== 'undefined' && document.getElementById('csv'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
  else return;
  blurActive();
  ctx.rerender();
}
export function onInput(e, route, ctx) { if (!kbInput(e.target, ctx)) edInput(e.target); }
export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (edInput(t)) return undefined;
  // a date field may still be typed in: the shell redraws once it loses focus
  if (chartChange(t)) return ctx.rerender();
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
