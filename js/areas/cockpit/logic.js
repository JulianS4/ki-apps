// Cockpit arithmetic: money in whole cents, days as 'YYYY-MM-DD'. No storage, no DOM.
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;

// '1.234,56', '12.50', '-8,99 €' → cents; anything unreadable → null.
export function parseMoney(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : null;
  let s = String(v ?? '').replace(/[€\s ]/g, '').replace(/[−–]/g, '-');
  const neg = s.startsWith('-');
  s = s.replace(/^[+-]/, '');
  if (!s || !/^[\d.,]+$/.test(s)) return null;
  let int, frac = '';
  const commas = (s.match(/,/g) || []).length, dots = (s.match(/\./g) || []).length;
  if (commas > 1) return null;
  if (commas === 1) [int, frac] = [s.split(',')[0].replace(/\./g, ''), s.split(',')[1]];
  else if (dots === 1 && /\.\d{1,2}$/.test(s)) [int, frac] = s.split('.');
  else int = s.replace(/\./g, '');
  if (!/^\d*$/.test(int) || !/^\d{0,2}$/.test(frac) || (!int && !frac)) return null;
  const c = Number(int || 0) * 100 + Number((frac + '00').slice(0, 2));
  return neg ? -c : c;
}

const SYM = { EUR: '€', USD: '$', GBP: '£' };
const NUM2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUM0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
export function fmtMoney(c, cur = 'EUR') {
  const n = Number(c) || 0;
  return (n < 0 ? '−' : '') + NUM2.format(Math.abs(n) / 100) + ' ' + (SYM[cur] || cur);
}
export const fmtEuro0 = euros => (euros < 0 ? '−' : '') + NUM0.format(Math.abs(euros));

const pad = n => String(n).padStart(2, '0');
const parts = day => day.split('-').map(Number);
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function addMonths(day, n) {
  const [y, m, d] = parts(day), t = y * 12 + (m - 1) + n, ny = Math.floor(t / 12), nm = t - ny * 12 + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, lastDay(ny, nm)))}`;
}
export const addDaysUtc = (day, n) => new Date(Date.parse(day + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const daysUntil = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

export const PERIODS = [['monat', 'Dieser Monat'], ['vormonat', 'Letzter Monat'], ['3m', 'Letzte 3 Monate'], ['jahr', 'Dieses Jahr'], ['alle', 'Alles']];
export const dm = day => `${+day.slice(8, 10)}.${+day.slice(5, 7)}.`;
const dmy = day => dm(day) + day.slice(0, 4);
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const wday = day => new Date(day + 'T12:00:00Z').getUTCDay();
// 'woche' is Monday to Sunday; 'frei' takes { from, to } and is null when that is not a valid span.
export function periodRange(kind, today, custom) {
  const [y, m] = parts(today), first = (yy, mm) => `${yy}-${pad(mm)}-01`;
  if (kind === 'woche') { const from = addDaysUtc(today, -((wday(today) + 6) % 7)), to = addDaysUtc(from, 6); return { from, to, label: `Woche ${dm(from)}–${dm(to)}` }; }
  if (kind === 'frei') {
    const f = custom && custom.from, t = custom && custom.to;
    return isDay(f) && isDay(t) && f <= t ? { from: f, to: t, label: `${dmy(f)}–${dmy(t)}` } : null;
  }
  const month = (yy, mm) => ({ from: first(yy, mm), to: `${yy}-${pad(mm)}-${pad(lastDay(yy, mm))}`, label: `${MONTHS[mm - 1]} ${yy}` });
  if (kind === 'vormonat') { const p = addMonths(first(y, m), -1); return month(...parts(p).slice(0, 2)); }
  if (kind === '3m') return { from: addMonths(first(y, m), -2), to: month(y, m).to, label: 'Letzte 3 Monate' };
  if (kind === 'jahr') return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
  if (kind === 'alle') return { from: '0000-01-01', to: '9999-12-31', label: 'Gesamter Zeitraum' };
  return month(y, m);
}
export const inRange = (d, r) => !r || (d >= r.from && d <= r.to);

// Chart buckets: days up to two weeks, weeks up to three months, else months.
export function buckets(r) {
  const n = daysUntil(r.from, r.to) + 1, out = [];
  if (n <= 14) {
    for (let i = 0; i < n; i++) { const d = addDaysUtc(r.from, i); out.push({ from: d, to: d, label: WD[wday(d)], long: `${WD[wday(d)]} ${dm(d)}` }); }
  } else if (n <= 92) {
    let d = r.from;
    while (d <= r.to) {
      const end = [addDaysUtc(d, 6 - ((wday(d) + 6) % 7)), r.to].sort()[0];
      out.push({ from: d, to: end, label: dm(d), long: d === end ? dm(d) : `${dm(d)}–${dm(end)}` });
      d = addDaysUtc(end, 1);
    }
  } else {
    const years = r.from.slice(0, 4) !== r.to.slice(0, 4);
    let d = r.from;
    while (d <= r.to) {
      const [yy, mm] = parts(d), last = `${yy}-${pad(mm)}-${pad(lastDay(yy, mm))}`, end = [last, r.to].sort()[0];
      out.push({ from: d, to: end, label: MONTHS[mm - 1].slice(0, 3) + (years ? ` ${String(yy).slice(2)}` : ''), long: `${MONTHS[mm - 1]} ${yy}` });
      d = addDaysUtc(end, 1);
    }
  }
  return out;
}

// Net worth counts euro accounts only and names the others instead of converting.
export function netWorth(accounts) {
  const eur = accounts.filter(a => a.cur === 'EUR'), days = eur.map(a => a.asOf).filter(Boolean).sort();
  return { total: eur.reduce((s, a) => s + a.bal, 0), oldest: days[0] || null, newest: days[days.length - 1] || null, skipped: accounts.filter(a => a.cur !== 'EUR').map(a => a.name) };
}
// The curve starts on the day the last account got its first balance: an
// account without a known balance would otherwise count as 0 and fake growth.
export function netWorthSeries(accounts) {
  const eur = accounts.filter(a => a.cur === 'EUR' && a.hist.length).map(a => [...a.hist].sort((x, y) => (x.d < y.d ? -1 : 1)));
  const start = eur.map(h => h[0].d).sort().pop();
  const dates = [...new Set(eur.flatMap(h => h.map(p => p.d)))].filter(d => d >= start).sort();
  return dates.map(date => ({ date, c: eur.reduce((s, h) => { let v = 0; for (const p of h) if (p.d <= date) v = p.c; return s + v; }, 0) }));
}

export function filterTx(tx, { acc, cat, range } = {}) {
  return tx.filter(t => (!acc || t.acc === acc) && (!cat || t.cat === cat) && inRange(t.d, range));
}
const catMap = cats => new Map(cats.map(c => [c.id, c]));
export const kindOf = (t, m) => (m.get(t.cat) ? m.get(t.cat).kind : t.amt >= 0 ? 'einnahme' : 'ausgabe');
export function totals(tx, cats) {
  const m = catMap(cats), r = { inc: 0, exp: 0, save: 0 };
  for (const t of tx) {
    const k = kindOf(t, m);
    if (k === 'einnahme') r.inc += t.amt; else if (k === 'sparen') r.save -= t.amt; else r.exp -= t.amt;
  }
  return r;
}
export function byCategory(tx, cats) {
  const m = catMap(cats), sums = new Map();
  for (const t of tx) {
    if (kindOf(t, m) !== 'ausgabe') continue;
    const id = m.get(t.cat) ? t.cat : '';
    sums.set(id, (sums.get(id) || 0) - t.amt);
  }
  return [...sums].filter(([, c]) => c > 0).map(([cat, c]) => ({ cat, name: cat ? m.get(cat).name : 'Ohne Kategorie', c })).sort((a, b) => b.c - a.c);
}
export function budgetRows(budgets, tx, cats, range) {
  return cats.filter(c => budgets[c.id] > 0).map(c => {
    const plan = budgets[c.id], actual = -filterTx(tx, { cat: c.id, range }).reduce((s, t) => s + t.amt, 0);
    return { cat: c.id, name: c.name, plan, actual, rest: plan - actual, over: actual > plan };
  });
}

// Income, spending and money put aside per bucket, with the count behind each.
export function flowSeries(tx, cats, bks) {
  const out = { inc: [], exp: [], save: [], n: [] };
  for (const b of bks) {
    const t = filterTx(tx, { range: b }), s = totals(t, cats);
    out.inc.push(s.inc); out.exp.push(s.exp); out.save.push(s.save); out.n.push(t.length);
  }
  return out;
}

// Business log per project for one measure: the three largest (by size), the rest as "Weitere".
const MEASURE = { inc: e => e.inc, profit: e => e.inc - e.exp, min: e => e.min };
export function logSeries(log, projects, bks, measure) {
  const f = MEASURE[measure] || MEASURE.inc, inR = log.filter(e => bks.length && e.d >= bks[0].from && e.d <= bks[bks.length - 1].to);
  const ids = [...new Set([...projects.map(p => p.id), ...inR.map(e => e.proj)])];
  const vals = id => bks.map(b => inR.filter(e => e.proj === id && e.d >= b.from && e.d <= b.to).reduce((s, e) => s + f(e), 0));
  const rows = ids.map(id => ({ id, values: vals(id) })).map(r => ({ ...r, size: r.values.reduce((s, v) => s + Math.abs(v), 0) })).filter(r => r.size > 0);
  const top = new Set([...rows].sort((a, b) => b.size - a.size).slice(0, 3).map(r => r.id));
  const name = id => (projects.find(p => p.id === id) || { name: 'Projekt gelöscht' }).name;
  const out = rows.filter(r => top.has(r.id)).map(r => ({ key: r.id, name: name(r.id), values: r.values }));
  const rest = rows.filter(r => !top.has(r.id));
  if (rest.length) out.push({ key: '_rest', name: 'Weitere', values: bks.map((b, i) => rest.reduce((s, r) => s + r.values[i], 0)) });
  return out;
}

// Subscriptions: monthly share, yearly sum, next billing date rolled forward from `next`.
const PER_YEAR = { woche: 52, monat: 12, quartal: 4, halbjahr: 2, jahr: 1 };
const STEP_M = { monat: 1, quartal: 3, halbjahr: 6, jahr: 12 };
export const subMonthly = s => Math.round(s.amt * (PER_YEAR[s.every] || 12) / 12);
export function subTotals(subs) {
  const act = subs.filter(s => s.status === 'aktiv'), eur = act.filter(s => s.cur === 'EUR');
  return { month: eur.reduce((n, s) => n + subMonthly(s), 0), year: eur.reduce((n, s) => n + s.amt * (PER_YEAR[s.every] || 12), 0), active: act.length, other: act.length - eur.length };
}
export function nextBilling(s, today) {
  if (!isDay(s.next) || s.next >= today) return s.next;
  if (s.every === 'woche') { const n = Math.ceil(daysUntil(s.next, today) / 7); return addDaysUtc(s.next, n * 7); }
  const k = STEP_M[s.every] || 1;
  for (let n = 1; n < 2400; n++) { const d = addMonths(s.next, n * k); if (d >= today) return d; }
  return s.next;
}

// School.
export const nextExams = (exams, today, n = 3) => exams.filter(e => e.d >= today).sort((a, b) => (a.d + (a.time || '99:99') < b.d + (b.time || '99:99') ? -1 : 1)).slice(0, n);
export function gradeAvg(exams) {
  const g = exams.map(e => e.grade).filter(v => typeof v === 'number' && v >= 1 && v <= 6);
  return g.length ? Math.round(g.reduce((s, v) => s + v, 0) / g.length * 100) / 100 : null;
}
export function currentDept(depts, today) {
  const c = depts.filter(d => d.from <= today && (!d.to || d.to >= today)).sort((a, b) => (a.from < b.from ? 1 : -1));
  return c[0] || null;
}

// Business log.
export function logStats(log, { proj, range } = {}) {
  const r = { inc: 0, exp: 0, profit: 0, min: 0, n: 0 };
  for (const e of log) if ((!proj || e.proj === proj) && inRange(e.d, range)) { r.inc += e.inc; r.exp += e.exp; r.min += e.min; r.n++; }
  r.profit = r.inc - r.exp;
  return r;
}
export const fmtDur = min => `${Math.floor(min / 60)}:${pad(min % 60)} h`;
export function parseDur(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, '');
  let m;
  if ((m = s.match(/^(\d+):([0-5]\d)h?$/))) return +m[1] * 60 + +m[2];
  if ((m = s.match(/^(\d+(?:[.,]\d+)?)(h|std)$/))) return Math.round(parseFloat(m[1].replace(',', '.')) * 60);
  if ((m = s.match(/^(\d+)(min|m)?$/))) return +m[1];
  return null;
}

// Open dated tasks from school and projects due within `days` (overdue included).
export function dueTasks(school, projects, today, days = 7) {
  const end = addDaysUtc(today, days), out = [];
  for (const t of school.tasks || []) if (!t.done && t.due && t.due <= end) out.push({ text: t.text, due: t.due, where: t.subj, href: '#ausbildung', overdue: t.due < today });
  for (const p of projects) for (const t of p.tasks || []) if (!t.done && t.due && t.due <= end) out.push({ text: t.text, due: t.due, where: p.name, href: '#projekte/p-' + p.id, overdue: t.due < today });
  return out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}

// CSV from bank exports: quotes, ';' or ',' or tab, BOM, CRLF.
export function parseCsv(text) {
  const s = String(text || '').replace(/^﻿/, ''), head = s.split(/\r?\n/).slice(0, 20).join('\n');
  const delim = [';', '\t', ','].sort((a, b) => head.split(b).length - head.split(a).length)[0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}
const GUESS = {
  date: [/buchungstag/, /buchungsdatum/, /^buchung$/, /^datum/, /\bdate\b/, /valuta/],
  amount: [/^betrag/, /betrag/, /umsatz/, /amount/],
  payee: [/beguenstigt|begunstigt|zahlungspflichtig/, /empfanger|empfaenger/, /auftraggeber/, /^name|payee|gegenpartei/],
  purpose: [/verwendungszweck/, /zweck/, /beschreibung|description/, /buchungstext/],
};
export function guessMap(header) {
  const h = header.map(norm), used = new Set(), map = {};
  for (const [k, pats] of Object.entries(GUESS)) {
    map[k] = -1;
    for (const p of pats) { const i = h.findIndex((x, j) => !used.has(j) && p.test(x)); if (i >= 0) { map[k] = i; used.add(i); break; } }
  }
  return map;
}
// Some banks put account details above the column names: the header is the
// first row where a date and an amount column are recognised, else the widest.
export function findHeader(rows) {
  const ok = r => { const m = guessMap(r); return m.date >= 0 && m.amount >= 0; };
  const i = rows.findIndex(r => r.length >= 3 && ok(r)), j = i >= 0 ? i : rows.findIndex(ok);
  if (j >= 0) return j;
  let w = 0;
  rows.forEach((r, j) => { if (r.length > rows[w].length) w = j; });
  return w;
}
export function parseDay(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/), d;
  if (m) d = `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`;
  else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) d = `${m[1]}-${m[2]}-${m[3]}`;
  return isDay(d) ? d : null;
}
export function csvToTx(rows, map, acc) {
  const tx = [];
  let bad = 0;
  for (const r of rows) {
    const d = parseDay(r[map.date]), amt = parseMoney(r[map.amount]);
    if (!d || amt == null) { bad++; continue; }
    tx.push({ id: uid(), d, amt, payee: (map.payee >= 0 && r[map.payee]) || '', note: (map.purpose >= 0 && r[map.purpose]) || '', cat: '', acc, src: 'csv' });
  }
  return { tx, bad };
}
const txKey = t => [t.acc, t.d, t.amt, norm(t.payee)].join('|');
export function dedupe(existing, incoming) {
  const seen = new Set(existing.map(txKey)), add = incoming.filter(t => !seen.has(txKey(t)));
  return { add, dup: incoming.length - add.length };
}

// Notes: case- and umlaut-blind search, [[wiki links]] and backlinks.
export const norm = v => String(v ?? '').toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
export function searchNotes(notes, q) {
  const s = norm(q).trim();
  if (!s) return notes;
  if (s.startsWith('#')) return notes.filter(n => n.tags.some(t => norm(t) === s.slice(1)));
  const terms = s.split(/\s+/), hit = n => terms.every(t => norm(n.title + ' ' + n.body + ' ' + n.tags.join(' ')).includes(t));
  const inTitle = n => terms.every(t => norm(n.title).includes(t));
  return notes.filter(hit).map((n, i) => [inTitle(n) ? 0 : 1, i, n]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
}
export function wikiLinks(body) {
  const out = [], seen = new Set();
  for (const m of String(body || '').matchAll(/\[\[([^[\]]+?)\]\]/g)) { const t = m[1].trim(); if (t && !seen.has(norm(t))) { seen.add(norm(t)); out.push(t); } }
  return out;
}
export const findNote = (notes, title) => notes.find(n => norm(n.title) === norm(title)) || null;
export function noteLinks(note, notes) {
  const out = wikiLinks(note.body).map(title => ({ title, id: (findNote(notes, title) || {}).id || null }));
  const back = notes.filter(n => n.id !== note.id && wikiLinks(n.body).some(t => norm(t) === norm(note.title)));
  return { out, back };
}
