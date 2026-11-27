import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';
import * as db from '../js/areas/cockpit/db.js';
import { ask, knowledgeBox, kbInput, kbReset } from '../js/areas/cockpit/knowledge.js';
import * as home from '../js/areas/cockpit/home.js';
import * as finance from '../js/areas/cockpit/finance.js';
import * as school from '../js/areas/cockpit/school.js';
import * as projects from '../js/areas/cockpit/projects.js';
import * as agents from '../js/areas/cockpit/agents.js';

const mk = () => {
  const ctx = { store: createStore(memBackend()), now: () => new Date(2026, 10, 26, 9, 0), rerender() {}, toast() {}, go() {} };
  kbReset();
  return ctx;
};
const note = (ctx, title, body, extra = {}) => db.upsert(ctx, 'note', { title, body, tags: [], topic: 'privat', projects: [], ...extra });

function seed(ctx) {
  note(ctx, 'Finanzplan 2027', '# Sparen\nMein Sparziel für 2027 sind 3.000 € auf dem Tagesgeld.\n\n# Abos\nStreaming kündigen, wenn es teurer wird.', { topic: 'finanzen' });
  note(ctx, 'BWL Kapitel 3', '## Kostenrechnung\nDie Deckungsbeitragsrechnung trennt fixe und variable Kosten.', { tags: ['bwl'], topic: 'ausbildung' });
  note(ctx, 'Sensito Marketing', 'Für Sensito zuerst Instagram testen, dann Newsletter. Preise über 20 € wirken hochwertig.');
}

test('a question finds the passage that answers it, with its note and section, terms marked', () => {
  const ctx = mk();
  seed(ctx);
  const r = ask(db.list(ctx, 'note'), 'Wie hoch ist mein Sparziel?');
  assert.equal(r.hits[0].note.title, 'Finanzplan 2027');
  assert.equal(r.hits[0].heading, 'Sparen');
  assert.match(r.hits[0].excerpt, /Mein <mark>Sparziel<\/mark> für 2027 sind 3\.000 € auf dem Tagesgeld\./);
  assert.ok(r.hits.every(h => h.note.title === 'Finanzplan 2027'));
});

test('case, umlauts and word endings do not matter; parts of compound words are found', () => {
  const ctx = mk();
  seed(ctx);
  const notes = db.list(ctx, 'note');
  assert.equal(ask(notes, 'deckungsbeitrag').hits[0].note.title, 'BWL Kapitel 3');
  assert.equal(ask(notes, 'KOSTENRECHNUNGEN').hits[0].heading, 'Kostenrechnung');
  assert.equal(ask(notes, 'ziel').hits[0].note.title, 'Finanzplan 2027');
});

test('when the notes do not cover the question, there is no hit', () => {
  const ctx = mk();
  seed(ctx);
  const notes = db.list(ctx, 'note');
  assert.deepEqual(ask(notes, 'Wann ist die Steuererklärung fällig?').hits, []);
  assert.deepEqual(ask(notes, 'Sparziel Steuererklärung Frist').hits, []);
  assert.deepEqual(ask(notes, 'und oder der').hits, []);
  assert.deepEqual(ask([], 'Sparziel').hits, []);
});

test('new and changed notes count right away', () => {
  const ctx = mk();
  seed(ctx);
  assert.deepEqual(ask(db.list(ctx, 'note'), 'Steuererklärung').hits, []);
  const n = note(ctx, 'Steuern', 'Die Steuererklärung ist bis 31. Juli fällig.');
  assert.equal(ask(db.list(ctx, 'note'), 'Steuererklärung').hits[0].note.id, n.id);
  db.upsert(ctx, 'note', { ...n, body: 'Nichts mehr dazu.' });
  assert.deepEqual(ask(db.list(ctx, 'note'), 'Steuererklärung fällig').hits, []);
});

test('the box: sources open the note at the right place; nothing found says so and offers a note', () => {
  const ctx = mk();
  seed(ctx);
  const html = knowledgeBox(ctx, { id: 't', about: 'Sparen', q: 'Sparziel' });
  assert.match(html, /<h2 id="kbh-t">Aus deinem Wissen<\/h2>/);
  assert.match(html, /<a class="ksrc" href="#wissen\/n-[\w-]+\?h=sparen">Quelle: Finanzplan 2027 › Sparen<\/a>/);
  assert.match(html, /Life OS erfindet nichts dazu/);
  const none = knowledgeBox(ctx, { id: 'u', about: 'Steuern', q: 'Steuererklärung' });
  assert.match(none, /Dein Wissen enthält nichts zu „Steuern“\./);
  assert.match(none, /data-a="fnew" data-s="note"[^>]*>Notiz zu „Steuern“ anlegen</);
  assert.match(knowledgeBox(mk(), { id: 'v', q: 'x' }), /Noch keine Notizen\.[\s\S]*href="#wissen"/);
});

test('typing a question in the box redraws only its results', () => {
  const ctx = mk();
  seed(ctx);
  const el = { innerHTML: '' };
  globalThis.document = { getElementById: id => (id === 'kb-t' ? el : null) };
  try {
    knowledgeBox(ctx, { id: 't', about: 'Sparen', q: 'Sparziel' });
    assert.equal(kbInput({ dataset: { a: 'kq', kb: 't' }, value: 'Instagram' }, ctx), true);
    assert.match(el.innerHTML, /Quelle: Sensito Marketing/);
    assert.match(knowledgeBox(ctx, { id: 't', about: 'Sparen', q: 'Sparziel' }), /value="Instagram"/);
    assert.equal(kbInput({ dataset: { a: 'q' }, value: 'x' }, ctx), false);
  } finally { delete globalThis.document; }
});

test('every area uses the shared notes: overview, finances, training, school, projects, business log, agents', () => {
  const ctx = mk();
  seed(ctx);
  db.upsert(ctx, 'exam', { subj: 'BWL', d: '2026-12-02', prep: 'offen' });
  const sensito = db.list(ctx, 'project').find(p => p.name === 'Sensito');
  db.upsert(ctx, 'agent', { name: 'Newsletter-Agent', job: 'schreibt den Newsletter', status: 'bereit' });
  const box = html => html.split('Aus deinem Wissen')[1] || '';
  assert.match(home.render({ area: 'cockpit' }, ctx), /data-a="kq" data-kb="home"/);
  assert.match(box(finance.render({ area: 'finance', view: 'overview' }, ctx)), /Quelle: Finanzplan 2027/);
  assert.match(box(school.render({ area: 'school', view: 'overview' }, ctx)), /Zu „BWL[^“]*“[\s\S]*Quelle: BWL Kapitel 3/);
  assert.match(box(school.render({ area: 'school', view: 'subject', subj: 'BWL' }, ctx)), /Quelle: BWL Kapitel 3/);
  assert.match(box(projects.render({ area: 'projects', view: 'project', id: sensito.id }, ctx)), /Quelle: Sensito Marketing/);
  assert.match(projects.render({ area: 'projects', view: 'log' }, ctx), /Aus deinem Wissen/);
  assert.match(box(agents.render({ area: 'agents' }, ctx)), /Quelle: Sensito Marketing/);
});
