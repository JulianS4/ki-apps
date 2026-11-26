// Settings: backup, Apple Health shortcut guide, install hint.
import { buildBackup, importBackup, STORAGE_FAILED } from '../core/backup.js';
import { today, dfmt } from '../core/dates.js';
import { runMigrations } from '../core/migrate.js';
import { photoStore } from './body/index.js';
import { exportPhotos, importPhotos, mergeIndex } from './body/photos.js';

const SC_NAME = 'Training loggen';
const INVALID = 'Keine gültige Backup-Datei';

export function render(route, ctx) {
  const n = Object.keys(ctx.store.get('train.sess', {}) || {}).length, last = ctx.store.get('meta.lastBackup');
  return `<div class="hero" style="grid-template-columns:1fr"><div><p class="k">Daten & Einrichtung</p><h1>Einstellungen</h1></div></div>
  <section class="blk prose"><div class="bh"><h2>Backup</h2><p>${n} Trainingseinheiten · ${last ? 'letztes ' + dfmt(last) : 'noch keins'}</p></div>
  <div class="ex" style="--c:var(--k-core)"><p>Alles liegt nur auf diesem Gerät, ohne Konto und ohne Cloud. Speicher ab und zu ein Backup, z. B. in die Dateien-App oder iCloud Drive.</p>
  <p class="note">Umzug aus der alten Hybrid-Training-App: dort „Backup speichern“, hier „Backup laden“.</p>
  <p class="note"><label class="wph"><input type="checkbox" id="withPhotos"> mit Fotos</label> <span id="photoSize"></span></p>
  <div class="tools"><button class="btn pri" data-a="export" type="button">Backup speichern</button><label class="btn" for="imp" style="display:inline-flex;align-items:center">Backup laden<input id="imp" type="file" accept="application/json,.json" style="display:none"></label></div>
  <p class="note" id="impMsg" aria-live="polite"></p></div></section>
  <section class="blk prose"><div class="bh"><h2>Apple Health einrichten</h2><p>einmalig · 3 min</p></div>
  <div class="ex" style="--c:var(--k-push)"><p>Das Training schickt Krafteinheiten über einen Kurzbefehl an Apple Health. Google Health holt sie sich von dort, wenn die Verbindung in der Google-Health-App unter <b>Partner-Apps → Apple Health</b> aktiv ist.</p>
  <ol class="steps">
   <li>App <b>Kurzbefehle</b> öffnen → <b>+</b> → Name exakt <code>${SC_NAME}</code></li>
   <li>Aktion <b>„Wörterbuch abrufen“</b> hinzufügen, Eingabe: <b>Kurzbefehleingabe</b></li>
   <li>Aktion <b>„Wörterbuchwert abrufen“</b> → Schlüssel <code>min</code>. Nochmal für <code>start</code> und <code>typ</code></li>
   <li>Health-Aktion zum <b>Protokollieren eines Trainings</b> hinzufügen (in der Suche „Training“ eingeben)</li>
   <li>Dort einsetzen: Art = <b>Traditionelles Krafttraining</b> (oder Wert <code>typ</code>), Dauer = Wert <code>min</code> Minuten, Startdatum = Wert <code>start</code></li>
   <li>Kommt beim Test nichts an: in den Kurzbefehl-Details das Empfangen von <b>Text</b> als Eingabe aktivieren</li>
   <li>Einmal testen: Health fragt nach Schreib-Erlaubnis für Trainings → <b>Erlauben</b></li>
  </ol>
  <p class="note">Nur Krafttraining und Athlete Day werden gesendet. Läufe kommen schon über Strava bzw. Google Health.</p></div></section>
  <section class="blk prose"><div class="bh"><h2>Als App installieren</h2></div>
  <div class="ex" style="--c:var(--k-pull)"><p>In <b>Safari</b> öffnen → <b>Teilen</b> → <b>Zum Home-Bildschirm</b>. Danach startet KI-Apps im Vollbild und funktioniert auch offline.</p></div></section>`;
}

// The size of the stored photos, so "mit Fotos" is a choice with numbers.
export function mount() {
  const el = document.getElementById('photoSize'), s = photoStore();
  if (!el || !s) return;
  const fmt = n => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`);
  s.size().then(n => { el.textContent = n ? `· Fotos: ${fmt(n)}` : '· keine Fotos'; }).catch(() => {});
}

// Without photos the download starts right away; with photos it waits for them.
export async function onClick(e, route, ctx) {
  const t = e.target.closest('[data-a="export"]');
  if (!t) return;
  const box = document.getElementById('withPhotos'), withPhotos = !!(box && box.checked);
  const backup = buildBackup(ctx.store, new Date().toISOString(), { photos: withPhotos });
  let note = '';
  if (withPhotos) {
    const s = photoStore();
    if (s) {
      const r = await exportPhotos(s, backup.data['body.photos']);
      backup.photos = r.photos;
      backup.data['body.photos'] = r.index;
      note = ` · ${r.count} Fotos${r.missing ? ` (${r.missing} fehlte${r.missing > 1 ? 'n' : ''} auf diesem Gerät)` : ''}`;
    } else {
      delete backup.data['body.photos'];
      note = ' · ohne Fotos (auf diesem Gerät nicht verfügbar)';
    }
  }
  const data = JSON.stringify(backup);
  try {
    const u = URL.createObjectURL(new Blob([data], { type: 'application/json' })), l = document.createElement('a');
    l.href = u;
    l.download = `ki-apps-backup-${today()}.json`;
    document.body.appendChild(l);
    l.click();
    l.remove();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  } catch (er) { /* download blocked */ }
  ctx.store.set('meta.lastBackup', today());
  t.textContent = 'Backup erstellt ✓';
  const msg = document.getElementById('impMsg');
  if (msg) msg.textContent = 'Backup gespeichert' + note;
}

export function onChange(e, route, ctx) {
  const t = e.target;
  if (t.id !== 'imp' || !t.files[0]) return;
  t.files[0].text()
    .then(async txt => {
      const obj = JSON.parse(txt), r = importBackup(obj, ctx.store);
      let note = '';
      if (obj && obj.photos && typeof obj.photos === 'object') {
        const s = photoStore();
        if (s) {
          const p = await importPhotos(s, obj.photos);
          ctx.store.set('body.photos', mergeIndex(ctx.store.get('body.photos'), p.index));
          note = ` · Fotos: ${p.written} geladen${p.failed ? `, ${p.failed} fehlgeschlagen` : ''}`;
        } else note = ' · Fotos nicht geladen (auf diesem Gerät nicht verfügbar)';
      }
      runMigrations(ctx.store);
      ctx.reloadAll();
      ctx.rerender();
      document.getElementById('impMsg').textContent = `Backup geladen ✓ (${r.sessions} Einheiten)${note}`;
    })
    .catch(er => { document.getElementById('impMsg').textContent = er && er.message === STORAGE_FAILED ? STORAGE_FAILED : INVALID; });
}
