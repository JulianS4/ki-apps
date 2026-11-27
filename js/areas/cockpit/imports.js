// Import: the one place where data comes in. Notion and Obsidian are the sources;
// Claude turns them into a Life-OS-Import file that is checked here, previewed and
// then written. Bank CSV and a vault ZIP remain as further ways, collapsed.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import * as db from './db.js';
import { banner, hero, common, target, today, onNavigateCommon, mountCommon, blurActive, DEMO_NO_IMPORT } from './ui.js';
import { readImport, planImport, applyImport } from './lifeimport.js';
import { takeConflict, ATT_STORE } from './vault.js';
import { idbBlobs } from '../body/photos.js';
import * as finance from './finance.js';
import * as notes from './notes.js';

let st = null, paste = '';
const open = new Set();
const CSV_A = new Set(['csvgo', 'csvx', 'csvmap', 'csvacc']), VAULT_A = new Set(['vopen', 'vpick', 'vapply', 'vcancel', 'vtake']);
let files;
export const setFiles = s => { files = s; };
const store = () => { if (files === undefined) { try { files = idbBlobs(ATT_STORE.name, ATT_STORE.store); } catch (e) { files = null; } } return files; };
const FIN = { area: 'finance', view: 'tx' }, NOTES = { area: 'notes', view: 'list' };

const stamp = iso => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return `${dfmt(day)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const LABEL = { account: ['Konto', 'Konten'], cat: ['Kategorie', 'Kategorien'], tx: ['Buchung', 'Buchungen'], project: ['Projekt', 'Projekte'], log: ['Log-Eintrag', 'Log-Einträge'], pillar: ['Check-in', 'Check-ins'], note: ['Seite', 'Seiten'] };

function sourcesHtml(ctx) {
  const s = db.getRaw(ctx, 'sources') || {}, n = s.notion, o = s.obsidian;
  const counts = n && n.counts ? Object.entries(n.counts).filter(([, v]) => v).map(([k, v]) => plural(v, ...LABEL[k])).join(' · ') : '';
  const card = (name, x, line) => `<section class="ccard"><div class="ch"><h2>${name}</h2><span class="pill ${x ? 'ok' : 'mute'}">${x ? 'eingespielt' : 'offen'}</span></div>
  <p class="note">${x ? `Stand ${esc(stamp(x.at))}` : 'Noch nicht eingespielt'}</p>${line ? `<p class="src">${esc(line)}</p>` : ''}</section>`;
  return `<section class="blk"><div class="bh"><h2>Quellen</h2><p>so aktuell wie die letzte Datei</p></div><div class="cgrid">
  ${card('Notion', n, counts || (n ? 'keine Einträge' : 'Konten, Budget, Projekte, Business Log, Säulen-Check-in und Textseiten'))}
  ${card('Obsidian', o, o ? `${esc(o.name || 'Vault')} · ${plural(o.notes || 0, 'Notiz', 'Notizen')}` : 'Notizen für Wissen und das 3D-Gehirn')}</div>
  <p class="note">Was nur die App hat – Training, Recovery, Ernährung, Routinen, Körper und Arena – bleibt bei jedem Import unberührt. Einträge aus Notion änderst du in Notion; die nächste Datei bringt sie mit.</p></section>`;
}

function previewHtml(ctx) {
  const p = st.plan, v = p.vault, err = st.error ? `<p class="err" role="alert">${esc(st.error)}</p>` : '';
  const src = Object.values(p.sources).map(x => `${esc(x.name || '')} · Stand ${esc(stamp(x.at))}`).join(' · ');
  const rows = p.rows.filter(r => r.n || r.remove).map(r => `<tr><td>${esc(r.label)}</td><td>${r.add}</td><td>${r.update}</td><td>${r.remove}</td></tr>`).join('');
  const vrow = v ? `<tr><td>Notizen aus Obsidian</td><td>${v.add.length}</td><td>${v.update.length}</td><td>0</td></tr>` : '';
  const total = p.rows.reduce((a, r) => a + r.n, 0) + (v ? v.add.length + v.update.length : 0);
  const skipped = p.skipped.length ? `<details class="dsc"><summary><span class="tx2"><b>${plural(p.skipped.reduce((a, s) => a + (s.n || 1), 0), 'Datei wird', 'Dateien werden')} nicht übernommen</b><small>mit Grund</small></span></summary><div class="dbody"><ul class="crows">${p.skipped.map(s => `<li><div class="nm"><b>${esc(s.path)}</b><small>${esc(s.why)}</small></div>${s.n ? `<span class="vr">${s.n}</span>` : ''}</li>`).join('')}</ul></div></details>` : '';
  const conflicts = v && v.conflicts.length ? `<p class="note err">${plural(v.conflicts.length, 'Notiz hast', 'Notizen hast')} du in Life OS geändert, und in Obsidian ist sie auch anders. Deine Fassung bleibt; danach kannst du je Notiz die Obsidian-Fassung übernehmen.</p>` : '';
  return `<div class="ex"><p class="kbq">Vorschau</p><p class="src">${src}</p>
  <div class="tblw"><table class="tbl"><thead><tr><th>Bereich</th><th>neu</th><th>aktualisiert</th><th>entfernt</th></tr></thead><tbody>${rows}${vrow}</tbody></table></div>
  ${p.budgets ? `<p class="note">Budget: ${plural(p.budgets, 'Planbetrag', 'Planbeträge')} je Kategorie.</p>` : ''}${conflicts}${skipped}${err}
  <div class="tools"><button class="btn pri" type="button" data-a="lgo">${plural(total, 'Eintrag', 'Einträge')} importieren</button><button class="btn" type="button" data-a="lcancel">Abbrechen</button></div></div>`;
}

function fileHtml(ctx) {
  if (st && st.phase === 'busy') return `<div class="ex"><p class="note" role="status">${esc(st.label)}</p></div>`;
  if (st && st.phase === 'preview') return previewHtml(ctx);
  const done = st && st.phase === 'done' ? `<p class="note ok" role="status">${esc(st.msg)}</p>${st.plan && st.plan.vault && st.plan.vault.conflicts.length ? `<ul class="crows card-l">${st.plan.vault.conflicts.map(c => `<li><a class="nm" href="#wissen/n-${esc(c.old.id)}"><b>${esc(c.old.title)}</b><small>in Life OS geändert</small></a><button class="btn sm" type="button" data-a="ltake" data-id="${esc(c.old.id)}">Obsidian-Fassung übernehmen</button></li>`).join('')}</ul>` : ''}` : '';
  const err = st && st.error ? `<p class="err" role="alert">${esc(st.error)}</p>` : '';
  return `<div class="ex">${done}<p>Sag Claude „Life OS aktualisieren“ – du bekommst eine neue Datei (z. B. in OneDrive › Life OS Import). Wähle sie hier oder füge ihren Inhalt ein.</p>
  <input id="lifef" class="sr" type="file" accept=".json,application/json,text/plain" tabindex="-1" aria-hidden="true">
  <div class="tools"><button class="btn pri" type="button" data-a="lpick">Datei wählen</button></div>${err}
  <details class="dsc"${open.has('paste') ? ' open' : ''}><summary data-a="dsc" data-k="paste"><span class="tx2"><b>Inhalt einfügen</b><small>statt einer Datei</small></span></summary><div class="dbody">
  <textarea class="tx" data-a="lpaste" rows="5" aria-label="Inhalt der Import-Datei" placeholder="{ &quot;app&quot;: &quot;life-os-import&quot;, … }">
${esc(paste)}</textarea><div class="tools"><button class="btn" type="button" data-a="lcheck">Prüfen</button></div></div></details></div>`;
}

export function render(route, ctx) {
  const head = `${banner(ctx)}${hero('', 'Import', 'Notion und Obsidian sind deine Quellen. Claude baut daraus eine Life-OS-Datei – hier spielst du sie ein.')}`;
  if (db.isDemo(ctx)) return `${head}<div class="ex"><p class="note">${esc(DEMO_NO_IMPORT)}</p></div>${sourcesHtml(ctx)}`;
  const csvOpen = open.has('csv') || finance.csvActive(), vOpen = open.has('vault') || notes.vaultActive();
  return `${head}${sourcesHtml(ctx)}
  <section class="blk"><div class="bh"><h2>Datei einspielen</h2><p>Life-OS-Import von Claude</p></div>${fileHtml(ctx)}</section>
  <section class="blk"><div class="bh"><h2>Weitere Wege</h2><p>ohne Claude</p></div>
  <details class="dsc"${csvOpen ? ' open' : ''}><summary data-a="dsc" data-k="csv"><span class="tx2"><b>Bank-Umsätze als CSV</b><small>Export aus dem Online-Banking</small></span></summary><div class="dbody">${finance.csvSection(ctx)}</div></details>
  <details class="dsc"${vOpen ? ' open' : ''}><summary data-a="dsc" data-k="vault"><span class="tx2"><b>Obsidian-Vault als ZIP</b><small>Notizen direkt vom Gerät</small></span></summary><div class="dbody">${notes.vaultBox(ctx)}</div></details></section>`;
}

async function load(ctx, text, name) {
  try {
    const r = readImport(text);
    if (r.legacy) {
      const res = db.importData(ctx, r.legacy, name, today(ctx));
      st = { phase: 'done', msg: `Life-OS-Datei übernommen: ${res.n} Einträge.` };
    } else st = { phase: 'preview', plan: planImport(ctx, r.file, name) };
  } catch (e) { st = { phase: 'idle', error: (e && e.message) || 'Die Datei konnte nicht gelesen werden.' }; }
  ctx.rerender();
}
async function go(ctx) {
  const plan = st.plan;
  st = { phase: 'busy', label: 'Spiele die Daten ein …', plan };
  ctx.rerender();
  try {
    const r = await applyImport(ctx, plan, store()), v = r.vault;
    st = { phase: 'done', plan, msg: `Import fertig: ${plural(r.notion, 'Eintrag', 'Einträge')} aus Notion${v ? ` · Obsidian: ${v.added} neu, ${v.updated} aktualisiert, ${v.same} unverändert` : ''}.` };
    paste = '';
  } catch (e) { st = { phase: 'preview', plan, error: (e && e.message) || 'Import fehlgeschlagen.' }; }
  ctx.rerender();
}

export function onClick(e, route, ctx) {
  const t = target(e);
  if (!t) return undefined;
  const a = t.dataset.a;
  if (CSV_A.has(a)) return finance.onClick(e, FIN, ctx);
  if (VAULT_A.has(a)) return notes.onClick(e, NOTES, ctx);
  if (common(t, ctx)) return undefined;
  if (a === 'dsc') { const k = t.dataset.k; if (open.has(k)) open.delete(k); else open.add(k); return undefined; }
  if (a === 'lpick') { const f = typeof document !== 'undefined' && document.getElementById('lifef'); if (f) f.click(); return undefined; }
  if (a === 'lcheck') return load(ctx, paste, 'eingefügter Text');
  if (a === 'lgo' && st && st.plan) return go(ctx);
  if (a === 'lcancel') st = null;
  else if (a === 'ltake' && st && st.plan && st.plan.vault) { if (takeConflict(ctx, st.plan.vault, t.dataset.id)) ctx.toast('Obsidian-Fassung übernommen', ''); }
  else return undefined;
  blurActive();
  ctx.rerender();
  return undefined;
}
export function onInput(e) {
  const t = e.target;
  if (t.dataset && t.dataset.a === 'lpaste') paste = t.value;
}
export function onChange(e, route, ctx) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (t.id === 'lifef' && t.files && t.files[0]) { const f = t.files[0]; t.value = ''; return f.text().then(txt => load(ctx, txt, f.name), () => { st = { phase: 'idle', error: 'Die Datei konnte nicht gelesen werden.' }; ctx.rerender(); }); }
  if (t.id === 'csvf' || a === 'csvmap' || a === 'csvacc') return finance.onChange(e, FIN, ctx);
  if (t.id === 'vaultf') return notes.onChange(e, NOTES, ctx);
  return undefined;
}
export function onNavigate(next) { onNavigateCommon(); if (!next || next.area !== 'import') { if (st && st.phase !== 'busy') st = null; } }
export function mount() { mountCommon(); }
