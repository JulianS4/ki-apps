// Shared Life OS view pieces: example banner, page header, money display,
// source lines, bars, and the one form editor all cockpit areas use.
import { esc } from '../../core/html.js';
import { ds, dshort, dfmt } from '../../core/dates.js';
import { SCHEMAS, parseItem, toDraft } from './schema.js';
import * as db from './db.js';
import { fmtMoney, daysUntil } from './logic.js';

export const FAMILY = ['cockpit', 'finance', 'school', 'projects', 'agents', 'notes', 'integrations', 'import'];

export const today = ctx => ds(ctx.now());
export const banner = ctx => (db.isDemo(ctx) ? '<div class="demo" role="note"><b>Beispieldaten</b><span>Finanzen, Ausbildung, Projekte, Business Log, Agents und Wissen zeigen erfundene Einträge. Deine echten Einträge sind unberührt.</span><button class="btn" type="button" data-a="demoend">Beispiele beenden</button></div>' : '');
// Page header: optional eyebrow, the title, one line of orientation.
export const hero = (k, h1, m = '') => `<div class="hero" style="grid-template-columns:1fr"><div>${k ? `<p class="k">${k}</p>` : ''}<h1>${h1}</h1>${m ? `<p class="m">${m}</p>` : ''}</div></div>`;

// Amounts on the overview stay covered until asked for (reset on reload).
let shown = false;
export const amountsShown = () => shown;
export const HIDDEN = '•••• €';
export const money = (c, cur = 'EUR', mask = false) => (mask && !shown ? HIDDEN : fmtMoney(c, cur));
export const signed = (c, cur) => (c > 0 ? '+' : '') + fmtMoney(c, cur);

const SRC = { manuell: 'manuell eingetragen', csv: 'CSV-Import', import: 'Datei-Import', beispiel: 'Beispieldaten', vault: 'Obsidian-Vault', notion: 'Notion' };
export const srcName = s => SRC[s] || 'manuell eingetragen';
// "Quelle · Stand": every figure says where it came from and how old it is.
export function srcLine(src, stand, ctx, { label = 'Stand', warnDays = 0 } = {}) {
  const old = stand && warnDays && daysUntil(stand, today(ctx)) > warnDays;
  const extra = src === 'csv' || src === 'import' ? ' · evtl. nicht aktuell' : '';
  return `<span class="src${old ? ' old' : ''}">${esc(srcName(src))}${stand ? ` · ${label} ${dshort(stand)}` : ''}${old ? ' · veraltet?' : ''}${extra}</span>`;
}
export const when = d => (d ? dfmt(d) : '');
// Totals that contain imported transactions say how old the import is.
export function csvNote(ctx, txs) {
  if (!txs.some(t => t.src === 'csv')) return '';
  const last = db.list(ctx, 'import').filter(i => i.kind === 'csv').map(i => i.at).sort().pop();
  return `<p class="src">Enthält importierte Buchungen · letzter CSV-Import ${last ? dshort(last) : 'unbekannt'} · evtl. nicht aktuell</p>`;
}
export const DEMO_NO_IMPORT = 'Im Beispielmodus ist kein Import möglich – erst „Beispiele beenden“, dann landen Importe bei deinen echten Daten.';

export const empty = (text, actions = '') => `<div class="cempty"><p>${text}</p>${actions ? `<div class="tools">${actions}</div>` : ''}</div>`;
// Actions say what they do: "Konto hinzufügen", never a bare plus.
export const newBtn = (name, label, preset, cls = 'btn') => `<button class="${cls}" type="button" data-a="fnew" data-s="${name}" data-title="${esc(label)}"${preset ? ` data-preset="${esc(JSON.stringify(preset))}"` : ''}>${esc(label)}</button>`;
export const editBtn = (name, id, label = 'Bearbeiten') => `<button class="ed" type="button" data-a="fedit" data-s="${name}" data-id="${esc(id)}">${label}</button>`;
// Entries from Notion are changed in Notion: a quiet hint there instead of a button that would only say so.
export const editFor = (name, it, label = 'Bearbeiten', cls = 'ed') => (it.src === 'notion'
  ? '<span class="ed ro" title="Kommt aus Notion – dort ändern, die nächste Import-Datei bringt es mit">in Notion ändern</span>'
  : editBtn(name, it.id, label).replace('class="ed"', `class="${cls}"`));
export const seg = (a, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-a="${a}" data-v="${esc(v)}"${v === cur ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"'}>${esc(l)}</button>`).join('')}</div>`;
export const pbar = (pct, label) => `<div class="pbar cx" role="img" aria-label="${esc(label)}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;

// Labelled horizontal bars: name and value as text, the bar only shows the size.
export function bars(rows, fmt) {
  const max = Math.max(...rows.map(r => r.c), 1);
  return `<ul class="cbars">${rows.map(r => `<li><span class="nm">${esc(r.name)}</span><span class="bv">${esc(fmt(r.c))}</span><i style="width:${r.c > 0 ? (r.c / max * 100).toFixed(1) + '%;min-width:2px' : '0'}"></i></li>`).join('')}</ul>`;
}

// ---- the editor: one open form at a time across the cockpit ----
export const ed = { cur: null, fresh: false };
export function openEd(ctx, name, item, preset = {}, title = '') {
  const draft = item ? toDraft(name, item) : toDraft(name, {});
  if (!item) for (const f of SCHEMAS[name].fields) if (f.today) draft[f.k] = today(ctx);
  ed.cur = { name, id: item ? item.id : null, draft: item ? draft : { ...draft, ...preset }, errors: {}, confirm: false, title };
  ed.fresh = true;
}
export const closeEd = () => { ed.cur = null; };
export const edIs = name => !!ed.cur && ed.cur.name === name;
export function edInput(t) {
  if (!ed.cur || !t.dataset || !t.dataset.f) return false;
  const d = ed.cur.draft, k = t.dataset.f;
  if (t.dataset.ref) {
    const set = new Set(d[k] || []);
    if (t.checked) set.add(t.dataset.ref); else set.delete(t.dataset.ref);
    d[k] = [...set];
  } else d[k] = t.type === 'checkbox' ? !!t.checked : t.value;
  return true;
}
export function edSave(ctx) {
  const c = ed.cur, r = parseItem(c.name, c.draft);
  if (!r.ok) { c.errors = r.errors; return null; }
  const base = { ...(c.id ? db.find(ctx, c.name, c.id) || {} : {}) };
  for (const f of SCHEMAS[c.name].fields) if (!f.internal) delete base[f.k];
  const item = db.upsert(ctx, c.name, { ...base, ...r.item, ...(c.id ? { id: c.id } : {}) });
  if (!item) { c.errors = { _: 'Speichern nicht möglich – Speicher voll oder privater Modus?' }; return null; }
  closeEd();
  return item;
}

function fieldHtml(ctx, f, v, err) {
  const lab = `<span>${esc(f.label)}${f.req ? ' <i aria-hidden="true">*</i>' : ''}</span>`, cls = f.full || f.t === 'long' || f.t === 'links' || f.t === 'refs' ? ' class="full"' : '';
  const hint = f.hint ? `<small>${esc(f.hint)}</small>` : '', e = err ? `<span class="err" role="alert">${esc(err)}</span>` : '';
  const id = `f-${f.k}`;
  let input;
  // The HTML parser drops one newline right after <textarea>; the extra one keeps a leading empty line.
  if (f.t === 'long' || f.t === 'links') input = `<textarea class="tx" id="${id}" data-f="${f.k}" rows="${f.rows || 4}">\n${esc(v)}</textarea>`;
  else if (f.t === 'select') input = `<select class="tx" id="${id}" data-f="${f.k}">${f.opts.map(([o, l]) => `<option value="${esc(o)}"${o === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  else if (f.t === 'ref') {
    const items = db.list(ctx, f.ref), known = items.some(i => i.id === v);
    input = `<select class="tx" id="${id}" data-f="${f.k}">${f.req && known ? '' : `<option value="">${f.req ? 'Bitte wählen' : '—'}</option>`}${v && !known ? `<option value="${esc(v)}" selected>(gelöscht)</option>` : ''}${items.map(i => `<option value="${esc(i.id)}"${i.id === v ? ' selected' : ''}>${esc(i.name)}</option>`).join('')}</select>`;
  } else if (f.t === 'refs') {
    const items = db.list(ctx, f.ref);
    return `<fieldset class="full refs"><legend>${esc(f.label)}</legend>${items.map(i => `<label class="wph"><input type="checkbox" data-f="${f.k}" data-ref="${esc(i.id)}"${(v || []).includes(i.id) ? ' checked' : ''}> ${esc(i.name)}</label>`).join('')}</fieldset>`;
  } else if (f.t === 'bool') return `<label class="wph full"><input type="checkbox" data-f="${f.k}"${v ? ' checked' : ''}> ${esc(f.label)}</label>`;
  else {
    const type = f.t === 'date' ? 'date' : f.t === 'time' ? 'time' : 'text';
    const im = f.t === 'money' && f.pos ? ' inputmode="decimal"' : f.t === 'int' ? ' inputmode="numeric"' : '';
    input = `<input class="tx" id="${id}" type="${type}" data-f="${f.k}" value="${esc(v)}"${im}${f.req ? ' aria-required="true"' : ''}${err ? ' aria-invalid="true"' : ''}>`;
  }
  return `<label${cls} for="${id}">${lab}${input}${hint}${e}</label>`;
}
// The open form, with fields the context already fixes left out.
export function formHtml(ctx, { hide = [] } = {}) {
  const c = ed.cur, s = SCHEMAS[c.name];
  let grp = '';
  const fields = s.fields.filter(f => !f.internal && !hide.includes(f.k)).map(f => {
    const h = f.grp && f.grp !== grp ? `<p class="fgh full">${esc(f.grp)}</p>` : '';
    if (f.grp) grp = f.grp;
    return h + fieldHtml(ctx, f, c.draft[f.k], c.errors[f.k]);
  }).join('');
  const demo = db.isDemo(ctx) ? '<p class="note err">Beispielmodus: Was du hier speicherst, wird mit den Beispielen gelöscht. Echte Einträge erst nach „Beispiele beenden“.</p>' : '';
  return `<div class="cform" id="cform"><h3>${c.id ? `${s.title} bearbeiten` : esc(c.title || `${s.title} hinzufügen`)}</h3>${demo}<div class="fg">${fields}</div>
  ${c.errors._ ? `<p class="err" role="alert">${esc(c.errors._)}</p>` : ''}
  <div class="fa">${c.id ? `<button class="btn red" type="button" data-a="fdel">${c.confirm ? 'Sicher? Nochmal tippen' : 'Löschen'}</button>` : ''}<span class="sp"></span><button class="btn" type="button" data-a="fcancel">Abbrechen</button><button class="btn pri" type="button" data-a="fsave">Speichern</button></div></div>`;
}
export const formIf = (ctx, name, opts) => (edIs(name) ? formHtml(ctx, opts) : '');

// Clicks every cockpit area shares. Returns true when handled.
export function common(t, ctx) {
  const a = t.dataset.a;
  if (a === 'fnew') { let p = {}; try { p = JSON.parse(t.dataset.preset || '{}'); } catch (e) { p = {}; } openEd(ctx, t.dataset.s, null, p, t.dataset.title || ''); }
  else if (a === 'fedit') {
    const it = db.find(ctx, t.dataset.s, t.dataset.id);
    if (!it) return true;
    // Notion is the source: changes go there and come back with the next import file.
    if (it.src === 'notion') { ctx.toast('Kommt aus Notion', 'Ändere es dort – die nächste Import-Datei bringt es mit.'); return true; }
    openEd(ctx, t.dataset.s, it);
  }
  else if (a === 'fsave') { if (ed.cur && edSave(ctx)) ctx.toast('Gespeichert', ''); }
  else if (a === 'fcancel') closeEd();
  else if (a === 'fdel') {
    if (!ed.cur) return true;
    if (!ed.cur.confirm) ed.cur.confirm = true;
    else { db.remove(ctx, ed.cur.name, ed.cur.id); closeEd(); }
  } else if (a === 'demoend') { db.endDemo(ctx); closeEd(); }
  else if (a === 'demostart') { db.startDemo(ctx, today(ctx)); closeEd(); }
  else if (a === 'shown') shown = !shown;
  else return false;
  blurActive();
  ctx.rerender();
  return true;
}
// A focused field holds back the redraw (see app.js), so a form button lets go of it.
export function blurActive() {
  if (typeof document !== 'undefined' && document.activeElement && document.activeElement.blur && document.activeElement !== document.body) document.activeElement.blur();
}
// Task tick boxes (data-a="tick" data-s="stask|ptask" data-id).
export function tick(t, ctx) {
  if (t.dataset.a !== 'tick') return false;
  const it = db.find(ctx, t.dataset.s, t.dataset.id);
  if (it) db.upsert(ctx, t.dataset.s, { ...it, done: !!t.checked });
  blurActive();
  ctx.rerender();
  return true;
}
export const target = e => (e.target && e.target.closest ? e.target.closest('[data-a]') : null);
export function onNavigateCommon() { closeEd(); }
export function mountCommon() {
  if (ed.fresh && typeof document !== 'undefined') {
    const f = document.getElementById('cform');
    if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest' });
  }
  ed.fresh = false;
}
