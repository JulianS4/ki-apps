// Wissen: notes as linked files, like an Obsidian vault. A graph of the [[links]],
// the folders as a file list, a search that never waits, the vault import with a
// preview, and each note rendered from its Markdown with its links and backlinks.
import { esc } from '../../core/html.js';
import { dfmt, dshort } from '../../core/dates.js';
import * as db from './db.js';
import { searchNotes, norm } from './logic.js';
import { TOPICS, label } from './data.js';
import { banner, hero, empty, newBtn, editBtn, seg, formIf, common, target, edInput, openEd, onNavigateCommon, mountCommon, blurActive, today, DEMO_NO_IMPORT } from './ui.js';
import { zip, notesMarkdown } from './zip.js';
import { makeResolver, noteLinks, renderMd, parseProps, plainText } from './md.js';
import { cachedGraph, graphSvg, localGraph, layout, bindGraphs, graphZoom, markHits, resetView } from './graph.js';
import { readZipVault, planVault, applyVault, takeConflict, removeVault, localChanged, openable, MAX_ZIP, ATT_STORE } from './vault.js';
import { idbBlobs } from '../body/photos.js';

let q = '', topic = '', msg = '', imp = null, confirmRemove = false, scrolled = '';
const flip = new Set(); // folders opened or closed against their default

// Attachments live in IndexedDB; tests hand in a memory store.
let files;
export const setVaultStore = s => { files = s; };
function vaultStore() {
  if (files === undefined) { try { files = idbBlobs(ATT_STORE.name, ATT_STORE.store); } catch (e) { files = null; } }
  return files;
}

const atts = ctx => db.getRaw(ctx, 'vatt', []) || [];
const dirOf = p => p.slice(0, Math.max(0, p.lastIndexOf('/')));
const filtered = ctx => db.list(ctx, 'note').filter(n => !topic || n.topic === topic);
const meta = n => [n.path || label(TOPICS, n.topic), n.tags.length ? n.tags.map(t => '#' + t).join(' ') : '', localChanged(n) ? 'in Life OS geändert' : ''].filter(Boolean).join(' · ');
const noteRow = n => `<li><a class="nm" href="#wissen/n-${esc(n.id)}"><b>${esc(n.title)}</b><small>${esc(meta(n))}</small></a></li>`;
const byTitle = (a, b) => a.title.localeCompare(b.title, 'de');

// The frame follows the page width so that one unit is about one pixel.
function frame(local) {
  const m = typeof document !== 'undefined' && document.getElementById('main'), cw = m && m.clientWidth ? m.clientWidth : 1000;
  const w = Math.max(320, Math.min(1120, Math.round(cw / 40) * 40));
  return local ? { w, h: w < 640 ? Math.round(w * 0.8) : 340 } : { w, h: w < 640 ? Math.round(w * 1.15) : Math.min(640, Math.round(w * 0.6)) };
}
const toolbar = key => `<div class="kgt" role="group" aria-label="Graph bewegen"><button class="btn sm" type="button" data-a="gz" data-k="${key}" data-v="in" aria-label="Vergrößern">＋</button><button class="btn sm" type="button" data-a="gz" data-k="${key}" data-v="out" aria-label="Verkleinern">−</button><button class="btn sm" type="button" data-a="gz" data-k="${key}" data-v="fit">Einpassen</button></div>`;

// ---- file list: folders of the vault, then the notes written in Life OS ----
function tree(notes) {
  const root = { dirs: new Map(), notes: [] };
  for (const n of notes.filter(x => x.path)) {
    let d = root;
    for (const s of n.path.split('/').slice(0, -1)) { if (!d.dirs.has(s)) d.dirs.set(s, { dirs: new Map(), notes: [] }); d = d.dirs.get(s); }
    d.notes.push(n);
  }
  const count = d => d.notes.length + [...d.dirs.values()].reduce((a, x) => a + count(x), 0);
  const dir = (name, d, key, depth) => {
    const open = (depth === 0) !== flip.has(key);
    return `<details class="fold"${open ? ' open' : ''}><summary data-a="fold" data-k="${esc(key)}">${esc(name)} <small>${count(d)}</small></summary><ul class="crows">${body(d, key, depth + 1)}</ul></details>`;
  };
  const body = (d, key, depth) => [...d.dirs].sort((a, b) => a[0].localeCompare(b[0], 'de')).map(([k, v]) => `<li class="sub">${dir(k, v, key ? `${key}/${k}` : k, depth)}</li>`).join('') + d.notes.sort(byTitle).map(noteRow).join('');
  const own = notes.filter(n => !n.path).sort(byTitle), vault = body(root, '', 0);
  return `${vault ? `<ul class="crows card-l ftree">${vault}</ul>` : ''}${own.length ? `<ul class="crows card-l ftree"><li class="sub"><details class="fold"${flip.has('_own') ? '' : ' open'}><summary data-a="fold" data-k="_own">In Life OS angelegt <small>${own.length}</small></summary><ul class="crows">${own.map(noteRow).join('')}</ul></details></li></ul>` : ''}`;
}
function results(ctx) {
  const all = filtered(ctx);
  if (!db.list(ctx, 'note').length) return '';
  if (!q.trim()) return tree(all);
  const hits = searchNotes(all, q);
  if (!hits.length) return `<p class="note">Nichts gefunden zu „${esc(q)}“.</p>`;
  return `<p class="note">${hits.length} ${hits.length === 1 ? 'Treffer' : 'Treffer'}</p><ul class="crows card-l">${hits.map(n => `<li><a class="nm" href="#wissen/n-${esc(n.id)}"><b>${esc(n.title)}</b><small>${esc(meta(n))}${n.upd ? ' · ' + dfmt(n.upd) : ''}</small>${n.body ? `<small class="snip">${esc(plainText(n.body).slice(0, 160))}</small>` : ''}</a></li>`).join('')}</ul>`;
}
const hitIds = ctx => (q.trim() ? new Set(searchNotes(filtered(ctx), q).map(n => n.id)) : null);

// ---- the vault import: choose, preview, write, report ----
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function skippedHtml(plan) {
  if (!plan.skipped.length) return '';
  const groups = new Map();
  for (const s of plan.skipped) { const g = groups.get(s.why) || { paths: [], n: 0 }; g.paths.push(s.path); g.n += s.n || 1; groups.set(s.why, g); }
  const total = plan.skipped.reduce((a, s) => a + (s.n || 1), 0);
  return `<details class="dsc"><summary><span class="tx2"><b>${total} ${total === 1 ? 'Datei wird' : 'Dateien werden'} nicht übernommen</b><small>mit Grund je Datei</small></span></summary><div class="dbody"><ul class="crows">${[...groups].map(([why, g]) => `<li><div class="nm"><b>${esc(why)}</b><small>${g.paths.slice(0, 8).map(esc).join(' · ')}${g.paths.length > 8 ? ` · und ${g.paths.length - 8} weitere` : ''}</small></div><span class="vr">${g.n}</span></li>`).join('')}</ul></div></details>`;
}
function unresolvedHtml(plan) {
  const u = plan.unresolved;
  if (!u.length) return '';
  return `<details class="dsc"><summary><span class="tx2"><b>${u.length} ${u.length === 1 ? 'Link ohne Ziel' : 'Links ohne Ziel'}</b><small>zeigen auf Notizen oder Anhänge, die es nicht gibt – in der Notiz als „Notiz anlegen“ bzw. „Anhang fehlt“</small></span></summary><div class="dbody"><ul class="crows">${u.slice(0, 60).map(x => `<li><div class="nm"><b>„${esc(x.from)}“ → [[${esc(x.t)}]]</b></div></li>`).join('')}</ul>${u.length > 60 ? `<p class="note">und ${u.length - 60} weitere</p>` : ''}</div></details>`;
}
function importBox(ctx) {
  if (!imp) return '';
  const head = t => `<section class="blk vimp" id="vimp" aria-labelledby="vimph"><div class="bh"><h2 id="vimph">${t}</h2></div><div class="ex">`;
  const err = imp.error ? `<p class="err" role="alert">${esc(imp.error)}</p>` : '';
  if (db.isDemo(ctx) && imp.phase !== 'done') return `${head('Obsidian-Vault importieren')}<p class="note">${esc(DEMO_NO_IMPORT)}</p><div class="tools"><button class="btn" type="button" data-a="vcancel">Schließen</button></div></div></section>`;
  if (imp.phase === 'busy') return `${head('Obsidian-Vault importieren')}<p class="note" role="status">${esc(imp.label || 'Lese den Vault …')}</p></div></section>`;
  if (imp.phase === 'open') {
    return `${head('Obsidian-Vault importieren')}<p>Wähle deinen Vault als ZIP-Datei (den Vault-Ordner im Finder oder Explorer komprimieren) – oder einzelne Markdown-Dateien.</p>
    <ul class="dots"><li>Übernommen werden Notizen mit Ordnern, Tags, Eigenschaften (YAML) und [[Links]] sowie Bilder und PDFs.</li><li>Obsidian-Einstellungen, Papierkorb, Canvas, Audio und Video bleiben draußen – die Vorschau nennt jede Datei.</li><li>Erst siehst du eine Vorschau, dann speicherst du. Notizen, die du in Life OS geändert hast, werden nie still überschrieben.</li><li>Alles bleibt auf diesem Gerät. Anhänge sind nicht im Backup – ein erneuter Import holt sie zurück.</li></ul>
    ${err}<input id="vaultf" class="sr" type="file" accept=".zip,.md,application/zip,text/markdown" multiple tabindex="-1" aria-hidden="true">
    <div class="tools"><button class="btn pri" type="button" data-a="vpick">ZIP oder Markdown wählen</button><button class="btn" type="button" data-a="vcancel">Abbrechen</button></div></div></section>`;
  }
  const p = imp.plan, conflicts = p.conflicts.length ? `<p class="note err">${p.conflicts.length === 1 ? '1 Notiz hast' : `${p.conflicts.length} Notizen hast`} du in Life OS geändert, und im Vault ${p.conflicts.length === 1 ? 'ist sie' : 'sind sie'} auch anders. ${p.conflicts.length === 1 ? 'Sie bleibt' : 'Sie bleiben'}, wie in Life OS – nach dem Import kannst du je Notiz die Vault-Fassung übernehmen.</p>` : '';
  const gone = p.gone.length ? `<p class="note">${plural(p.gone.length, 'Notiz gibt', 'Notizen gibt')} es im Vault nicht mehr: ${p.gone.slice(0, 6).map(n => `„${esc(n.title)}“`).join(', ')}${p.gone.length > 6 ? ' …' : ''}. Sie ${p.gone.length === 1 ? 'bleibt' : 'bleiben'} in Life OS.</p>` : '';
  const twins = p.twins.length ? `<p class="note">${plural(p.twins.length, 'Notiz heißt', 'Notizen heißen')} wie eine Notiz, die du in Life OS angelegt hast (${p.twins.slice(0, 4).map(t => `„${esc(t)}“`).join(', ')}). Beide bleiben erhalten.</p>` : '';
  const details = `${skippedHtml(p)}${unresolvedHtml(p)}`;
  if (imp.phase === 'preview') {
    const n = p.add.length + p.update.length, nothing = !n && !p.atts.length;
    return `${head(`Vorschau: Vault „${esc(p.name)}“`)}<div class="kv2"><div><span>Neu</span><b>${p.add.length}</b></div><div><span>Aktualisiert</span><b>${p.update.length}</b></div><div><span>Unverändert</span><b>${p.same}</b></div><div><span>Anhänge</span><b>${p.atts.length}</b></div></div>
    ${conflicts}${gone}${twins}${details}${err}
    <div class="tools">${nothing ? '<button class="btn pri" type="button" data-a="vcancel">Nichts Neues – schließen</button>' : `<button class="btn pri" type="button" data-a="vapply">${n ? plural(n, 'Notiz', 'Notizen') + ' importieren' : 'Anhänge importieren'}</button><button class="btn" type="button" data-a="vcancel">Abbrechen</button>`}</div></div></section>`;
  }
  const r = imp.result;
  return `${head(`Vault „${esc(p.name)}“ importiert`)}<p class="note ok" role="status">Import fertig: ${r.added} neu, ${r.updated} aktualisiert, ${r.same} unverändert · ${r.attWritten} ${r.attWritten === 1 ? 'Anhang' : 'Anhänge'} gespeichert${r.attFailed ? `, ${r.attFailed} nicht gespeichert (Speicher voll?)` : ''}</p>
  ${p.conflicts.length ? `<p class="note err">In Life OS geändert und im Vault anders – deine Fassung ist geblieben:</p><ul class="crows card-l">${p.conflicts.map(c => `<li><a class="nm" href="#wissen/n-${esc(c.old.id)}"><b>${esc(c.old.title)}</b><small>${esc(c.old.path)}</small></a><button class="btn sm" type="button" data-a="vtake" data-id="${esc(c.old.id)}">Vault-Fassung übernehmen</button></li>`).join('')}</ul>` : ''}
  ${gone}${twins}${details}<div class="tools"><button class="btn" type="button" data-a="vcancel">Schließen</button></div></div></section>`;
}
function vaultSection(ctx) {
  const info = db.getRaw(ctx, 'vault'), n = db.list(ctx, 'note').filter(x => x.src === 'vault').length;
  if (!info && !n) return '';
  return `<section class="blk"><div class="bh"><h2>Vault</h2><p>${info ? `„${esc(info.name)}“ · importiert ${dshort(info.at)}` : ''}</p></div><div class="ex">
  <p class="note">${plural(n, 'Notiz', 'Notizen')} und ${plural(atts(ctx).length, 'Anhang', 'Anhänge')} aus dem Vault. Erneut importieren übernimmt Änderungen aus Obsidian; was du hier geändert hast, bleibt.</p>
  <div class="tools"><button class="btn" type="button" data-a="vopen">Erneut importieren</button><button class="btn red" type="button" data-a="vremove">${confirmRemove ? `Sicher? ${plural(n, 'Notiz', 'Notizen')} und alle Anhänge entfernen` : 'Vault-Notizen entfernen'}</button></div></div></section>`;
}

function listView(ctx) {
  const all = db.list(ctx, 'note'), shown = filtered(ctx), r = makeResolver(all, atts(ctx)), info = db.getRaw(ctx, 'vault');
  const tags = [...new Set(all.flatMap(n => n.tags))].sort((a, b) => a.localeCompare(b, 'de')), topics = new Set(all.map(n => n.topic));
  let graph = '', links = 0;
  if (shown.length) {
    const f = frame(), g = cachedGraph(shown, f, r);
    links = g.g.links.length;
    graph = `<section class="blk"><div class="bh"><h2>Graph</h2><p>${plural(shown.length, 'Notiz', 'Notizen')} · ${plural(links, 'Verbindung', 'Verbindungen')}</p></div>
    <div class="kgw">${toolbar('main')}${graphSvg(g.g, g.pos, { key: 'main', hits: hitIds(ctx), w: f.w, h: f.h })}</div>
    <p class="src">Punkt antippen öffnet die Notiz · ziehen verschiebt · zwei Finger, Strg/⌘ + Mausrad oder ＋/− zoomen · Linien sind [[Links]]</p></section>`;
  }
  const line = all.length ? `${plural(all.length, 'Notiz', 'Notizen')}${info ? ` · Vault „${esc(info.name)}“ · importiert ${dshort(info.at)}` : ''} · verknüpft mit [[Titel]], durchsuchbar, nutzbar in allen Bereichen.` : 'Deine Notizen als verlinkte Dateien – schreib hier oder importiere deinen Obsidian-Vault.';
  return `${hero('', 'Wissen', line)}
  <div class="pact">${newBtn('note', 'Notiz anlegen', topic ? { topic } : null, 'btn pri')}<button class="btn" type="button" data-a="vopen">Obsidian-Vault importieren</button>${all.length ? '<button class="btn" type="button" data-a="mdexport">Als Markdown exportieren</button>' : ''}</div>${msg ? `<p class="note ok" role="status">${esc(msg)}</p>` : ''}
  ${formIf(ctx, 'note')}${importBox(ctx)}
  ${all.length ? `<section class="blk"><input class="tx search" type="search" data-a="q" value="${esc(q)}" placeholder="Suchen … (#tag für Tags, auch Ordner)" aria-label="Notizen durchsuchen" aria-controls="nres" autocomplete="off">
  ${topics.size > 1 ? seg('ntopic', [['', 'Alle'], ...TOPICS.filter(t => topics.has(t[0]))], topic) : ''}</section>` : empty('Noch keine Notizen. Leg die erste an oder importiere deinen Obsidian-Vault – Notizen, Ordner, Tags und [[Links]] werden übernommen.')}
  ${graph}
  ${all.length ? `<section class="blk"><div class="bh"><h2>Dateien</h2><p>${plural(shown.length, 'Notiz', 'Notizen')}</p></div><div id="nres" aria-live="polite">${results(ctx)}</div></section>` : ''}
  ${tags.length ? `<section class="blk"><div class="bh"><h2>Tags</h2></div><div class="chips">${tags.map(t => `<button class="chipb${norm(q) === '#' + norm(t) ? ' on' : ''}" type="button" data-a="tagq" data-v="${esc(t)}">#${esc(t)}</button>`).join('')}</div></section>` : ''}
  ${vaultSection(ctx)}`;
}

// ---- one note ----
function propsHtml(n) {
  const props = parseProps(n.fm || '');
  if (!props.length) return '';
  return `<details class="dsc props"><summary>Eigenschaften</summary><div class="dbody"><dl>${props.map(p => `<dt>${esc(p.k)}</dt><dd>${esc(Array.isArray(p.v) ? p.v.join(', ') : p.v) || '–'}</dd>`).join('')}</dl></div></details>`;
}
function noteView(ctx, id) {
  const notes = db.list(ctx, 'note'), n = notes.find(x => x.id === id);
  if (!n) return `${hero('Wissen', 'Notiz nicht gefunden')}<p><a class="back" href="#wissen">‹ Zu den Notizen</a></p>`;
  const r = makeResolver(notes, atts(ctx)), { out, back } = noteLinks(n, notes, r), ps = db.list(ctx, 'project').filter(p => n.projects.includes(p.id));
  const k = n.path ? (dirOf(n.path) ? dirOf(n.path).split('/').join(' › ') : 'Vault') : label(TOPICS, n.topic);
  const m = n.path ? `Obsidian-Vault · ${n.path}${n.upd ? ' · geändert ' + dfmt(n.upd) : ''}` : `${n.created ? 'erstellt ' + dfmt(n.created) : ''}${n.upd ? ' · geändert ' + dfmt(n.upd) : ''}${n.src === 'beispiel' ? ' · Beispiel' : ''}`;
  const lg = localGraph(cachedGraph(notes, frame(), r).g, n.id), f = frame(true);
  return `<a class="back" href="#wissen">‹ Wissen</a>${hero(esc(k), esc(n.title), esc(m))}
  ${localChanged(n) ? '<p class="note err">In Life OS geändert – weicht von der Datei im Vault ab. Ein erneuter Import überschreibt das nicht, er fragt.</p>' : ''}
  <div class="pact">${editBtn('note', n.id, 'Notiz bearbeiten').replace('class="ed"', 'class="btn"')}</div>
  ${formIf(ctx, 'note')}
  <section class="blk"><article class="ex nbody">${n.body.trim() ? renderMd(n.body, { resolve: r, from: n.path || '' }) : '<p class="note">Noch kein Inhalt.</p>'}</article>${propsHtml(n)}</section>
  ${n.tags.length || ps.length ? `<section class="blk"><div class="chips">${n.tags.map(t => `<a class="chipb" href="#wissen" data-a="tagq" data-v="${esc(t)}">#${esc(t)}</a>`).join('')}${ps.map(p => `<a class="chipb on" href="#projekte/p-${esc(p.id)}">${esc(p.name)}</a>`).join('')}</div></section>` : ''}
  ${lg.nodes.length > 1 ? `<section class="blk"><div class="bh"><h2>Lokaler Graph</h2><p>diese Notiz und ihre direkten Verbindungen</p></div><div class="kgw">${toolbar('local')}${graphSvg(lg, layout(lg, f), { key: 'local', focus: n.id, w: f.w, h: f.h, allLabels: true })}</div></section>` : ''}
  ${out.length ? `<section class="blk"><div class="bh"><h2>Verlinkt</h2><p>${out.length}</p></div><ul class="crows card-l">${out.map(l => `<li>${l.id ? `<a class="nm" href="#wissen/n-${esc(l.id)}"><b>${esc(l.title)}</b></a>` : `<div class="nm"><b>${esc(l.title)}</b><small>gibt es noch nicht</small></div><button class="btn sm" type="button" data-a="mknote" data-t="${esc(l.title)}">Anlegen</button>`}</li>`).join('')}</ul></section>` : ''}
  <section class="blk"><div class="bh"><h2>Verweise hierher</h2><p>${back.length}</p></div>${back.length ? `<ul class="crows card-l">${back.map(noteRow).join('')}</ul>` : '<p class="note">Keine andere Notiz verweist hierher.</p>'}</section>`;
}

export function render(route, ctx) { return banner(ctx) + (route.view === 'note' ? noteView(ctx, route.id) : listView(ctx)); }

async function loadUpload(ctx, list) {
  const z = list.find(f => /\.zip$/i.test(f.name));
  imp = { phase: 'busy', label: `Lese „${list.map(f => f.name).join(', ').slice(0, 80)}“ …` };
  ctx.rerender();
  try {
    let raw;
    if (z) {
      if (z.size > MAX_ZIP) throw new Error('Die ZIP-Datei ist größer als 300 MB. Importiere den Vault in Teilen (z. B. einzelne Ordner).');
      raw = await readZipVault(new Uint8Array(await z.arrayBuffer()), z.name);
    } else {
      raw = { name: 'Markdown-Dateien', md: [], atts: [], skipped: [] };
      for (const f of list) {
        const path = f.webkitRelativePath || f.name;
        if (/\.md$/i.test(f.name)) raw.md.push({ path, bytes: new Uint8Array(await f.arrayBuffer()) });
        else raw.skipped.push({ path, why: 'nur ZIP-Dateien oder .md-Dateien' });
      }
    }
    imp = { phase: 'preview', plan: planVault(raw, ctx, z ? z.name : 'Markdown-Dateien') };
  } catch (e) {
    imp = { phase: 'open', error: (e && e.message) || 'Die Datei konnte nicht gelesen werden.' };
  }
  ctx.rerender();
}
async function applyImport(ctx) {
  const plan = imp.plan;
  imp = { phase: 'busy', label: 'Speichere Notizen und Anhänge …', plan };
  ctx.rerender();
  try { imp = { phase: 'done', plan, result: await applyVault(ctx, plan, vaultStore()) }; } catch (e) { imp = { phase: 'preview', plan, error: (e && e.message) || 'Import fehlgeschlagen.' }; }
  ctx.rerender();
}
async function exportMd(ctx) {
  const notes = db.list(ctx, 'note');
  if (!notes.length) { msg = 'Noch keine Notizen zum Exportieren.'; return ctx.rerender(); }
  const out = notesMarkdown(notes, db.list(ctx, 'project')), s = vaultStore();
  let n = 0;
  for (const p of atts(ctx)) {
    try { const b = s && await s.get(p); if (b) { out.push({ name: p, data: new Uint8Array(await b.arrayBuffer()) }); n++; } } catch (e) { /* missing here */ }
  }
  download(`life-os-notizen-${today(ctx)}.zip`, new Blob([zip(out)], { type: 'application/zip' }));
  msg = `${plural(notes.length, 'Notiz', 'Notizen')}${n ? ` und ${plural(n, 'Anhang', 'Anhänge')}` : ''} als Markdown exportiert.`;
  return ctx.rerender();
}
async function openAtt(ctx, path) {
  let blob = null;
  try { const s = vaultStore(); blob = s && await s.get(path); } catch (e) { blob = null; }
  if (!blob || typeof document === 'undefined') { ctx.toast('Anhang nicht auf diesem Gerät', 'Vault erneut importieren, um ihn zurückzuholen.'); return; }
  const u = URL.createObjectURL(openable(blob)), a = document.createElement('a');
  a.href = u; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}

export function onClick(e, route, ctx) {
  const t = target(e);
  if (!t || common(t, ctx)) return undefined;
  const a = t.dataset.a;
  if (a === 'fold') { const k = t.dataset.k; if (flip.has(k)) flip.delete(k); else flip.add(k); return undefined; }
  if (a === 'gz') { graphZoom(t.dataset.k, t.dataset.v); return undefined; }
  if (a === 'vpick') { const f = typeof document !== 'undefined' && document.getElementById('vaultf'); if (f) f.click(); return undefined; }
  if (a === 'attopen') return openAtt(ctx, t.dataset.p);
  if (a === 'vapply' && imp && imp.plan) return applyImport(ctx);
  if (a === 'mdexport') return exportMd(ctx);
  if (a === 'vremove') {
    if (!confirmRemove) confirmRemove = true;
    else {
      confirmRemove = false;
      blurActive();
      return removeVault(ctx, vaultStore()).then(n => { imp = null; msg = `${plural(n, 'Notiz', 'Notizen')} aus dem Vault entfernt.`; ctx.rerender(); }, er => { msg = er.message; ctx.rerender(); });
    }
  } else if (a === 'mknote') {
    const cur = route.view === 'note' ? db.find(ctx, 'note', route.id) : null;
    openEd(ctx, 'note', null, { title: t.dataset.t, topic: cur && cur.topic !== 'ohne' ? cur.topic : 'privat' });
  } else if (a === 'tagq') { q = norm(q) === '#' + norm(t.dataset.v) ? '' : '#' + t.dataset.v; if (route.view === 'note') ctx.go('#wissen'); }
  else if (a === 'ntopic') topic = t.dataset.v;
  else if (a === 'vopen') { imp = { phase: 'open' }; confirmRemove = false; msg = ''; if (route.view === 'note') ctx.go('#wissen'); }
  else if (a === 'vcancel') imp = null;
  else if (a === 'vtake') { if (imp && imp.plan && takeConflict(ctx, imp.plan, t.dataset.id)) ctx.toast('Vault-Fassung übernommen', ''); }
  else return undefined;
  blurActive();
  ctx.rerender();
  return undefined;
}
// Searching redraws only the list and marks the graph; typing keeps focus.
export function onInput(e, route, ctx) {
  const t = e.target;
  if (edInput(t)) return;
  if (t.dataset && t.dataset.a === 'q') {
    q = t.value;
    if (typeof document === 'undefined') return;
    const el = document.getElementById('nres');
    if (el) el.innerHTML = results(ctx);
    markHits(document, hitIds(ctx));
  }
}
export function onChange(e, route, ctx) {
  const t = e.target;
  if (t.id === 'vaultf' && t.files && t.files.length) { const list = [...t.files]; t.value = ''; return loadUpload(ctx, list); }
  edInput(t);
  return undefined;
}
export function onNavigate(next) {
  onNavigateCommon();
  msg = '';
  confirmRemove = false;
  scrolled = '';
  resetView('local');
  if (!next || next.area !== 'notes') { q = ''; topic = ''; if (imp && imp.phase !== 'busy') imp = null; }
}
function download(name, blob) {
  if (typeof document === 'undefined') return;
  try { const u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); } catch (e) { /* blocked */ }
}

// Pictures come from IndexedDB after drawing; a section link scrolls to its heading.
let urls = [];
async function loadAtts(root) {
  for (const u of urls) URL.revokeObjectURL(u);
  urls = [];
  const s = vaultStore();
  for (const img of root.querySelectorAll('img.natt[data-att]')) {
    let blob = null;
    try { blob = s && await s.get(img.dataset.att); } catch (e) { blob = null; }
    if (!img.isConnected) return;
    if (blob) { const u = URL.createObjectURL(blob); urls.push(u); img.src = u; } else {
      const sp = document.createElement('span');
      sp.className = 'wl miss';
      sp.textContent = `Anhang nicht auf diesem Gerät: ${img.dataset.att}`;
      img.replaceWith(sp);
    }
  }
}
export function mount(root, route) {
  mountCommon();
  if (!root || typeof document === 'undefined') return;
  bindGraphs(root);
  loadAtts(root);
  if (route && route.view === 'note' && route.h && scrolled !== route.id + route.h) {
    scrolled = route.id + route.h;
    const h = document.getElementById('h-' + route.h);
    // after the shell's own scroll to the top of a new page
    if (h) { h.classList.add('flash'); setTimeout(() => { if (h.isConnected) h.scrollIntoView({ block: 'start' }); }, 0); }
  }
  if (imp && imp.phase !== 'open') { const b = document.getElementById('vimp'); if (b && imp.fresh !== false) { b.scrollIntoView({ block: 'nearest' }); imp.fresh = false; } }
}
