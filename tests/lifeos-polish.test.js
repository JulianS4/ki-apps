import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';
import { memBlobs } from '../js/areas/body/photos.js';
import * as db from '../js/areas/cockpit/db.js';
import * as home from '../js/areas/cockpit/home.js';
import * as finance from '../js/areas/cockpit/finance.js';
import * as projects from '../js/areas/cockpit/projects.js';
import * as integrations from '../js/areas/cockpit/integrations.js';
import * as importPage from '../js/areas/cockpit/imports.js';
import { planImport, applyImport } from '../js/areas/cockpit/lifeimport.js';

const mk = (now = new Date(2026, 10, 27, 20, 0)) => {
  const ctx = { store: createStore(memBackend()), now: () => now, rerender() {}, toast() {}, go() {} };
  for (const a of [home, finance, projects, integrations]) a.onNavigate(null, ctx);
  return ctx;
};
const widget = (html, k) => (html.split(`data-w="${k}"`)[1] || '').split('<section class="w ')[0];
const FILE = () => ({
  app: 'life-os-import', v: 1, created: '2026-11-27T19:00:00.000Z',
  sources: { notion: { name: 'Notion', at: '2026-11-27T18:58:00.000Z' }, obsidian: { name: 'Obsidian · Vault', at: '2026-11-27T18:59:00.000Z' } },
  notion: {
    accounts: [{ id: 'na1', name: 'Girokonto', type: 'giro', cur: 'EUR', hist: [{ d: '2026-10-21', c: 120000 }] }],
    cats: [], budgets: {}, tx: [],
    projects: [{ id: 'np1', name: 'Sensito', status: 'aktiv', goal: 'Content planen' }],
    log: [{ id: 'nl1', d: '2026-11-20', proj: 'np1', text: 'Shop eingerichtet', min: 90, inc: 0, exp: 0 }],
    pillars: [], notes: [],
  },
  obsidian: { vault: 'Vault', notes: [{ path: 'Ziel A.md', text: 'Text' }], skipped: [] },
});

test('a file without a Notion part leaves the Notion entries and their date alone', async () => {
  const ctx = mk();
  await applyImport(ctx, planImport(ctx, FILE()), memBlobs());
  const f = FILE();
  delete f.notion;
  delete f.sources.notion;
  f.obsidian.notes.push({ path: 'Ziel B.md', text: 'Mehr' });
  const plan = planImport(ctx, f);
  assert.deepEqual(plan.rows, []);
  await applyImport(ctx, plan, memBlobs());
  assert.deepEqual(db.list(ctx, 'account').map(a => [a.name, a.src]), [['Girokonto', 'notion']]);
  assert.equal(db.list(ctx, 'log').length, 1);
  assert.equal(db.getRaw(ctx, 'sources').notion.at, '2026-11-27T18:58:00.000Z');
  assert.equal(db.getRaw(ctx, 'sources').obsidian.notes, 2);
});

test('a project renamed in Notion keeps its place: tasks and log entries stay linked', async () => {
  const ctx = mk();
  await applyImport(ctx, planImport(ctx, FILE()), memBlobs());
  const id = db.list(ctx, 'project').find(p => p.name === 'Sensito').id;
  db.upsert(ctx, 'ptask', { proj: id, text: 'Feedback', done: false });
  const f = FILE();
  f.notion.projects[0].name = 'Sensito App';
  await applyImport(ctx, planImport(ctx, f), memBlobs());
  const ps = db.list(ctx, 'project').filter(p => p.src === 'notion');
  assert.deepEqual(ps.map(p => [p.id, p.name]), [[id, 'Sensito App']]);
  assert.equal(db.list(ctx, 'ptask')[0].proj, id);
  assert.equal(db.list(ctx, 'log')[0].proj, id);
});

test('what comes from Notion shows where to change it instead of a button that only says no', async () => {
  const ctx = mk();
  await applyImport(ctx, planImport(ctx, FILE()), memBlobs());
  db.upsert(ctx, 'account', { name: 'Bargeld', type: 'bar', cur: 'EUR', bal: 2000, asOf: '2026-11-01' });
  const html = finance.render({ area: 'finance', view: 'overview' }, ctx);
  const row = name => html.split(`<b>${name}</b>`)[1].split('</li>')[0];
  assert.doesNotMatch(row('Girokonto'), /data-a="fedit"/);
  assert.match(row('Girokonto'), /class="ed ro"[^>]*>in Notion ändern</);
  assert.match(row('Bargeld'), /data-a="fedit"[^>]*>Stand ändern</);
  assert.match(html, /Kontostände aus Notion änderst du in Notion/);
  const id = db.list(ctx, 'project').find(p => p.src === 'notion').id;
  const proj = projects.render({ area: 'projects', view: 'project', id }, ctx);
  assert.doesNotMatch(proj, /data-a="fedit" data-s="project"/);
  assert.match(proj, /in Notion ändern/);
  const log = projects.render({ area: 'projects', view: 'log' }, ctx);
  assert.match(log, /Shop eingerichtet<\/b><small>[^<]*· Notion</);
  assert.doesNotMatch(log, /data-a="fedit" data-s="log"/);
});

test('a project from Notion has no progress, so no 0 % ring or bar is shown for it', async () => {
  const ctx = mk();
  await applyImport(ctx, planImport(ctx, FILE()), memBlobs());
  const card = projects.render({ area: 'projects', view: 'list' }, ctx).split('<h2>Sensito</h2>')[1].split('</a>')[0];
  assert.doesNotMatch(card, /0 % ·|Fortschritt 0 Prozent/);
  assert.match(card, /Ziel: Content planen/);
  const li = widget(home.render({ area: 'cockpit' }, ctx), 'projects').split('<li>').find(x => /<b>Sensito<\/b>/.test(x));
  assert.doesNotMatch(li, /0 %/);
  db.upsert(ctx, 'project', { name: 'Eigenes', status: 'aktiv', prog: 40 });
  assert.match(projects.render({ area: 'projects', view: 'list' }, ctx), /40 % ·/);
});

test('an old Notion import shows up under "Jetzt wichtig" with the way to a new file', async () => {
  const ctx = mk();
  await applyImport(ctx, planImport(ctx, FILE()), memBlobs());
  assert.doesNotMatch(widget(home.render({ area: 'cockpit' }, ctx), 'agenda'), /Life OS aktualisieren/);
  const later = mk(new Date(2026, 11, 8, 9, 0));
  later.store = ctx.store;
  const agenda = widget(home.render({ area: 'cockpit' }, later), 'agenda');
  assert.match(agenda, /href="#import"[\s\S]*Notion-Stand vom 27\.11\.[\s\S]*„Life OS aktualisieren“/);
});

test('the empty start leads to the import and the examples', () => {
  const html = home.render({ area: 'cockpit' }, mk());
  const intro = html.split('class="ccard intro"')[1].split('</section>')[0];
  assert.match(intro, /<a class="btn pri" href="#import">Datei importieren<\/a>/);
  assert.match(intro, /data-a="demostart"/);
  assert.match(intro, /Life OS aktualisieren/);
});

test('texts about Notion say what it brings, with one full stop after the date', async () => {
  const ctx = mk();
  assert.doesNotMatch(importPage.render({ area: 'import' }, ctx), /Textseiten/);
  await applyImport(ctx, planImport(ctx, FILE()), memBlobs());
  const set = integrations.render({ area: 'integrations' }, ctx);
  assert.doesNotMatch(set, /Textseiten|\.\./);
  assert.match(set, /Zuletzt eingespielt: Fr 27\.11\.</);
});

test('the pillar tile is called "Fünf Säulen" and the examples fill it', () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-27');
  const w = widget(home.render({ area: 'cockpit' }, ctx), 'pillars');
  assert.match(w, /<\/span>Fünf Säulen<\/h2>/);
  assert.match(w, /Ø \d,\d von 10 · Vorwoche \d,\d/);
  assert.match(w, /Beispieldaten · Check-in/);
  assert.doesNotMatch(w, /(\d{1,2}\.\d{1,2}\.)[^<]*<span class="src">[^<]*Check-in \1/, 'the date is said once');
});

test('after an update the offline cache never mixes old and new files', async () => {
  const { readFileSync } = await import('node:fs');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /c\.addAll\(FILES\.map\(f => new Request\(f, \{ cache: 'reload' \}\)\)\)/, 'install skips the browser cache');
  assert.match(sw, /fetch\(e\.request, \{ cache: 'no-cache' \}\)/, 'own files are checked with the server on every load');
});
