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
