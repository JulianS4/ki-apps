import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';
import * as db from '../js/areas/cockpit/db.js';
import * as home from '../js/areas/cockpit/home.js';
import { ring, pills } from '../js/areas/cockpit/charts.js';

const mk = () => {
  const ctx = { store: createStore(memBackend()), now: () => new Date(2026, 10, 26, 9, 0), rerender() {}, toast() {}, go() {} };
  home.onNavigate(null, ctx);
  return ctx;
};
const R = { area: 'cockpit' };
const widget = (html, k) => (html.split(`data-w="${k}"`)[1] || '').split('<section class="w ')[0];

test('a ring says what it measures in words and fills to the share, never past full', () => {
  const r = ring(25, { label: 'Sätze heute', value: '6/24', sub: 'Sätze' });
  assert.match(r, /role="img" aria-label="Sätze heute: 6\/24 Sätze"/);
  const c = (2 * Math.PI * 52).toFixed(1);
  assert.match(r, new RegExp(`class="gv"[^>]*stroke-dasharray="${(2 * Math.PI * 52 / 4).toFixed(1)} ${c}"`));
  assert.match(ring(180, { label: 'x', value: '180 %' }), new RegExp(`stroke-dasharray="${c} ${c}"`));
  assert.doesNotMatch(ring(0, { label: 'x', value: '0' }), /class="gd"/);
  assert.match(ring(NaN, { label: 'x', value: '–' }), /stroke-dasharray="0\.0 /);
});

test('pill bars: heights relative to the largest, values in the label, covered amounts stay covered', () => {
  const items = [{ label: 'KW 45', v: 50 }, { label: 'KW 46', v: 100 }, { label: 'KW 47', v: 0 }];
  const p = pills(items, { label: 'Stunden', fmt: v => `${v} min` });
  assert.match(p, /role="img" aria-label="Stunden – KW 45: 50 min, KW 46: 100 min, KW 47: 0 min"/);
  assert.match(p, /<i style="height:50\.0%"><\/i>[\s\S]*<i style="height:100\.0%"><\/i>[\s\S]*<i style="height:0%"><\/i>/);
  assert.match(pills(items, { label: 'Ausgaben', fmt: v => `${v} €`, hide: true }), /KW 45: verdeckt/);
  assert.match(pills([{ label: 'a', v: 0 }], { label: 'x' }), /Keine Werte in diesem Zeitraum/);
});

test('the overview is a dashboard of tiles, each with its title and the way to its area', () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-26');
  const html = home.render(R, ctx);
  assert.match(html, /<div class="bento">/);
  const keys = [...html.matchAll(/data-w="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(keys, ['agenda', 'money', 'month', 'train', 'school', 'projects', 'log', 'agents', 'pillars', 'wissen']);
  for (const [k, href] of [['money', '#finanzen'], ['month', '#finanzen'], ['train', '#heute'], ['school', '#ausbildung'], ['projects', '#projekte'], ['log', '#business-log'], ['agents', '#agents'], ['wissen', '#wissen']]) {
    assert.match(widget(html, k), new RegExp(`<a class="wgo" href="${href}"`), k);
  }
  assert.doesNotMatch(html, /<details class="dsc"/);
});

test('money tiles: figures covered until shown, the month as a ring of the budget, sources named', () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-26');
  let html = home.render(R, ctx);
  assert.match(widget(html, 'money'), /<b class="big">•••• €<\/b>/);
  assert.match(widget(html, 'money'), /class="spark"[^>]*role="img"/);
  assert.match(widget(html, 'money'), /Beispieldaten · Stand/);
  assert.match(widget(html, 'month'), /aria-label="Budget genutzt: \d+ %/);
  assert.match(widget(html, 'month'), /aus \d+ Buchungen/);
  home.onClick({ target: { closest: () => ({ dataset: { a: 'shown' } }) } }, R, ctx);
  html = home.render(R, ctx);
  assert.doesNotMatch(widget(html, 'money'), /•••• €/);
});

test('training, school, projects, business log, agents and knowledge each show their own measure', () => {
  const ctx = mk();
  db.startDemo(ctx, '2026-11-26');
  const html = home.render(R, ctx);
  assert.match(widget(html, 'train'), /aria-label="Sätze heute: \d+\/\d+/);
  assert.match(widget(html, 'school'), /class="count"><b>\d+<\/b><span>Tage<\/span>|class="count"><b>(heute|morgen)<\/b>/);
  assert.match(widget(html, 'projects'), /aria-label="Sensito: \d+ % Fortschritt"/);
  assert.match(widget(html, 'log'), /<b class="big">\d+:\d\d h<\/b>/);
  assert.match(widget(html, 'log'), /class="pills"/);
  assert.match(widget(html, 'agents'), /nicht verbunden/);
  assert.match(widget(html, 'wissen'), /<a class="brainlink" href="#wissen"[^>]*><div class="brain mini" data-brain="mini">/);
  assert.match(widget(html, 'wissen'), /4 Notizen · 2 Verbindungen/);
});

test('an empty Life OS still shows every tile with what to do', () => {
  const html = home.render(R, mk());
  assert.match(widget(html, 'money'), /Noch kein Konto eingetragen/);
  assert.match(widget(html, 'month'), /Noch keine Buchungen in diesem Monat/);
  assert.match(widget(html, 'wissen'), /Noch keine Notizen/);
  assert.doesNotMatch(html, /NaN|undefined/);
});

test('the five pillars from the Notion check-in: one ring each, the average, and where they come from', () => {
  const ctx = mk();
  db.setRaw(ctx, 'pillars', [{ id: 'k46', d: '2026-11-15', week: 'KW 46', koerper: 6, karriere: 7, business: 4, fokus: 5, netzwerk: 6, src: 'notion' }, { id: 'k47', d: '2026-11-22', week: 'KW 47', koerper: 5, karriere: 6, business: 3, fokus: 5, netzwerk: 4, src: 'notion' }]);
  const w = widget(home.render(R, ctx), 'pillars');
  for (const [l, v] of [['Körper', 5], ['Karriere', 6], ['Business', 3], ['Fokus', 5], ['Netzwerk', 4]]) assert.match(w, new RegExp(`aria-label="${l}: ${v} von 10`));
  assert.match(w, /Ø 4,6 von 10 · Vorwoche 5,6/);
  assert.match(w, /KW 47 · <span class="src">Notion · Check-in 22\.11\./);
  assert.match(widget(home.render(R, mk()), 'pillars'), /Noch kein Check-in/);
});

test('a budget from Notion shows before the first booking, and sources say Notion', () => {
  const ctx = mk();
  db.setRaw(ctx, 'cats', [{ id: 'nc-essen', name: 'Essen', kind: 'ausgabe', src: 'notion' }]);
  db.setRaw(ctx, 'budgets', { 'nc-essen': 25000 });
  db.setRaw(ctx, 'projects', [{ id: 'sensito', name: 'Sensito', status: 'aktiv', goal: 'Content', prog: 0, notes: '', links: [], src: 'notion', upd: '2026-11-27' }]);
  const html = home.render(R, ctx);
  assert.match(widget(html, 'month'), /aria-label="Budget genutzt: 0 %/);
  assert.match(widget(html, 'month'), /Noch keine Buchungen in diesem Monat/);
  assert.match(widget(html, 'projects'), /Notion · aktualisiert 27\.11\./);
});
