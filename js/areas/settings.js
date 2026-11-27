// Settings: backup, Apple Health shortcut guide, install hint.
import { buildBackup, importBackup, STORAGE_FAILED } from '../core/backup.js';
import { today, dfmt } from '../core/dates.js';
import { runMigrations } from '../core/migrate.js';
import { photoStore } from './body/index.js';
import { exportPhotos, importPhotos, mergeIndex } from './body/photos.js';
import { conn as arenaConn, setupArena, joinArena, leaveArena, inviteLink, arenaOnly } from './arena/index.js';
import { PLAYERS } from './arena/data.js';
import { esc } from '../core/html.js';
import * as integ from './cockpit/integrations.js';
import { banner } from './cockpit/ui.js';
import { ACCENTS, accentOf, setAccent } from '../core/theme.js';

// Darstellung: the accent colour, one round swatch per choice.
const look = ctx => { const cur = accentOf(ctx.store); return `<section class="blk prose"><div class="bh"><h2>Darstellung</h2><p>Akzentfarbe</p></div><div class="ex"><div class="swatches" role="group" aria-label="Akzentfarbe">${ACCENTS.map(([k, l, c]) => `<button type="button" class="sw" data-a="accent" data-v="${k}" aria-pressed="${k === cur}" aria-label="Akzentfarbe ${l}" style="--sw:${c}"><i></i><span>${l}</span></button>`).join('')}</div><p class="note">Färbt Knöpfe, Ringe, Leuchten und die Muskelfigur. Gilt für dieses Gerät.</p></div></section>`; };

const SC_NAME = 'Training loggen';

// "mit Fotos": the photos are read as soon as the box is ticked, so the
// download itself starts within the tap (iOS may drop one that waits).
let withPhotos = false, prepared = null, pending = null, gen = 0;
function prepare(ctx) {
  const run = ++gen, s = photoStore();
  prepared = null;
  pending = (s ? exportPhotos(s, ctx.store.get('body.photos')) : Promise.resolve({ none: true }))
    .then(r => r, () => ({ error: true }))
    .then(r => { if (run === gen) { prepared = r; pending = null; } });
  return pending;
}
export function onNavigate(next, ctx) { gen++; prepared = null; pending = null; amsg = ''; aconfirm = null; integ.onNavigate(next, ctx); }

// Arena: set up (Julian), paste an invite (Uygar, or a second device), share links.
let adraft = { cfg: '', inv: '' }, amsg = '', aconfirm = null;
function arenaSection(ctx) {
  const c = arenaConn(ctx), sure = a => aconfirm === a;
  const msg = `<p class="note" aria-live="polite">${esc(amsg)}</p>`;
  const leave = `<button class="btn red" type="button" data-a="aleave">${sure('aleave') ? 'Sicher? Nochmal tippen' : 'Arena verlassen'}</button>`;
  const linkRow = (p, label) => `<p class="note fl"><b>${label}</b></p><input class="tx" readonly value="${esc(inviteLink(ctx, p) || '')}" aria-label="${label}">
    <div class="tools"><button class="btn" type="button" data-a="ashare" data-p="${p}">Teilen</button><button class="btn" type="button" data-a="acopy2" data-p="${p}">Kopieren</button></div>`;
  let body;
  if (!c) {
    body = `<p>Die Arena ist euer Punktewettkampf, Julian gegen Uygar, und der einzige Teil, der online läuft. Die Firebase-Einrichtung steht in der <a href="https://github.com/JulianS4/ki-apps/blob/main/docs/arena-firebase.md">Anleitung</a>.</p>
    <p class="note fl"><b>Arena einrichten</b> · Firebase-Konfiguration einfügen</p>
    <textarea class="tx" data-a="acfg" rows="5" placeholder="const firebaseConfig = { apiKey: …, projectId: … };">${esc(adraft.cfg)}</textarea>
    <div class="tools"><button class="btn pri" type="button" data-a="acreate">Arena anlegen</button></div>
    <p class="note fl"><b>Einladung einfügen</b> · den ganzen Link</p>
    <textarea class="tx" data-a="ainv" rows="3" placeholder="https://…#arena/einladung?…">${esc(adraft.inv)}</textarea>
    <div class="tools"><button class="btn" type="button" data-a="ajoin">Einladung einfügen</button></div>`;
  } else if (c.player === 'julian' && c.keys) {
    body = `<p>Du bist <b>Julian</b>. Den Link für Uygar nur an Uygar schicken: Wer ihn hat, spielt als Uygar.</p>
    ${linkRow('uygar', 'Einladung für Uygar')}${linkRow('julian', 'Link für mich')}
    <div class="tools"><button class="btn" type="button" data-a="anew">${sure('anew') ? 'Sicher? Nochmal tippen' : 'Neue Arena anlegen'}</button>${leave}</div>`;
  } else {
    const full = ctx.store.get('app.full') === true;
    body = `<p>Du bist <b>${PLAYERS[c.player]}</b>.</p>
    <div class="tools">${c.player === 'uygar' ? `<button class="btn" type="button" data-a="afull">${full ? 'Weitere Bereiche ausblenden' : 'Weitere Bereiche einblenden'}</button>` : ''}${leave}</div>`;
  }
  return `<section class="blk prose"><div class="bh"><h2>Arena</h2><p>Julian · Uygar</p></div><div class="ex">${body}${msg}</div></section>`;
}
function arenaClick(t, ctx) {
  const a = t.dataset.a, say = m => { amsg = m; ctx.rerender(); };
  if (a === 'acreate') {
    say('Arena wird angelegt …');
    return setupArena(ctx, adraft.cfg).then(r => { if (r.ok) adraft.cfg = ''; say(r.ok ? 'Arena angelegt ✓ Schick jetzt Uygar seine Einladung.' : r.error); });
  }
  if (a === 'ajoin') {
    const r = joinArena(ctx, adraft.inv);
    if (r.ok) adraft.inv = '';
    return say(r.ok ? `Arena übernommen ✓ Du bist ${PLAYERS[r.player]}.` : 'Diese Einladung ist ungültig oder unvollständig.');
  }
  if (a === 'ashare' || a === 'acopy2') {
    const link = inviteLink(ctx, t.dataset.p);
    if (!link || typeof navigator === 'undefined') return undefined;
    if (a === 'ashare' && navigator.share) return navigator.share({ title: 'Life OS Arena', url: link }).catch(() => {});
    if (!navigator.clipboard) return say('Kopieren ging nicht – den Link im Feld markieren und kopieren.');
    return navigator.clipboard.writeText(link).then(() => say('Link kopiert ✓'), () => say('Kopieren ging nicht – den Link im Feld markieren und kopieren.'));
  }
  if (a === 'anew' || a === 'aleave') {
    if (aconfirm !== a) { aconfirm = a; ctx.rerender(); return undefined; }
    aconfirm = null;
    if (a === 'aleave') { leaveArena(ctx); return say('Arena auf diesem Gerät verlassen.'); }
    const c = arenaConn(ctx);
    say('Neue Arena wird angelegt …');
    return setupArena(ctx, JSON.stringify(c.cfg)).then(r => say(r.ok ? 'Neue Arena angelegt ✓ Schick Uygar die neue Einladung.' : r.error));
  }
  if (a === 'afull') { ctx.store.set('app.full', ctx.store.get('app.full') !== true); ctx.rerender(); }
  return undefined;
}
export function onInput(e) {
  const t = e.target, a = t.dataset && t.dataset.a;
  if (a === 'acfg') adraft.cfg = t.value;
  if (a === 'ainv') adraft.inv = t.value;
}
const INVALID = 'Keine gültige Backup-Datei';

export function render(route, ctx) {
  const n = Object.keys(ctx.store.get('train.sess', {}) || {}).length, last = ctx.store.get('meta.lastBackup');
  return `${banner(ctx)}<div class="hero" style="grid-template-columns:1fr"><div><h1>Einstellungen</h1><p class="m">${arenaOnly(ctx.store) ? 'Backup, Arena und Einrichtung.' : 'Backup, Daten, Integrationen und Einrichtung – alles an einem Ort.'}</p></div></div>
  ${look(ctx)}<section class="blk prose"><div class="bh"><h2>Backup</h2><p>${n} Trainingseinheiten · ${last ? 'letztes ' + dfmt(last) : 'noch keins'}</p></div>
  <div class="ex" style="--c:var(--k-core)"><p>Alles liegt nur auf diesem Gerät, ohne Konto und ohne Cloud. Speicher ab und zu ein Backup, z. B. in die Dateien-App oder iCloud Drive.</p>
  <p class="note">Umzug aus der alten Hybrid-Training-App: dort „Backup speichern“, hier „Backup laden“.</p>${arenaConn(ctx) ? '<p class="note">Das Backup enthält auch deinen Arena-Zugang.</p>' : ''}
  <p class="note"><label class="wph"><input type="checkbox" id="withPhotos"${withPhotos ? ' checked' : ''}> mit Fotos</label> <span id="photoSize"></span></p>
  <div class="tools"><button class="btn pri" data-a="export" type="button">Backup speichern</button><label class="btn" for="imp" style="display:inline-flex;align-items:center">Backup laden<input id="imp" type="file" accept="application/json,.json" style="display:none"></label></div>
  <p class="note" id="impMsg" aria-live="polite"></p></div></section>
  ${arenaOnly(ctx.store) ? '' : integ.sections(ctx)}
  ${arenaSection(ctx)}
  <section class="blk prose"><div class="bh"><h2>Einrichtung</h2></div><details class="dsc"><summary><span class="tx2"><b>Apple Health einrichten</b><small>einmalig · 3 Minuten</small></span></summary>
  <div class="dbody"><p>Das Training schickt Krafteinheiten über einen Kurzbefehl an Apple Health. Google Health holt sie sich von dort, wenn die Verbindung in der Google-Health-App unter <b>Partner-Apps → Apple Health</b> aktiv ist.</p>
  <ol class="steps">
   <li>App <b>Kurzbefehle</b> öffnen → <b>+</b> → Name exakt <code>${SC_NAME}</code></li>
   <li>Aktion <b>„Wörterbuch abrufen“</b> hinzufügen, Eingabe: <b>Kurzbefehleingabe</b></li>
   <li>Aktion <b>„Wörterbuchwert abrufen“</b> → Schlüssel <code>min</code>. Nochmal für <code>start</code> und <code>typ</code></li>
   <li>Health-Aktion zum <b>Protokollieren eines Trainings</b> hinzufügen (in der Suche „Training“ eingeben)</li>
   <li>Dort einsetzen: Art = <b>Traditionelles Krafttraining</b> (oder Wert <code>typ</code>), Dauer = Wert <code>min</code> Minuten, Startdatum = Wert <code>start</code></li>
   <li>Kommt beim Test nichts an: in den Kurzbefehl-Details das Empfangen von <b>Text</b> als Eingabe aktivieren</li>
   <li>Einmal testen: Health fragt nach Schreib-Erlaubnis für Trainings → <b>Erlauben</b></li>
  </ol>
  <p class="note">Nur Krafttraining und Athlete Day werden gesendet. Läufe kommen schon über Strava bzw. Google Health.</p></div></details>
  <details class="dsc"><summary><span class="tx2"><b>Als App installieren</b><small>auf den Home-Bildschirm</small></span></summary>
  <div class="dbody"><p>In <b>Safari</b> öffnen → <b>Teilen</b> → <b>Zum Home-Bildschirm</b>. Danach startet Life OS im Vollbild und funktioniert auch offline.</p></div></details></section>`;
}

// The size of the stored photos, so "mit Fotos" is a choice with numbers.
export function mount(root, route, ctx) {
  if (withPhotos && !prepared && !pending && ctx) prepare(ctx);
  const el = document.getElementById('photoSize'), s = photoStore();
  if (!el || !s) return;
  const fmt = n => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`);
  s.size().then(n => { el.textContent = n ? `· Fotos: ${fmt(n)}` : '· keine Fotos'; }).catch(() => {});
}

// Nothing waits between the tap and the download.
export function onClick(e, route, ctx) {
  const at = e.target.closest('[data-a]');
  if (at && at.dataset && at.dataset.a === 'accent') { setAccent(ctx.store, at.dataset.v); if (ctx.rerender) ctx.rerender(); return; }
  if (at && at.dataset && integ.ACTIONS.includes(at.dataset.a)) return integ.onClick(e, route, ctx);
  if (at && at.dataset && at.dataset.a && at.dataset.a !== 'export') return arenaClick(at, ctx);
  const t = e.target.closest('[data-a="export"]');
  if (!t) return;
  const msg = document.getElementById('impMsg'), say = txt => { if (msg) msg.textContent = txt; };
  if (withPhotos && !prepared) { say('Fotos werden vorbereitet – gleich nochmal tippen.'); return; }
  if (withPhotos && prepared.error) { say('Fotos konnten nicht gelesen werden. Für ein Backup ohne Fotos das Häkchen entfernen.'); return; }
  const backup = buildBackup(ctx.store, new Date().toISOString(), { photos: withPhotos });
  let note = '';
  if (withPhotos && prepared.none) {
    delete backup.data['body.photos'];
    note = ' · ohne Fotos (auf diesem Gerät nicht verfügbar)';
  } else if (withPhotos) {
    const n = prepared.count, m = prepared.missing;
    backup.photos = prepared.photos;
    backup.data['body.photos'] = prepared.index;
    note = ` · ${n} ${n === 1 ? 'Foto' : 'Fotos'}${m ? ` (${m} ${m === 1 ? 'fehlte' : 'fehlten'} auf diesem Gerät)` : ''}`;
  }
  const data = JSON.stringify(backup);
  try {
    const u = URL.createObjectURL(new Blob([data], { type: 'application/json' })), l = document.createElement('a');
    l.href = u;
    l.download = `life-os-backup-${today()}.json`;
    document.body.appendChild(l);
    l.click();
    l.remove();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  } catch (er) { /* download blocked */ }
  ctx.store.set('meta.lastBackup', today());
  t.textContent = 'Backup erstellt ✓';
  say('Backup gespeichert' + note);
}

export function onChange(e, route, ctx) {
  const t = e.target;
  if (t.id === 'jsonf') return integ.onChange(e, route, ctx);
  if (t.id === 'withPhotos') {
    withPhotos = !!t.checked;
    if (withPhotos) return prepare(ctx);
    gen++;
    prepared = null;
    pending = null;
    return undefined;
  }
  if (t.id !== 'imp' || !t.files[0]) return undefined;
  t.files[0].text()
    .then(async txt => {
      const before = (arenaConn(ctx) || {}).code, obj = JSON.parse(txt), r = importBackup(obj, ctx.store);
      let note = '';
      const after = arenaConn(ctx);
      if (after && after.code !== before) note += ' · Arena-Zugang aus dem Backup übernommen';
      if (obj && obj.photos && typeof obj.photos === 'object') {
        const s = photoStore();
        if (s) {
          const p = await importPhotos(s, obj.photos);
          ctx.store.set('body.photos', mergeIndex(ctx.store.get('body.photos'), p.index));
          note = ` · Fotos: ${p.written} geladen${p.failed ? `, ${p.failed} fehlgeschlagen` : ''}`;
        } else note = ' · Fotos nicht geladen (auf diesem Gerät nicht verfügbar)';
      }
      if (withPhotos) prepare(ctx);
      runMigrations(ctx.store);
      ctx.reloadAll();
      ctx.rerender();
      document.getElementById('impMsg').textContent = `Backup geladen ✓ (${r.sessions} Einheiten)${note}`;
    })
    .catch(er => { document.getElementById('impMsg').textContent = er && er.message === STORAGE_FAILED ? STORAGE_FAILED : INVALID; });
}
