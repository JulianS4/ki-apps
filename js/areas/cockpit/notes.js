// Wissen: notes with tags, areas, [[links]], backlinks and a search that never waits.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import * as db from './db.js';
import { searchNotes, noteLinks, findNote } from './logic.js';
import { TOPICS, label } from './data.js';
import { banner, hero, empty, newBtn, editBtn, seg, formIf, common, target, edInput, openEd, onNavigateCommon, mountCommon, blurActive } from './ui.js';

let q = '', topic = '';
const UN = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const unesc = s => s.replace(/&(amp|lt|gt|quot|#39);/g, m => UN[m]);
const plain = s => s.replace(/\[\[([^[\]]+?)\]\]/g, '$1').replace(/\s+/g, ' ').trim();

function results(ctx) {
  const all = db.list(ctx, 'note').sort((a, b) => ((a.upd || '') < (b.upd || '') ? 1 : -1)), hits = searchNotes(all.filter(n => !topic || n.topic === topic), q);
  if (!all.length) return empty('Noch keine Notizen. Sammle hier Wissen zu Business, KI, Ausbildung, Finanzen, Training und Ideen – und verknüpfe es mit [[Titel]].');
  if (!hits.length) return '<p class="note">Nichts gefunden.</p>';
  return `<ul class="crows card-l">${hits.map(n => `<li><a class="nm" href="#wissen/n-${esc(n.id)}"><b>${esc(n.title)}</b><small>${esc(label(TOPICS, n.topic))}${n.tags.length ? ' · ' + esc(n.tags.map(t => '#' + t).join(' ')) : ''}${n.upd ? ' · ' + dfmt(n.upd) : ''}</small>${n.body ? `<small class="snip">${esc(plain(n.body).slice(0, 140))}</small>` : ''}</a></li>`).join('')}</ul>`;
}

function listView(ctx) {
  const all = db.list(ctx, 'note'), tags = [...new Set(all.flatMap(n => n.tags))].sort((a, b) => a.localeCompare(b, 'de'));
  return `${hero('Wissen', 'Notizen', `${all.length} ${all.length === 1 ? 'Notiz' : 'Notizen'} · durchsuchbar, verknüpfbar, exportierbar`)}
  <section class="blk"><input class="tx search" type="search" data-a="q" value="${esc(q)}" placeholder="Suchen … (#tag für Tags)" aria-label="Notizen durchsuchen">
  ${seg('ntopic', [['', 'Alle'], ...TOPICS], topic)}
  ${formIf(ctx, 'note')}<div class="tools">${newBtn('note', 'Notiz', topic ? { topic } : null)}<a class="btn" href="#integrationen">Export ›</a></div>
  <div id="nres" aria-live="polite">${results(ctx)}</div></section>
  ${tags.length ? `<section class="blk"><div class="bh"><h2>Tags</h2></div><div class="chips">${tags.map(t => `<button class="chipb${q === '#' + t ? ' on' : ''}" type="button" data-a="tagq" data-v="${esc(t)}">#${esc(t)}</button>`).join('')}</div></section>` : ''}`;
}

// Escaped text with paragraphs, [[links]] (missing ones offer to create the note) and web links.
function bodyHtml(body, notes) {
  return esc(body).split(/\n{2,}/).map(par => `<p>${par.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\[\[([^[\]]+?)\]\]/g, (m, t) => { const title = unesc(t).trim(), n = findNote(notes, title); return n ? `<a class="wl" href="#wissen/n-${esc(n.id)}">${esc(title)}</a>` : `<button class="wl miss" type="button" data-a="mknote" data-t="${esc(title)}" title="Notiz anlegen">${esc(title)} ＋</button>`; })
    .replace(/\n/g, '<br>')}</p>`).join('');
}

function noteView(ctx, id) {
  const notes = db.list(ctx, 'note'), n = notes.find(x => x.id === id);
  if (!n) return `${hero('Wissen', 'Notiz nicht gefunden')}<p><a class="back" href="#wissen">‹ Zu den Notizen</a></p>`;
  const { out, back } = noteLinks(n, notes), ps = db.list(ctx, 'project').filter(p => n.projects.includes(p.id));
  return `${hero(esc(label(TOPICS, n.topic)), esc(n.title), `${n.created ? 'erstellt ' + dfmt(n.created) : ''}${n.upd ? ' · geändert ' + dfmt(n.upd) : ''}${n.src === 'beispiel' ? ' · Beispiel' : ''}`)}<a class="back" href="#wissen">‹ Notizen</a>
  ${formIf(ctx, 'note')}
  <section class="blk"><article class="ex nbody">${n.body ? bodyHtml(n.body, notes) : '<p class="note">Noch kein Inhalt.</p>'}</article><div class="tools">${editBtn('note', n.id)}</div></section>
  ${n.tags.length || ps.length ? `<section class="blk"><div class="chips">${n.tags.map(t => `<a class="chipb" href="#wissen" data-a="tagq" data-v="${esc(t)}">#${esc(t)}</a>`).join('')}${ps.map(p => `<a class="chipb on" href="#projekte/p-${esc(p.id)}">${esc(p.name)}</a>`).join('')}</div></section>` : ''}
  ${out.length ? `<section class="blk"><div class="bh"><h2>Verlinkt</h2></div><ul class="crows card-l">${out.map(l => `<li>${l.id ? `<a class="nm" href="#wissen/n-${esc(l.id)}"><b>${esc(l.title)}</b></a>` : `<div class="nm"><b>${esc(l.title)}</b><small>gibt es noch nicht</small></div>`}</li>`).join('')}</ul></section>` : ''}
  <section class="blk"><div class="bh"><h2>Verweise hierher</h2><p>${back.length}</p></div>${back.length ? `<ul class="crows card-l">${back.map(b => `<li><a class="nm" href="#wissen/n-${esc(b.id)}"><b>${esc(b.title)}</b><small>${esc(label(TOPICS, b.topic))}</small></a></li>`).join('')}</ul>` : '<p class="note">Keine andere Notiz verweist hierher.</p>'}</section>`;
}

export function render(route, ctx) { return banner(ctx) + (route.view === 'note' ? noteView(ctx, route.id) : listView(ctx)); }
export function onClick(e, route, ctx) {
  const t = target(e);
  if (!t || common(t, ctx)) return;
  const a = t.dataset.a;
  if (a === 'mknote') {
    const cur = route.view === 'note' ? db.find(ctx, 'note', route.id) : null;
    openEd(ctx, 'note', null, { title: t.dataset.t, topic: cur ? cur.topic : 'privat' });
  } else if (a === 'tagq') { q = q === '#' + t.dataset.v ? '' : '#' + t.dataset.v; if (route.view === 'note') ctx.go('#wissen'); }
  else if (a === 'ntopic') topic = t.dataset.v;
  else return;
  blurActive();
  ctx.rerender();
}
// The search redraws only its results, so typing keeps focus and keyboard.
export function onInput(e, route, ctx) {
  const t = e.target;
  if (edInput(t)) return;
  if (t.dataset && t.dataset.a === 'q') {
    q = t.value;
    const el = typeof document !== 'undefined' && document.getElementById('nres');
    if (el) el.innerHTML = results(ctx);
  }
}
export function onChange(e) { edInput(e.target); }
export function onNavigate(next) { onNavigateCommon(); if (!next || next.area !== 'notes') { q = ''; topic = ''; } }
export function mount() { mountCommon(); }
