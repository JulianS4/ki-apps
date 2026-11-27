// Einstellungen & Integrationen: what is connected (nothing yet, said plainly),
// imports with their date, example mode, export and delete.
import { esc } from '../../core/html.js';
import { dfmt } from '../../core/dates.js';
import * as db from './db.js';
import { zip, notesMarkdown } from './zip.js';
import { banner, hero, common, target, today, onNavigateCommon, mountCommon, blurActive, DEMO_NO_IMPORT } from './ui.js';
import { ATT_STORE } from './vault.js';
import { idbBlobs } from '../body/photos.js';

const KINDS = { csv: 'CSV-Import', json: 'Life-OS-Datei', vault: 'Obsidian-Vault' };

const DOC = 'https://github.com/JulianS4/ki-apps/blob/main/docs/cockpit-integrationen.md';
let confirmWipe = false, msg = '';
const status = (on, text) => `<span class="pill ${on ? 'ok' : 'mute'}">${text}</span>`;

function download(name, blob) {
  if (typeof document === 'undefined') return;
  try {
    const u = URL.createObjectURL(blob), l = document.createElement('a');
    l.href = u; l.download = name;
    document.body.appendChild(l); l.click(); l.remove();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  } catch (e) { /* download blocked */ }
}

// The data and integration sections; the settings page shows them under the backup.
export function sections(ctx) {
  const imps = db.list(ctx, 'import').sort((a, b) => (a.at < b.at ? 1 : -1)), acc = db.list(ctx, 'account');
  const an = id => (acc.find(a => a.id === id) || { name: '' }).name;
  const lastCsv = imps.find(i => i.kind === 'csv'), lastJson = imps.find(i => i.kind === 'json'), demo = db.isDemo(ctx);
  return `  <section class="blk"><div class="bh"><h2>Integrationen</h2><p>was verbunden ist</p></div><div class="cgrid">
  <section class="ccard"><div class="ch"><h2>Notion</h2>${status(false, 'Nicht eingerichtet')}</div>
   <p>Die App liest Notion nicht. Eine echte Verbindung bräuchte einen kleinen eigenen Server, der den Notion-Schlüssel sicher aufbewahrt – im Browser oder im öffentlichen Code darf er nicht stehen, und Notion erlaubt keine direkten Browser-Abrufe.</p>
   <p class="note">Würde synchronisiert: Konten und Nettovermögen → Finanzen · Business Log → Projekte · Ausbildung → Ausbildung. Nur Seiten, die du der Integration in Notion ausdrücklich freigibst.</p>
   <p class="note">Bis dahin: Life-OS-Datei (JSON) importieren.${lastJson ? ` Zuletzt: ${esc(lastJson.file)} am ${dfmt(lastJson.at)} (${lastJson.n} Einträge).` : ''}</p>
   ${demo ? `<p class="note">${DEMO_NO_IMPORT}</p>` : ''}
   <div class="tools">${demo ? '' : '<label class="btn" for="jsonf">Life-OS-Datei importieren<input id="jsonf" type="file" accept="application/json,.json" hidden></label>'}<a class="btn" href="${DOC}" target="_blank" rel="noopener noreferrer">Wie es ginge ›</a></div></section>
  <section class="ccard"><div class="ch"><h2>Bank</h2>${status(false, 'Nicht eingerichtet')}</div>
   <p>Keine Bank ist verbunden. Die App fragt nie nach Bank-Passwörtern und liest keine Bankseiten aus.</p>
   <p class="note">Eine spätere Verbindung ginge nur über einen zugelassenen Open-Banking-Dienst (PSD2): nur lesen, Freigabe direkt bei deiner Bank, zeitlich begrenzt und jederzeit widerrufbar. Abgerufen würden Kontoname, Kontostand und Umsätze (Datum, Betrag, Empfänger, Verwendungszweck).</p>
   <p class="note">Bis dahin: Kontostände von Hand, Umsätze per CSV-Import.${lastCsv ? ` Letzter CSV-Import: ${esc(lastCsv.file)} am ${dfmt(lastCsv.at)}${an(lastCsv.acc) ? ' in ' + esc(an(lastCsv.acc)) : ''}.` : ''} Importierte Daten sind so aktuell wie die Datei.</p>
   <div class="tools"><a class="btn" href="#finanzen/buchungen">CSV importieren ›</a></div></section>
  <section class="ccard"><div class="ch"><h2>KI-Agents</h2>${status(false, 'nicht verbunden')}</div>
   <p>Kein Agent-System angebunden. Status und Läufe trägst du selbst ein, jeweils mit Datum.</p><div class="tools"><a class="btn" href="#agents">Agents ›</a></div></section>
  </div></section>
  <section class="blk"><div class="bh"><h2>Importe</h2><p>${imps.length}</p></div>${imps.length ? `<ul class="crows card-l">${imps.slice(0, 12).map(i => `<li><div class="nm"><b>${esc(i.file || KINDS[i.kind])}</b><small>${KINDS[i.kind] || 'Import'}${an(i.acc) ? ' · ' + esc(an(i.acc)) : ''}</small></div><span class="vr">${i.n} neu<small>${dfmt(i.at)}</small></span></li>`).join('')}</ul>` : '<p class="note">Noch nichts importiert.</p>'}</section>
  <section class="blk prose"><div class="bh"><h2>Beispieldaten</h2></div><div class="ex">
   <p>${demo ? 'Gerade siehst du Beispieldaten. Alles ist erfunden und liegt getrennt von deinen echten Einträgen.' : 'Zum Ausprobieren: erfundene Konten, Buchungen, Klassenarbeiten, Projekte und Notizen – getrennt von deinen echten Einträgen und überall als „Beispieldaten“ markiert.'}</p>
   <div class="tools">${demo ? '<button class="btn" type="button" data-a="demoend">Beispiele beenden</button>' : '<button class="btn" type="button" data-a="demostart">Beispieldaten ansehen</button>'}</div></div></section>
  <section class="blk prose"><div class="bh"><h2>Datenschutz</h2></div><div class="ex">
   <p>Alle Daten liegen nur auf diesem Gerät, ohne Konto und ohne Cloud. Auf der Übersicht sind Beträge verdeckt, bis du „Beträge zeigen“ tippst.</p>
   <p class="note">Das Backup oben auf dieser Seite sichert alles mit, außer den Beispieldaten und den Bildern und PDFs aus dem Obsidian-Vault – die holt ein erneuter Vault-Import zurück.</p></div></section>
  <section class="blk"><div class="bh"><h2>Export & Löschen</h2><p>${demo ? 'gilt für die Beispieldaten' : 'Finanzen, Ausbildung, Projekte, Agents, Wissen'}</p></div><div class="ex">
   <div class="tools"><button class="btn" type="button" data-a="jexport">Alles als JSON</button><button class="btn" type="button" data-a="mdexport">Notizen als Markdown (ZIP)</button></div>
   <p class="note">Die Markdown-Dateien lassen sich direkt in Obsidian öffnen; [[Links]] bleiben erhalten.</p>
   <div class="tools"><button class="btn red" type="button" data-a="wipe">${confirmWipe ? 'Sicher? Diese Einträge endgültig löschen' : 'Einträge löschen'}</button></div>
   <p class="note">Löscht Konten, Buchungen, Abos, Ausbildung, Projekte, Log, Agents und Notizen (samt Vault-Anhängen) auf diesem Gerät. Training, Recovery und die übrigen Bereiche bleiben.</p>
   ${msg ? `<p class="note ok" role="status">${esc(msg)}</p>` : ''}</div></section>`;
}

export const render = (route, ctx) => `${banner(ctx)}${hero('', 'Daten & Integrationen', 'Was verbunden ist, woher Zahlen kommen, Export und Löschen.')}${sections(ctx)}`;
export const ACTIONS = ['wipe', 'jexport', 'mdexport', 'demostart', 'demoend'];
export function onClick(e, route, ctx) {
  const t = target(e);
  if (!t || common(t, ctx)) return;
  const a = t.dataset.a;
  if (a === 'wipe') {
    if (!confirmWipe) confirmWipe = true;
    else { confirmWipe = false; if (db.isDemo(ctx)) db.endDemo(ctx); else { db.wipe(ctx); clearAttachments(); } msg = 'Einträge gelöscht.'; }
  } else if (a === 'jexport') {
    download(`life-os-daten-${today(ctx)}.json`, new Blob([JSON.stringify(db.exportData(ctx, new Date().toISOString()))], { type: 'application/json' }));
    msg = 'Export erstellt.';
  } else if (a === 'mdexport') {
    const notes = db.list(ctx, 'note');
    if (!notes.length) msg = 'Noch keine Notizen zum Exportieren.';
    else { download(`life-os-notizen-${today(ctx)}.zip`, new Blob([zip(notesMarkdown(notes, db.list(ctx, 'project')))], { type: 'application/zip' })); msg = `${notes.length} Notizen exportiert.`; }
  } else return;
  blurActive();
  ctx.rerender();
}
// Vault pictures and PDFs sit in IndexedDB; deleting the entries takes them too.
function clearAttachments() {
  try { const s = idbBlobs(ATT_STORE.name, ATT_STORE.store); if (s) s.clear().catch(() => {}); } catch (e) { /* no IndexedDB */ }
}
export function onChange(e, route, ctx) {
  const t = e.target;
  if (t.id !== 'jsonf' || !t.files || !t.files[0]) return undefined;
  const f = t.files[0];
  return f.text().then(txt => { const r = db.importData(ctx, JSON.parse(txt), f.name, today(ctx)); msg = `Import fertig: ${r.n} Einträge übernommen.`; }, () => { msg = 'Die Datei konnte nicht gelesen werden.'; })
    .catch(er => { msg = er && /Life-OS-Datei|Beispielmodus|Speichern/.test(er.message) ? er.message : 'Keine gültige Life-OS-Datei.'; })
    .then(() => ctx.rerender());
}
export function onInput() {}
export function onNavigate() { onNavigateCommon(); confirmWipe = false; msg = ''; }
export function mount() { mountCommon(); }
