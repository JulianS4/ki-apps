import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/areas/cockpit/logic.js';

test('parseMoney reads German and plain amounts as cents', () => {
  assert.equal(L.parseMoney('1.234,56'), 123456);
  assert.equal(L.parseMoney('12,5'), 1250);
  assert.equal(L.parseMoney('-12'), -1200);
  assert.equal(L.parseMoney('−8,99 €'), -899);
  assert.equal(L.parseMoney('12.50'), 1250);
  assert.equal(L.parseMoney('1.000'), 100000);
  assert.equal(L.parseMoney('+3.200,00'), 320000);
  assert.equal(L.parseMoney(''), null);
  assert.equal(L.parseMoney('abc'), null);
  assert.equal(L.parseMoney('1,2,3'), null);
});

test('fmtMoney writes euros the German way', () => {
  assert.equal(L.fmtMoney(123456), '1.234,56 €');
  assert.equal(L.fmtMoney(-899), '−8,99 €');
  assert.equal(L.fmtMoney(0), '0,00 €');
  assert.equal(L.fmtMoney(1999, 'USD'), '19,99 $');
});

test('addMonths keeps the day or clamps it to the month end', () => {
  assert.equal(L.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(L.addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(L.addMonths('2028-01-31', 1), '2028-02-29');
});

test('periodRange covers month, previous month, 3 months, year and all', () => {
  assert.deepEqual(L.periodRange('monat', '2026-11-26'), { from: '2026-11-01', to: '2026-11-30', label: 'November 2026' });
  assert.deepEqual(L.periodRange('vormonat', '2026-01-10'), { from: '2025-12-01', to: '2025-12-31', label: 'Dezember 2025' });
  assert.equal(L.periodRange('3m', '2026-11-26').from, '2026-09-01');
  assert.deepEqual(L.periodRange('jahr', '2026-11-26'), { from: '2026-01-01', to: '2026-12-31', label: '2026' });
  assert.deepEqual(L.periodRange('alle', '2026-11-26'), { from: '0000-01-01', to: '9999-12-31', label: 'Gesamter Zeitraum' });
});

const acc = (id, cur, hist) => ({ id, name: id, cur, bal: hist[hist.length - 1].c, asOf: hist[hist.length - 1].d, hist });

test('netWorth sums euro accounts and names the left-out ones', () => {
  const r = L.netWorth([acc('a', 'EUR', [{ d: '2026-11-01', c: 100000 }]), acc('b', 'EUR', [{ d: '2026-11-20', c: -5000 }]), acc('c', 'USD', [{ d: '2026-11-02', c: 9900 }])]);
  assert.equal(r.total, 95000);
  assert.equal(r.oldest, '2026-11-01');
  assert.equal(r.newest, '2026-11-20');
  assert.deepEqual(r.skipped, ['c']);
});

test('netWorthSeries carries each account forward to every date', () => {
  const s = L.netWorthSeries([
    acc('a', 'EUR', [{ d: '2026-09-01', c: 1000 }, { d: '2026-11-01', c: 3000 }]),
    acc('b', 'EUR', [{ d: '2026-10-01', c: 500 }]),
  ]);
  assert.deepEqual(s, [{ date: '2026-09-01', c: 1000 }, { date: '2026-10-01', c: 1500 }, { date: '2026-11-01', c: 3500 }]);
});

const CATS = [{ id: 'essen', name: 'Essen', kind: 'ausgabe' }, { id: 'abos', name: 'Abos', kind: 'ausgabe' }, { id: 'gehalt', name: 'Gehalt', kind: 'einnahme' }, { id: 'sparen', name: 'Sparen', kind: 'sparen' }];
const TX = [
  { id: '1', d: '2026-11-03', amt: 120000, cat: 'gehalt', acc: 'g' },
  { id: '2', d: '2026-11-04', amt: -4550, cat: 'essen', acc: 'g' },
  { id: '3', d: '2026-11-05', amt: -999, cat: 'abos', acc: 'k' },
  { id: '4', d: '2026-11-06', amt: -20000, cat: 'sparen', acc: 'g' },
  { id: '5', d: '2026-11-07', amt: 550, cat: 'essen', acc: 'g' },
  { id: '6', d: '2026-10-30', amt: -3000, cat: 'essen', acc: 'g' },
  { id: '7', d: '2026-11-08', amt: -700, cat: '', acc: 'g' },
];
const NOV = { from: '2026-11-01', to: '2026-11-30' };

test('totals keep income, spending and money put aside apart', () => {
  assert.deepEqual(L.totals(L.filterTx(TX, { range: NOV }), CATS), { inc: 120000, exp: 4550 - 550 + 999 + 700, save: 20000 });
});

test('filterTx narrows by account, category and period', () => {
  assert.deepEqual(L.filterTx(TX, { acc: 'g', cat: 'essen', range: NOV }).map(t => t.id), ['2', '5']);
  assert.deepEqual(L.filterTx(TX, {}).map(t => t.id), ['1', '2', '3', '4', '5', '6', '7']);
});

test('byCategory lists spending per category, refunds reduce it, largest first', () => {
  assert.deepEqual(L.byCategory(L.filterTx(TX, { range: NOV }), CATS), [
    { cat: 'essen', name: 'Essen', c: 4000 }, { cat: 'abos', name: 'Abos', c: 999 }, { cat: '', name: 'Ohne Kategorie', c: 700 },
  ]);
});

test('budgetRows compare plan and actual for the month', () => {
  const rows = L.budgetRows({ essen: 3000, abos: 2000 }, TX, CATS, NOV);
  assert.deepEqual(rows, [
    { cat: 'essen', name: 'Essen', plan: 3000, actual: 4000, rest: -1000, over: true },
    { cat: 'abos', name: 'Abos', plan: 2000, actual: 999, rest: 1001, over: false },
  ]);
});

test('subscriptions: monthly share, totals of active euro ones, next billing date', () => {
  const subs = [
    { id: 'a', amt: 999, cur: 'EUR', every: 'monat', status: 'aktiv', next: '2026-01-15' },
    { id: 'b', amt: 6000, cur: 'EUR', every: 'jahr', status: 'aktiv', next: '2026-03-01' },
    { id: 'c', amt: 1500, cur: 'EUR', every: 'quartal', status: 'pausiert', next: '2026-12-01' },
    { id: 'd', amt: 500, cur: 'USD', every: 'monat', status: 'aktiv', next: '2026-12-01' },
    { id: 'e', amt: 300, cur: 'EUR', every: 'woche', status: 'gekuendigt', next: '2026-12-01' },
  ];
  assert.equal(L.subMonthly(subs[1]), 500);
  assert.equal(L.subMonthly({ amt: 1200, every: 'woche' }), 5200);
  assert.deepEqual(L.subTotals(subs), { month: 1499, year: 17988, active: 3, other: 1 });
  assert.equal(L.nextBilling(subs[0], '2026-11-26'), '2026-12-15');
  assert.equal(L.nextBilling(subs[1], '2026-11-26'), '2027-03-01');
  assert.equal(L.nextBilling({ next: '2026-01-31', every: 'monat' }, '2026-03-01'), '2026-03-31');
  assert.equal(L.nextBilling({ next: '2026-12-24', every: 'monat' }, '2026-11-26'), '2026-12-24');
});

test('school: next three exams, current department, average grade', () => {
  const ex = [
    { id: '1', subj: 'Mathe', d: '2026-12-03', time: '08:00' },
    { id: '2', subj: 'BWL', d: '2026-11-26', time: '10:00' },
    { id: '3', subj: 'Deutsch', d: '2026-11-20', grade: 2 },
    { id: '4', subj: 'Englisch', d: '2026-12-01' },
    { id: '5', subj: 'Recht', d: '2027-01-10' },
    { id: '6', subj: 'IT', d: '2026-11-10', grade: 1.7 },
  ];
  assert.deepEqual(L.nextExams(ex, '2026-11-26').map(e => e.id), ['2', '4', '1']);
  assert.equal(L.gradeAvg(ex), 1.85);
  assert.equal(L.gradeAvg([]), null);
  const depts = [{ id: 'a', name: 'Einkauf', from: '2026-09-01', to: '2026-11-30' }, { id: 'b', name: 'Vertrieb', from: '2026-12-01' }];
  assert.equal(L.currentDept(depts, '2026-11-26').name, 'Einkauf');
  assert.equal(L.currentDept(depts, '2027-02-01').name, 'Vertrieb');
  assert.equal(L.currentDept(depts, '2026-08-01'), null);
  assert.equal(L.daysUntil('2026-11-26', '2026-12-03'), 7);
});

test('business log: stats per project and period', () => {
  const log = [
    { id: '1', d: '2026-11-02', proj: 'r', min: 90, inc: 4500, exp: 1200 },
    { id: '2', d: '2026-11-10', proj: 'r', min: 30, inc: 0, exp: 0 },
    { id: '3', d: '2026-11-12', proj: 's', min: 120, inc: 0, exp: 2500 },
    { id: '4', d: '2026-10-12', proj: 'r', min: 60, inc: 9000, exp: 0 },
  ];
  assert.deepEqual(L.logStats(log, { range: NOV }), { inc: 4500, exp: 3700, profit: 800, min: 240, n: 3 });
  assert.deepEqual(L.logStats(log, { proj: 'r' }), { inc: 13500, exp: 1200, profit: 12300, min: 180, n: 3 });
  assert.equal(L.fmtDur(90), '1:30 h');
  assert.equal(L.parseDur('1:30'), 90);
  assert.equal(L.parseDur('45'), 45);
  assert.equal(L.parseDur('1,5 h'), 90);
  assert.equal(L.parseDur('x'), null);
});

test('dueTasks gathers open dated tasks from school and projects, overdue first', () => {
  const school = { tasks: [{ id: 't1', subj: 'Mathe', text: 'Blatt 3', due: '2026-11-28', done: false }, { id: 't2', subj: 'BWL', text: 'alt', due: '2026-11-20', done: true }] };
  const projects = [{ id: 'p', name: 'Sensito', tasks: [{ id: 'x', text: 'Mail', due: '2026-11-24', done: false }, { id: 'y', text: 'später', due: '2026-12-30', done: false }] }];
  const r = L.dueTasks(school, projects, '2026-11-26');
  assert.deepEqual(r.map(t => [t.text, t.where, t.overdue]), [['Mail', 'Sensito', true], ['Blatt 3', 'Mathe', false]]);
});

test('CSV: parse quoted semicolon files, guess columns, build transactions', () => {
  const csv = '﻿"Buchungstag";"Valutadatum";"Beguenstigter/Zahlungspflichtiger";"Verwendungszweck";"Betrag"\r\n"03.11.26";"03.11.26";"Bäcker; Ecke";"Brötchen";"-4,50"\r\n"05.11.2026";"05.11.2026";"Firma";"Lohn";"1.200,00"\r\n';
  const rows = L.parseCsv(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][2], 'Bäcker; Ecke');
  const m = L.guessMap(rows[0]);
  assert.deepEqual(m, { date: 0, amount: 4, payee: 2, purpose: 3 });
  const { tx, bad } = L.csvToTx(rows.slice(1), m, 'g');
  assert.equal(bad, 0);
  assert.deepEqual(tx.map(t => [t.d, t.amt, t.payee, t.note, t.acc, t.src]), [['2026-11-03', -450, 'Bäcker; Ecke', 'Brötchen', 'g', 'csv'], ['2026-11-05', 120000, 'Firma', 'Lohn', 'g', 'csv']]);
  assert.equal(L.parseCsv('a,b\n1,2').length, 2);
  assert.equal(L.parseCsv('a,b\n1,2')[1][1], '2');
});

test('CSV: rows without date or amount are counted, duplicates are skipped', () => {
  const { tx, bad } = L.csvToTx([['x', '1'], ['03.11.2026', 'abc'], ['03.11.2026', '-1,00']], { date: 0, amount: 1, payee: -1, purpose: -1 }, 'g');
  assert.equal(bad, 2);
  assert.equal(tx.length, 1);
  const old = [{ id: 'o', d: '2026-11-03', amt: -100, payee: '', acc: 'g' }];
  assert.deepEqual(L.dedupe(old, tx), { add: [], dup: 1 });
});

const NOTES = [
  { id: 'a', title: 'Reselling Einkauf', body: 'Siehe [[Preisliste]] und [[Fehlt noch]].', tags: ['business'], topic: 'business' },
  { id: 'b', title: 'Preisliste', body: 'Marge über 30 %', tags: ['reselling'], topic: 'business' },
  { id: 'c', title: 'Agent Ideen', body: 'Ein Agent prüft Preise', tags: ['ki'], topic: 'ki' },
];

test('notes: search ignores case and umlauts, title hits first', () => {
  assert.deepEqual(L.searchNotes(NOTES, 'preis').map(n => n.id), ['b', 'a', 'c']);
  assert.deepEqual(L.searchNotes(NOTES, 'MARGE').map(n => n.id), ['b']);
  assert.deepEqual(L.searchNotes(NOTES, 'uber').map(n => n.id), ['b']);
  assert.deepEqual(L.searchNotes(NOTES, '#ki').map(n => n.id), ['c']);
  assert.equal(L.searchNotes(NOTES, '').length, 3);
});

test('notes: wiki links resolve to notes, missing ones are named, backlinks found', () => {
  assert.deepEqual(L.wikiLinks('x [[A]] y [[ B ]] [[A]]'), ['A', 'B']);
  const r = L.noteLinks(NOTES[0], NOTES);
  assert.deepEqual(r.out, [{ title: 'Preisliste', id: 'b' }, { title: 'Fehlt noch', id: null }]);
  assert.deepEqual(L.noteLinks(NOTES[1], NOTES).back.map(n => n.id), ['a']);
});
