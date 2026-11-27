import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';
import * as db from '../js/areas/cockpit/db.js';
import * as projects from '../js/areas/cockpit/projects.js';
import { taskGroups } from '../js/areas/cockpit/logic.js';
import { common } from '../js/areas/cockpit/ui.js';

const mk = (now = new Date(2026, 10, 27, 10, 0)) => {
  const ctx = { store: createStore(memBackend()), now: () => now, rerender() {}, toast() {}, go() {} };
  projects.onNavigate(null, ctx);
  return ctx;
};

test('all open tasks in one list: free, project and school tasks by due date', () => {
  const g = taskGroups({
    free: [{ id: 'f1', text: 'Steuer', due: '2026-11-20', done: false }, { id: 'f2', text: 'Ohne Datum', done: false }, { id: 'f3', text: 'Erledigt', due: '2026-11-25', done: true }],
    ptasks: [{ id: 'p1', proj: 'sensito', text: 'Feedback', due: '2026-11-27', done: false }],
    stasks: [{ id: 's1', subj: 'BWL', text: 'Kapitel 4', due: '2026-12-02', done: false }, { id: 's2', subj: 'Deutsch', text: 'Aufsatz', due: '2026-12-20', done: false }],
    projects: [{ id: 'sensito', name: 'Sensito' }],
  }, '2026-11-27');
  assert.deepEqual(g.groups.map(x => [x.label, x.items.map(i => i.text)]), [
    ['Überfällig', ['Steuer']], ['Heute', ['Feedback']], ['Nächste 7 Tage', ['Kapitel 4']], ['Später', ['Aufsatz']], ['Ohne Datum', ['Ohne Datum']]]);
  const fb = g.groups[1].items[0];
  assert.deepEqual([fb.s, fb.where, fb.href], ['ptask', 'Sensito', '#projekte/p-sensito']);
  assert.deepEqual([g.groups[2].items[0].s, g.groups[2].items[0].where, g.groups[2].items[0].href], ['stask', 'BWL', '#ausbildung/fach?BWL']);
  assert.deepEqual(g.done.map(i => i.text), ['Erledigt']);
});

test('the tasks page: tabs, one list, ticking off, and a free task without a project', () => {
  const ctx = mk();
  db.upsert(ctx, 'stask', { subj: 'BWL', text: 'Kapitel 4', due: '2026-11-26', done: false });
  const r = { area: 'projects', view: 'tasks' };
  let html = projects.render(r, ctx);
  assert.match(html, /<h1>Aufgaben &amp; Projekte<\/h1>/);
  assert.match(html, /<nav class="csub"[^>]*><a href="#aufgaben" class="on" aria-current="page">Aufgaben<\/a><a href="#projekte">Projekte<\/a><a href="#business-log">Business Log<\/a><\/nav>/);
  assert.match(html, /Überfällig[\s\S]*Kapitel 4[\s\S]*BWL · fällig Do 26\.11\. · überfällig/);
  assert.match(projects.render({ area: 'projects', view: 'list' }, ctx), /<a href="#projekte" class="on" aria-current="page">Projekte<\/a>/);
  assert.match(projects.render({ area: 'projects', view: 'log' }, ctx), /<a href="#business-log" class="on" aria-current="page">Business Log<\/a>/);
  common({ dataset: { a: 'fnew', s: 'task', title: 'Aufgabe hinzufügen' } }, ctx);
  html = projects.render(r, ctx);
  assert.match(html, /<h3>Aufgabe hinzufügen<\/h3>/);
  assert.doesNotMatch(html.split('<h3>Aufgabe hinzufügen</h3>')[1].split('</form>')[0], /Projekt/);
  db.upsert(ctx, 'task', { text: 'Steuer machen', due: '', done: false });
  const free = db.list(ctx, 'task')[0];
  html = projects.render(r, ctx);
  assert.match(html, /Ohne Datum[\s\S]*Steuer machen/);
  projects.onChange({ target: { dataset: { a: 'tick', s: 'task', id: free.id }, checked: true, closest: () => null } }, r, ctx);
  assert.equal(db.list(ctx, 'task')[0].done, true);
  assert.match(projects.render(r, ctx), /<summary>Erledigt · 1<\/summary>[\s\S]*Steuer machen/);
});

test('with nothing to do the page says so and offers the first task', () => {
  const html = projects.render({ area: 'projects', view: 'tasks' }, mk());
  assert.match(html, /Keine offenen Aufgaben/);
  assert.match(html, /data-a="fnew" data-s="task"/);
});

import * as calendar from '../js/areas/cockpit/calendar.js';
import { weekDays } from '../js/areas/cockpit/calendar.js';
import * as routines from '../js/areas/routines/index.js';

test('the week runs Monday to Sunday, also across a month and a year', () => {
  assert.deepEqual(weekDays('2026-11-27').map(d => d.d), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
  assert.deepEqual(weekDays('2026-11-29').map(d => d.d)[0], '2026-11-23', 'Sunday still belongs to its week');
  assert.deepEqual(weekDays('2027-01-01').map(d => d.d), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.deepEqual(weekDays('2026-11-30').map(d => d.k), ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']);
});

test('the calendar shows each day with routine, training, exams, due tasks and subscription charges', () => {
  const ctx = mk(new Date(2026, 10, 27, 17, 0));
  db.upsert(ctx, 'exam', { subj: 'Rechnungswesen', d: '2026-11-26', time: '08:00', prep: 'angefangen' });
  db.upsert(ctx, 'task', { text: 'Steuer machen', due: '2026-11-28', done: false });
  db.upsert(ctx, 'sub', { name: 'Streaming', amt: 1299, cur: 'EUR', every: 'monat', next: '2026-11-29', status: 'aktiv' });
  const html = calendar.render({ area: 'calendar', week: null }, ctx);
  assert.match(html, /<h1>Kalender &amp; Routinen<\/h1>/);
  assert.match(html, /<nav class="csub"[^>]*><a href="#kalender" class="on" aria-current="page">Kalender<\/a><a href="#routinen">Routinen<\/a><\/nav>/);
  assert.match(html, /Woche 23\.11\.–29\.11\./);
  const day = d => html.split(`data-day="${d}"`)[1].split('</section>')[0];
  assert.match(day('2026-11-23'), /Lower A/);
  assert.match(day('2026-11-23'), /06:00[\s\S]*Morgenroutine/);
  assert.match(day('2026-11-26'), /Klassenarbeit Rechnungswesen[\s\S]*08:00/);
  assert.match(day('2026-11-28'), /Steuer machen/);
  assert.match(day('2026-11-29'), /Streaming[\s\S]*12,99 €/);
  assert.match(html, /data-day="2026-11-27" class="cday today"/);
  assert.match(html, /Jetzt[\s\S]*Upper B Training[\s\S]*Als Nächstes/);
});

test('other weeks are one tap away, and the routine page links back to the calendar', () => {
  const ctx = mk(new Date(2026, 10, 27, 17, 0));
  const html = calendar.render({ area: 'calendar', week: '2026-12-01' }, ctx);
  assert.match(html, /Woche 30\.11\.–6\.12\./);
  assert.match(html, /href="#kalender\/2026-11-23"[^>]*>‹ Vorwoche/);
  assert.match(html, /href="#kalender\/2026-12-07"[^>]*>Nächste Woche ›/);
  assert.match(html, /href="#kalender"[^>]*>Diese Woche/);
  assert.doesNotMatch(html, /class="cday today"/);
  assert.doesNotMatch(html, /<p class="k">Jetzt<\/p>/, 'now/next only for the current week');
  assert.match(routines.header({ area: 'routines', view: 'today' }), /href="#kalender"[^>]*>Kalender</);
});

import * as goals from '../js/areas/cockpit/goals.js';

test('goals come from the vault folder "02 Ziele", each linking to its note', () => {
  const ctx = mk();
  db.upsert(ctx, 'note', { title: 'Lebensziele', path: '02 Ziele/Lebensziele.md', body: '---\nquelle: notion\n---\n# Lebensziele\n> 🎯 Work in **silence**.\n\nEin Ziel pro Säule.', topic: 'ohne', tags: [], src: 'vault' });
  db.upsert(ctx, 'note', { title: 'Ideen', path: '05 Wissen/Ideen.md', body: 'Text', topic: 'ohne', tags: [], src: 'vault' });
  const id = db.list(ctx, 'note').find(n => n.title === 'Lebensziele').id;
  const html = goals.render({ area: 'goals' }, ctx);
  assert.match(html, /<h1>Ziele &amp; Rückblicke<\/h1>/);
  assert.match(html, new RegExp(`<a class="ccard goal" href="#wissen/n-${id}"><h3>Lebensziele</h3><p>🎯 Work in silence\. Ein Ziel pro Säule\.</p>`));
  assert.doesNotMatch(html, /<h3>Ideen<\/h3>/);
  assert.match(goals.render({ area: 'goals' }, mk()), /Noch keine Ziele[\s\S]*href="#import"/);
});

test('the pillar check-ins as a history, newest first, with the average', () => {
  const ctx = mk();
  db.setRaw(ctx, 'pillars', [{ id: 'k46', d: '2026-11-15', week: 'KW 46', koerper: 6, karriere: 7, business: 4, fokus: 5, netzwerk: 6, src: 'notion' }, { id: 'k47', d: '2026-11-22', week: 'KW 47', koerper: 5, karriere: 6, business: 3, fokus: 5, netzwerk: 4, src: 'notion' }]);
  const html = goals.render({ area: 'goals' }, ctx);
  assert.match(html, /<tr><th>KW 47<\/th><td>5<\/td><td>6<\/td><td>3<\/td><td>5<\/td><td>4<\/td><td><b>4,6<\/b><\/td><\/tr><tr><th>KW 46<\/th>/);
  assert.match(html, /Notion · Check-in 22\.11\./);
});

test('the week review compares this week with the last, each figure with its source', () => {
  const ctx = mk(new Date(2026, 10, 27, 20, 0));
  ctx.store.set('train.sess', { 's_2026-11-23_mo': { day: 'mo', date: '2026-11-23', sets: { pistol: [{ ok: true }] } }, 's_2026-11-24_di': { day: 'di', date: '2026-11-24', sets: { x: [{ ok: false }] } }, 's_2026-11-17_di': { day: 'di', date: '2026-11-17', sets: { x: [{ ok: true }] } } });
  ctx.store.set('rec.morning', { '2026-11-24': { schlaf: 4, energie: 3, muskeln: 4 }, '2026-11-25': { schlaf: 5, energie: 5, muskeln: 5 }, '2026-11-18': { schlaf: 2, energie: 2, muskeln: 2 } });
  ctx.store.set('food.days', { '2026-11-24': { meals: [{ g: 100 }, { g: 60 }] }, '2026-11-26': { meals: [{ g: 140 }] } });
  db.upsert(ctx, 'log', { d: '2026-11-25', proj: 'sensito', text: 'Shop', min: 90, inc: 0, exp: 0 });
  const r = goals.review(ctx, '2026-11-23', '2026-11-27');
  assert.deepEqual([r.training, r.check, r.protein, r.minutes], [1, 13, 150, 90]);
  const html = goals.render({ area: 'goals' }, ctx);
  assert.match(html, /<tr><th>Trainingseinheiten<\/th><td>1<\/td><td>1<\/td><td class="src">Training<\/td><\/tr>/);
  assert.match(html, /<tr><th>Ø Morgen-Check<\/th><td>13,0 \/ 15<\/td><td>6,0 \/ 15<\/td><td class="src">Recovery<\/td><\/tr>/);
  assert.match(html, /<tr><th>Ø Protein<\/th><td>150 g<\/td><td>–<\/td>/);
  assert.match(html, /<tr><th>Arbeitsstunden<\/th><td>1:30 h<\/td>/);
  assert.match(html, /Diese Woche \(Mo 23\.11\.–Fr 27\.11\.\)[\s\S]*Vorwoche/);
});
