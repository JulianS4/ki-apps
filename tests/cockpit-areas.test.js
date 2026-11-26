import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { parseRoute } from '../js/core/routes.js';
import { memBackend } from './helpers.js';
import * as db from '../js/areas/cockpit/db.js';
import * as home from '../js/areas/cockpit/home.js';
import * as finance from '../js/areas/cockpit/finance.js';
import * as school from '../js/areas/cockpit/school.js';
import * as projects from '../js/areas/cockpit/projects.js';
import * as agents from '../js/areas/cockpit/agents.js';
import * as notes from '../js/areas/cockpit/notes.js';
import * as integrations from '../js/areas/cockpit/integrations.js';
import * as heute from '../js/areas/heute.js';

const mk = () => {
  const ctx = { store: createStore(memBackend()), now: () => new Date(2026, 10, 26, 9, 0), rerender() {}, toast() {}, go(h) { ctx.went = h; } };
  for (const a of [home, finance, school, projects, agents, notes, integrations]) a.onNavigate(null, ctx);
  return ctx;
};
const click = (dataset, extra = {}) => ({ target: { closest: () => ({ dataset, ...extra }) } });
const typed = (dataset, value, extra = {}) => ({ target: { dataset, value, ...extra, closest: () => ({ dataset, value, ...extra }) } });
const fill = (area, route, ctx, values) => { for (const [f, v] of Object.entries(values)) area.onInput(typed({ f }, v), route, ctx); };
const R = {
  home: { area: 'cockpit' }, fin: v => ({ area: 'finance', view: v }), school: { area: 'school', view: 'overview' },
  proj: { area: 'projects', view: 'list' }, log: { area: 'projects', view: 'log' }, agents: { area: 'agents' }, notes: { area: 'notes', view: 'list' }, integ: { area: 'integrations' },
};

test('routes reach every cockpit page', () => {
  assert.deepEqual(parseRoute('#cockpit'), { area: 'cockpit' });
  assert.deepEqual(parseRoute('#finanzen'), { area: 'finance', view: 'overview' });
  assert.deepEqual(parseRoute('#finanzen/abos'), { area: 'finance', view: 'subs' });
  assert.deepEqual(parseRoute('#finanzen/buchungen'), { area: 'finance', view: 'tx' });
  assert.deepEqual(parseRoute('#ausbildung'), { area: 'school', view: 'overview' });
  assert.deepEqual(parseRoute('#ausbildung/fach?BWL%20II'), { area: 'school', view: 'subject', subj: 'BWL II' });
  assert.deepEqual(parseRoute('#projekte/p-sensito'), { area: 'projects', view: 'project', id: 'sensito' });
  assert.deepEqual(parseRoute('#projekte/log'), { area: 'projects', view: 'log' });
  assert.deepEqual(parseRoute('#wissen/n-abc'), { area: 'notes', view: 'note', id: 'abc' });
  assert.deepEqual(parseRoute('#agents'), { area: 'agents' });
  assert.deepEqual(parseRoute('#integrationen'), { area: 'settings' });
});

test('a new entry is typed into the form and saved; missing fields are named', () => {
  const ctx = mk();
  school.onClick(click({ a: 'fnew', s: 'exam' }), R.school, ctx);
  assert.match(school.render(R.school, ctx), /<h3>Klassenarbeit hinzufügen<\/h3>/);
  school.onClick(click({ a: 'fsave' }), R.school, ctx);
  assert.match(school.render(R.school, ctx), /Bitte ausfüllen/);
  fill(school, R.school, ctx, { subj: 'Mathe', d: '2026-12-03', time: '08:00', place: 'Raum 4', grade: '' });
  school.onClick(click({ a: 'fsave' }), R.school, ctx);
  assert.deepEqual(db.list(ctx, 'exam').map(e => [e.subj, e.d, e.time, e.place]), [['Mathe', '2026-12-03', '08:00', 'Raum 4']]);
  assert.doesNotMatch(school.render(R.school, ctx), /<h3>Klassenarbeit hinzufügen<\/h3>/);
});

test('editing can empty an optional field, deleting takes two taps', () => {
  const ctx = mk();
  const e = db.upsert(ctx, 'exam', { subj: 'Mathe', d: '2026-11-01', grade: 2.3 });
  school.onClick(click({ a: 'fedit', s: 'exam', id: e.id }), R.school, ctx);
  fill(school, R.school, ctx, { grade: '' });
  school.onClick(click({ a: 'fsave' }), R.school, ctx);
  assert.equal(db.find(ctx, 'exam', e.id).grade, undefined);
  school.onClick(click({ a: 'fedit', s: 'exam', id: e.id }), R.school, ctx);
  school.onClick(click({ a: 'fdel' }), R.school, ctx);
  assert.match(school.render(R.school, ctx), /Sicher\? Nochmal tippen/);
  assert.equal(db.list(ctx, 'exam').length, 1);
  school.onClick(click({ a: 'fdel' }), R.school, ctx);
  assert.equal(db.list(ctx, 'exam').length, 0);
});

test('the empty cockpit offers examples and already knows the three projects', () => {
  const ctx = mk();
  const html = home.render(R.home, ctx);
  assert.match(html, /data-a="demostart"/);
  for (const p of ['Reselling', 'Personal Brand', 'Sensito']) assert.match(html, new RegExp(p));
  assert.match(html, /Noch kein Konto/);
  assert.match(html, /Keine Klassenarbeiten eingetragen/);
});

test('cockpit covers amounts until asked, and names source and date', () => {
  const ctx = mk();
  db.upsert(ctx, 'account', { name: 'Giro', type: 'giro', cur: 'EUR', bal: 123456, asOf: '2026-11-20' });
  let html = home.render(R.home, ctx);
  assert.match(html, /•••• €/);
  assert.doesNotMatch(html, /1\.234,56/);
  assert.match(html, /manuell eingetragen · Stand 20\.11\./);
  home.onClick(click({ a: 'shown' }), R.home, ctx);
  html = home.render(R.home, ctx);
  assert.match(html, /1\.234,56 €/);
  home.onClick(click({ a: 'shown' }), R.home, ctx);
  assert.doesNotMatch(home.render(R.home, ctx), /1\.234,56/);
});

test('cockpit shows the next three exams, due tasks, department and agents honestly', () => {
  const ctx = mk();
  for (const [s, d] of [['Recht', '2027-01-10'], ['BWL', '2026-11-26'], ['Mathe', '2026-12-03'], ['Englisch', '2026-12-01']]) db.upsert(ctx, 'exam', { subj: s, d, prep: 'offen' });
  db.upsert(ctx, 'dept', { name: 'Einkauf', from: '2026-09-01', to: '2026-12-31' });
  db.upsert(ctx, 'ptask', { proj: 'sensito', text: 'Feedback holen', due: '2026-11-25', done: false });
  db.upsert(ctx, 'agent', { name: 'Recherche', status: 'bereit', asOf: '2026-11-25' });
  const html = home.render(R.home, ctx);
  const order = ['BWL', 'Englisch', 'Mathe'].map(s => html.indexOf(`<b>${s}</b>`));
  assert.ok(order.every(i => i > 0) && order[0] < order[1] && order[1] < order[2], String(order));
  assert.doesNotMatch(html, /<b>Recht<\/b>/);
  assert.match(html, /heute/);
  assert.match(html, /Einkauf/);
  assert.match(html, /Feedback holen/);
  assert.match(html, /überfällig/);
  assert.match(html, /nicht verbunden/);
});

test('example mode shows a banner on every cockpit page and ends cleanly', () => {
  const ctx = mk();
  home.onClick(click({ a: 'demostart' }), R.home, ctx);
  for (const [a, r] of [[home, R.home], [finance, R.fin('overview')], [school, R.school], [projects, R.proj], [agents, R.agents], [notes, R.notes], [integrations, R.integ]]) assert.match(a.render(r, ctx), /class="demo"[\s\S]*Beispieldaten/);
  assert.match(finance.render(R.fin('overview'), ctx), /Beispiel-Girokonto/);
  school.onClick(click({ a: 'fnew', s: 'exam' }), R.school, ctx);
  assert.match(school.render(R.school, ctx), /wird mit den Beispielen gelöscht/);
  school.onClick(click({ a: 'fcancel' }), R.school, ctx);
  finance.onClick(click({ a: 'demoend' }), R.fin('overview'), ctx);
  assert.doesNotMatch(home.render(R.home, ctx), /class="demo"/);
  assert.doesNotMatch(finance.render(R.fin('overview'), ctx), /Beispiel-Girokonto/);
});

const seedFin = ctx => {
  const g = db.upsert(ctx, 'account', { id: 'g', name: 'Giro', type: 'giro', cur: 'EUR', bal: 123456, asOf: '2026-11-20' });
  db.upsert(ctx, 'account', { id: 'k', name: 'Karte', type: 'sonstiges', cur: 'EUR', bal: -5000, asOf: '2026-10-01' });
  for (const [d, amt, payee, cat, acc] of [['2026-11-03', 120000, 'Firma', 'gehalt', 'g'], ['2026-11-04', -4550, 'Bäcker', 'essen', 'g'], ['2026-11-05', -999, 'Streaming', 'abos', 'k'], ['2026-11-06', -20000, 'Sparplan', 'sparen', 'g'], ['2026-10-02', -3000, 'Altladen', 'essen', 'g']]) db.upsert(ctx, 'tx', { d, amt, payee, cat, acc });
  return g;
};

test('finance overview shows net worth openly, per account with source and date', () => {
  const ctx = mk();
  seedFin(ctx);
  const html = finance.render(R.fin('overview'), ctx);
  assert.match(html, /Gesamtvermögen/);
  assert.match(html, /1\.184,56 €/);
  assert.match(html, /Stand 1\.10\. · veraltet\?/);
  assert.match(html, /Einnahmen[\s\S]*1\.200,00 €/);
  assert.match(html, /Zurückgelegt[\s\S]*200,00 €/);
});

test('transactions filter by account, category and period', () => {
  const ctx = mk();
  seedFin(ctx);
  const r = R.fin('tx');
  let html = finance.render(r, ctx);
  assert.match(html, /Bäcker/);
  assert.doesNotMatch(html, /Altladen/);
  finance.onClick(click({ a: 'per', chart: 'tx', v: 'jahr' }), r, ctx);
  assert.match(finance.render(r, ctx), /Altladen/);
  finance.onChange(typed({ a: 'flt', k: 'acc' }, 'k'), r, ctx);
  html = finance.render(r, ctx);
  assert.match(html, /Streaming/);
  assert.doesNotMatch(html, /Bäcker/);
  finance.onChange(typed({ a: 'flt', k: 'acc' }, ''), r, ctx);
  finance.onChange(typed({ a: 'flt', k: 'cat' }, 'essen'), r, ctx);
  html = finance.render(r, ctx);
  assert.match(html, /Bäcker/);
  assert.doesNotMatch(html, /Streaming/);
});

test('costs by category and budget against actual', () => {
  const ctx = mk();
  seedFin(ctx);
  assert.match(finance.render(R.fin('costs'), ctx), /Essen &amp; Trinken[\s\S]*45,50 €/);
  finance.onChange(typed({ a: 'bud', cat: 'essen' }, '30'), R.fin('budget'), ctx);
  assert.deepEqual(db.budgets(ctx), { essen: 3000 });
  const html = finance.render(R.fin('budget'), ctx);
  assert.match(html, /15,50 € drüber/);
  finance.onChange(typed({ a: 'bud', cat: 'essen' }, 'viel'), R.fin('budget'), ctx);
  assert.deepEqual(db.budgets(ctx), { essen: 3000 });
});

test('subscriptions show monthly and yearly totals and the next date', () => {
  const ctx = mk();
  db.upsert(ctx, 'sub', { name: 'Streaming', amt: 999, cur: 'EUR', every: 'monat', next: '2026-01-15', status: 'aktiv' });
  db.upsert(ctx, 'sub', { name: 'Cloud', amt: 6000, cur: 'EUR', every: 'jahr', next: '2027-03-01', status: 'aktiv' });
  db.upsert(ctx, 'sub', { name: 'Alt', amt: 500, cur: 'EUR', every: 'monat', next: '2026-01-01', status: 'gekuendigt' });
  const html = finance.render(R.fin('subs'), ctx);
  assert.match(html, /14,99 €[\s\S]*pro Monat/);
  assert.match(html, /179,88 €[\s\S]*pro Jahr/);
  assert.match(html, /Di 15\.12\./);
  assert.match(html, /gekündigt/);
});

const CSV = 'Buchungstag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Betrag\n03.11.2026;Bäcker;Brötchen;-4,50\n05.11.2026;Firma;Lohn;1.200,00\n';

test('CSV import: columns are recognised, rows go to the chosen account, repeats are skipped', () => {
  const ctx = mk();
  seedFin(ctx);
  const before = db.list(ctx, 'tx').length, r = R.fin('tx');
  finance.csvLoad(ctx, CSV, 'umsaetze.csv');
  let html = finance.render(r, ctx);
  assert.match(html, /umsaetze\.csv · 2 Zeilen/);
  finance.onClick(click({ a: 'csvgo' }), r, ctx);
  assert.match(finance.render(r, ctx), /Konto wählen/);
  finance.onChange(typed({ a: 'csvacc' }, 'g'), r, ctx);
  finance.onClick(click({ a: 'csvgo' }), r, ctx);
  assert.equal(db.list(ctx, 'tx').length, before + 2);
  assert.ok(db.list(ctx, 'tx').some(t => t.src === 'csv' && t.payee === 'Bäcker' && t.amt === -450));
  assert.deepEqual(db.list(ctx, 'import').map(i => [i.kind, i.file, i.n, i.acc]), [['csv', 'umsaetze.csv', 2, 'g']]);
  finance.csvLoad(ctx, CSV, 'umsaetze.csv');
  finance.onChange(typed({ a: 'csvacc' }, 'g'), r, ctx);
  finance.onClick(click({ a: 'csvgo' }), r, ctx);
  assert.equal(db.list(ctx, 'tx').length, before + 2);
  assert.match(finance.render(r, ctx), /0 neu · 2 schon vorhanden/);
  finance.csvLoad(ctx, 'kein csv', 'x.txt');
  assert.match(finance.render(r, ctx), /Keine Buchungen erkannt/);
});

test('school: department, next exams, average, and a subject page with tasks and notes', () => {
  const ctx = mk();
  db.upsert(ctx, 'dept', { name: 'Einkauf', from: '2026-09-01', to: '2026-12-31' });
  db.upsert(ctx, 'exam', { subj: 'BWL', d: '2026-12-02', time: '08:00', place: 'Raum 4', prep: 'begonnen' });
  db.upsert(ctx, 'exam', { subj: 'BWL', d: '2026-10-02', grade: 1.7 });
  db.upsert(ctx, 'exam', { subj: 'Deutsch', d: '2026-10-05', grade: 2.3 });
  db.upsert(ctx, 'stask', { subj: 'BWL', text: 'Kapitel 4', due: '2026-11-30', done: false });
  db.upsert(ctx, 'note', { title: 'Lernplan', topic: 'ausbildung', tags: ['bwl'], body: 'x', projects: [] });
  const html = school.render(R.school, ctx);
  assert.match(html, /Einkauf/);
  assert.match(html, /Nächste Klassenarbeiten[\s\S]*BWL[\s\S]*Raum 4/);
  assert.match(html, /Schnitt[\s\S]*2,0/);
  const sub = school.render({ area: 'school', view: 'subject', subj: 'BWL' }, ctx);
  assert.match(sub, /Kapitel 4/);
  assert.match(sub, /Lernplan/);
  assert.doesNotMatch(sub, /Deutsch/);
});

test('projects and business log: per-project numbers and evaluation', () => {
  const ctx = mk();
  db.upsert(ctx, 'log', { d: '2026-11-20', proj: 'sensito', text: 'Verkauf', min: 90, inc: 10000, exp: 2000 });
  db.upsert(ctx, 'log', { d: '2026-11-21', proj: 'reselling', text: 'Einkauf', min: 30, inc: 0, exp: 500 });
  db.upsert(ctx, 'ptask', { proj: 'sensito', text: 'Prototyp testen', done: false });
  assert.match(projects.render(R.proj, ctx), /Personal Brand/);
  const p = projects.render({ area: 'projects', view: 'project', id: 'sensito' }, ctx);
  assert.match(p, /Prototyp testen/);
  assert.match(p, /Gewinn[\s\S]*80,00 €/);
  assert.match(p, /1:30 h/);
  const log = projects.render(R.log, ctx);
  assert.match(log, /Verkauf/);
  assert.match(log, /Reselling[\s\S]*−5,00 €/);
  projects.onClick(click({ a: 'per', chart: 'log', v: 'woche' }), R.log, ctx);
  assert.doesNotMatch(projects.render(R.log, ctx), /Verkauf/);
  assert.match(projects.render({ area: 'projects', view: 'project', id: 'gibtsnicht' }, ctx), /nicht gefunden/);
});

test('agents are never shown as connected', () => {
  const ctx = mk();
  assert.match(agents.render(R.agents, ctx), /Noch keine Agents/);
  db.upsert(ctx, 'agent', { name: 'Recherche', job: 'News', status: 'fehlgeschlagen', asOf: '2026-11-25', issues: 'Login abgelaufen' });
  const html = agents.render(R.agents, ctx);
  assert.match(html, /nicht verbunden/);
  assert.match(html, /fehlgeschlagen/);
  assert.match(html, /Login abgelaufen/);
  assert.match(html, /Stand 25\.11\./);
});

test('notes: links between notes, backlinks, missing links and search', () => {
  const ctx = mk();
  notes.onClick(click({ a: 'fnew', s: 'note' }), R.notes, ctx);
  fill(notes, R.notes, ctx, { title: 'Einkauf', body: 'siehe [[Preise]]', tags: 'reselling', topic: 'business' });
  notes.onInput(typed({ f: 'projects', ref: 'reselling' }, 'on', { checked: true }), R.notes, ctx);
  notes.onClick(click({ a: 'fsave' }), R.notes, ctx);
  const a = db.list(ctx, 'note')[0];
  assert.deepEqual(a.projects, ['reselling']);
  let html = notes.render({ area: 'notes', view: 'note', id: a.id }, ctx);
  assert.match(html, /data-a="mknote" data-t="Preise"/);
  notes.onClick(click({ a: 'mknote', t: 'Preise' }), { area: 'notes', view: 'note', id: a.id }, ctx);
  notes.onClick(click({ a: 'fsave' }), R.notes, ctx);
  const b = db.list(ctx, 'note').find(n => n.title === 'Preise');
  html = notes.render({ area: 'notes', view: 'note', id: a.id }, ctx);
  assert.match(html, new RegExp(`href="#wissen/n-${b.id}"`));
  assert.match(notes.render({ area: 'notes', view: 'note', id: b.id }, ctx), /Verweise hierher[\s\S]*Einkauf/);
  notes.onInput(typed({ a: 'q' }, 'siehe'), R.notes, ctx);
  html = notes.render(R.notes, ctx);
  assert.match(html, /Einkauf/);
  assert.doesNotMatch(html, />Preise</);
  assert.match(projects.render({ area: 'projects', view: 'project', id: 'reselling' }, ctx), /Einkauf/);
});

test('settings: honest integration status, last import, export and a guarded wipe', () => {
  const ctx = mk();
  db.upsert(ctx, 'exam', { subj: 'Mathe', d: '2026-12-03' });
  db.upsert(ctx, 'import', { kind: 'csv', file: 'umsaetze.csv', at: '2026-11-24', n: 12, acc: 'g' });
  const html = integrations.render(R.integ, ctx);
  assert.equal((html.match(/Nicht eingerichtet/g) || []).length, 2);
  assert.match(html, /Notion/);
  assert.match(html, /umsaetze\.csv[\s\S]*24\.11\./);
  assert.match(html, /nicht verbunden/);
  integrations.onClick(click({ a: 'wipe' }), R.integ, ctx);
  assert.equal(db.list(ctx, 'exam').length, 1);
  integrations.onClick(click({ a: 'wipe' }), R.integ, ctx);
  assert.equal(db.list(ctx, 'exam').length, 0);
});

test('Training & Erholung shows its own title and never money or Life OS examples', () => {
  const ctx = mk();
  db.upsert(ctx, 'account', { name: 'Giro', type: 'giro', cur: 'EUR', bal: 123456, asOf: '2026-11-20' });
  db.upsert(ctx, 'exam', { subj: 'Mathe', d: '2026-12-03', time: '08:00' });
  const html = heute.render({ area: 'heute' }, ctx);
  assert.match(html, /<h1>Training &amp; Erholung<\/h1>/);
  assert.doesNotMatch(html, /1\.234|€|Mathe/);
  db.startDemo(ctx, '2026-11-26');
  assert.doesNotMatch(heute.render({ area: 'heute' }, ctx), /Rechnungswesen|Beispiel-/);
});
