# KI-Apps · Stufe 4b · Körper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Bereich Körper bauen: Messwerte mit Verläufen und Ziellinien, Fotos mit Vorher/Nachher-Vergleich in IndexedDB, den Quartals-Check, die Heute-Kachel und ein Backup wahlweise mit Fotos.

**Architecture:**
- Neuer Bereich `js/areas/body/` nach dem Bereichsvertrag mit diesen Modulen:
  - `data.js` (Felder, Ziele, Quartalspunkte)
  - `logic.js` (rein, getestet)
  - `chart.js` (Kurve im Trainings-Look, nutzt `bindChart` aus dem Training)
  - `photos.js` (IndexedDB hinter einer Schnittstelle, mit Attrappe für Tests)
  - `view.js`, `index.js`
- Werte liegen in localStorage (`body.weight`, `body.log`, `body.quarter`, Foto-Index `body.photos`), die Bilder in IndexedDB.

**Tech Stack:** Vanilla-JS-ES-Module, localStorage, IndexedDB, Canvas, `node --test` (Node 22 mit `Blob`, `btoa`/`atob`), keine Abhängigkeiten.

**Spec:**
- `docs/superpowers/specs/2026-11-26-ki-apps-stufe-4b-koerper-design.md`
- Haupt-Spec: `docs/superpowers/specs/2026-11-25-ki-apps-design.md` §6.5, §7, §8

## Global Constraints

- Keine Build-Schritte, keine Abhängigkeiten. Tests mit `npm test`.
- Werte und Fotos bleiben auf dem Gerät. Kein Netzwerkzugriff. Fotos landen nur in einem Backup, wenn „mit Fotos“ angehakt ist.
- Ziele fest: 90 kg, Körperfett 12–13 %, Größe 190 cm.
- Texte wörtlich:
  - Navigation: „Übersicht“, „Verlauf“, „Fotos“, „Messung eintragen“, „Neue Fotos“
  - Bestätigung: „Sicher? Nochmal tippen“
  - Fotos: „Foto nicht auf diesem Gerät“, „Foto konnte nicht gespeichert werden“, „Vergleich ab zwei Terminen“, „Fotos sind auf diesem Gerät nicht verfügbar“
  - Quartal und Backup: „Quartals-Check fällig · x/8“, „mit Fotos“
  - Heute: „Gewicht fehlt“, „Kommt bald: Arena“
- Fehlermeldung des Formulars: `<Feld>: <Bereich>` mit diesen Bereichen:
  - „Gewicht: 30–250 kg“
  - „Körperfett: 3–60 %“
  - Maße „<Maß>: 10–250 cm“
  - „5 km: 10:00–60:00 min“
  - „Dead-Hang: 1–600 s“
- 375 px ohne seitliches Scrollen, Tippziele ≥ 44 px.
- Kaputte gespeicherte Daten werfen nie. Heute bleibt immer stehen.
- Das Proteinziel in Ernährung (`latestWeight`, `proteinTarget`) rechnet unverändert.
- Service-Worker-Cache wird `ki-apps-v6`. Die sechs neuen Dateien kommen in `FILES`.

## Review Focus

1. **iPhone-Fotos:** Fotos von der Kamera (HEIC, 12 MP, EXIF-Drehung) und aus der Mediathek. Erwartet: aufrecht gespeichert, lange Seite ≤ 1080 px, JPEG. Lässt sich ein Bild nicht lesen, kommt eine Meldung und nichts wird in den Index geschrieben.
2. **IndexedDB nicht verfügbar oder voll:** privater Modus, Speicher voll, Fehler beim Öffnen. Erwartet:
   - Der Reiter Fotos meldet das.
   - Werte, Verlauf und Quartals-Check funktionieren weiter.
   - Ein fehlgeschlagenes Speichern meldet sich, nichts geht still verloren.
3. **Backup mit Fotos auf dem iPhone:**
   - Mehrere MB als Datei speichern.
   - So ein Backup auf einem leeren Gerät laden.
   - Ein altes Backup ohne Körper-Schlüssel laden.

   Erwartet: Die Meldung nennt gespeicherte, fehlende und fehlgeschlagene Fotos. Der Index enthält nur Bilder, die wirklich gespeichert sind.
4. **Quartalsgrenzen:**
   - Einträge am ersten bzw. letzten Tag eines Quartals.
   - Nachgetragene Werte für alte Quartale.
   - Ein Datum in der Zukunft im Formular.

   Erwartet: Ein Eintrag zählt für das Quartal seines Datums, und Zukunftsdaten fallen auf heute zurück.
5. **Kaputte Daten** in `body.weight`, `body.log`, `body.quarter` oder `body.photos` (Nicht-Objekte, falsche Typen, ungültige Daten). Erwartet: Nichts wirft, und Ernährung und Heute rechnen weiter.

---

### Task 1: Daten und reine Logik

**Files:**
- Create: `js/areas/body/data.js`, `js/areas/body/logic.js`
- Test: `tests/body-logic.test.js`

**Interfaces:**
- Produces `data.js`:
  - `GOALS = { kg: 90, fat: [12, 13], height: 190 }`
  - `FIELDS`: Liste mit `{ id, label, unit, min, max, hint, time? }`. Die `id`s in dieser Reihenfolge, Labels und Hinweise wörtlich aus den Global Constraints:
    - `kg` (Gewicht), `fat` (Körperfett)
    - Maße: `brust` Brust, `taille` Taille, `huefte` Hüfte, `arm` Oberarm, `bein` Oberschenkel, `wade` Wade
    - `run5k` (5 km, `time: true`, 600–3600 s), `hang` (Dead-Hang, `time: true`, 1–600 s)
  - `MEASURES = ['brust','taille','huefte','arm','bein','wade']`
  - `POSES = [{ id: 'vorne', label: 'vorne' }, { id: 'seitlich', label: 'seitlich' }, { id: 'hinten', label: 'hinten' }]`
  - `QUARTER_ITEMS`: in dieser Reihenfolge `{ id, label, auto?, link? }`:
    - `weight` „Gewicht messen“
    - `photos` „Körperfotos machen“
    - `measures` „Körpermaße aktualisieren“
    - `mob` „Mobility-Check“
    - `run5k` „5-km-Zeit überprüfen“
    - `plan` „Trainingsplan kritisch überprüfen“ (nicht automatisch)
    - `pain` „Verletzungen/Schmerzen dokumentieren“ (nicht automatisch, `link: '#recovery'`)
    - `hang` „Dead-Hang-Check“
- Produces `logic.js`:
  - Zahlen und Zeiten:
    - `parseNum(s) → number|null` (Komma oder Punkt, Leerzeichen erlaubt)
    - `parseTime(s) → seconds|null` („mm:ss“ mit Sekunden < 60, oder nur Sekunden)
    - `fmtTime(sec) → 'm:ss'`
    - `fmtNum(n) → string` (eine Nachkommastelle höchstens, Komma)
  - `checkForm(raw) → { ok: true, values } | { ok: false, error }`
    - `values` hat alle `FIELDS`-ids plus `mob`.
    - Leer oder fehlend wird zu `null`; `mob` wird getrimmt, leer wird `null`.
  - Bereinigen, immer mit Kopie:
    - `cleanWeights(raw)` → Datum → kg, gültige Daten, 30–250
    - `cleanLog(raw)` → nur gültige Felder, leere Tage fallen weg
    - `cleanPhotos(raw)` → Datum → `{ pose: true }`, nur bekannte Posen, leere Tage fallen weg
    - `cleanTicks(raw)` → Quartal → `{ id: true }`
  - Verlauf:
    - `measureDays(weights, log) → string[]`: Vereinigung der Daten, neueste zuerst
    - `series(weights, log, id) → [{ date, y }]`: aufsteigend, `kg` aus den Gewichten
  - Quartale:
    - `quarterOf(day) → 'YYYY-Qn'`
    - `quarterStatus(q, { weights, log, photos, ticks }) → { items: [{ ...item, auto, hand, done }], done, total: 8 }`
      - Bereinigt seine Eingaben selbst.
      - Automatisch zählt das Datum des Eintrags.
      - `measures` zählt bei mindestens einem Maß.

- [ ] **Step 1: Write the failing tests** in `tests/body-logic.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNum, parseTime, fmtTime, fmtNum, checkForm, cleanLog, cleanPhotos, measureDays, series, quarterOf, quarterStatus } from '../js/areas/body/logic.js';
import { QUARTER_ITEMS, FIELDS } from '../js/areas/body/data.js';

test('numbers and times parse German input', () => {
  assert.equal(parseNum('92,4'), 92.4);
  assert.equal(parseNum(' 92.4 '), 92.4);
  assert.equal(parseNum('x'), null);
  assert.equal(parseNum(''), null);
  assert.equal(parseTime('23:45'), 1425);
  assert.equal(parseTime('1:30'), 90);
  assert.equal(parseTime('45'), 45);
  assert.equal(parseTime('1:75'), null);
  assert.equal(parseTime(''), null);
  assert.equal(fmtTime(1425), '23:45');
  assert.equal(fmtTime(90), '1:30');
  assert.equal(fmtNum(92.44), '92,4');
  assert.equal(fmtNum(15), '15');
});

test('checkForm keeps valid values, empties become null', () => {
  const r = checkForm({ kg: '92,4', fat: '', taille: '84', run5k: '23:45', hang: '1:30', mob: ' Hüfte steif ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.values, { kg: 92.4, fat: null, brust: null, taille: 84, huefte: null, arm: null, bein: null, wade: null, run5k: 1425, hang: 90, mob: 'Hüfte steif' });
});

test('checkForm rejects the whole form and names the field', () => {
  assert.deepEqual(checkForm({ kg: '300' }), { ok: false, error: 'Gewicht: 30–250 kg' });
  assert.deepEqual(checkForm({ kg: '90', run5k: '5:00' }), { ok: false, error: '5 km: 10:00–60:00 min' });
  assert.deepEqual(checkForm({ fat: 'viel' }), { ok: false, error: 'Körperfett: 3–60 %' });
  assert.deepEqual(checkForm({ wade: '5' }), { ok: false, error: 'Wade: 10–250 cm' });
  assert.equal(FIELDS.length, 10);
});

test('cleaning drops bad dates, fields and empty days', () => {
  const raw = { '2026-11-20': { fat: 15, taille: 'x', run5k: 1425, mob: 'ok', foo: 1 }, nope: { fat: 15 }, '2026-11-21': { fat: 99 }, '2026-11-22': 'x' };
  assert.deepEqual(cleanLog(raw), { '2026-11-20': { fat: 15, run5k: 1425, mob: 'ok' } });
  for (const bad of [null, 'x', [], 5]) assert.deepEqual(cleanLog(bad), {});
  assert.deepEqual(cleanPhotos({ '2026-11-02': { vorne: true, oben: true }, '2026-11-03': {}, x: { vorne: true } }), { '2026-11-02': { vorne: true } });
});

test('measure days and series', () => {
  const w = { '2026-11-01': 93, '2026-11-20': 92.4, x: 1, '2026-11-21': 500 }, log = { '2026-11-10': { fat: 15 }, '2026-11-20': { fat: 14.5 } };
  assert.deepEqual(measureDays(w, log), ['2026-11-20', '2026-11-10', '2026-11-01']);
  assert.deepEqual(series(w, log, 'kg'), [{ date: '2026-11-01', y: 93 }, { date: '2026-11-20', y: 92.4 }]);
  assert.deepEqual(series(w, log, 'fat'), [{ date: '2026-11-10', y: 15 }, { date: '2026-11-20', y: 14.5 }]);
});

test('quarters by entry date', () => {
  assert.equal(quarterOf('2026-11-26'), '2026-Q4');
  assert.equal(quarterOf('2026-01-01'), '2026-Q1');
  assert.equal(quarterOf('2026-03-31'), '2026-Q1');
  assert.equal(quarterOf('2026-04-01'), '2026-Q2');
});

test('quarter status: automatic by entry date, hand ticks add up', () => {
  const data = {
    weights: { '2026-10-01': 92, '2026-09-30': 93 },
    log: { '2026-12-31': { hang: 60 }, '2026-09-30': { run5k: 1500, brust: 100 } },
    photos: { '2026-11-02': { vorne: true } },
    ticks: { '2026-Q4': { plan: true, run5k: true }, '2026-Q3': { pain: true } },
  };
  const s = quarterStatus('2026-Q4', data);
  assert.equal(s.items.length, 8);
  assert.deepEqual(s.items.filter(i => i.done).map(i => i.id), ['weight', 'photos', 'run5k', 'plan', 'hang']);
  assert.equal(s.items.find(i => i.id === 'run5k').auto, false);
  assert.equal(s.items.find(i => i.id === 'run5k').hand, true);
  assert.equal(s.items.find(i => i.id === 'weight').auto, true);
  assert.deepEqual([s.done, s.total], [5, 8]);
  assert.doesNotThrow(() => quarterStatus('2026-Q4', { weights: 'x', log: null, photos: [], ticks: 5 }));
  assert.equal(QUARTER_ITEMS[5].label, 'Trainingsplan kritisch überprüfen');
  assert.equal(QUARTER_ITEMS[6].link, '#recovery');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/body-logic.test.js`
Expected: FAIL, das Modul `js/areas/body/logic.js` fehlt (`ERR_MODULE_NOT_FOUND`).

- [ ] **Step 3: Implement `data.js` and `logic.js`**

Gültige Daten prüft `/^\d{4}-\d{2}-\d{2}$/`. Zahlen werden auf eine Nachkommastelle gerundet, Zeiten auf ganze Sekunden.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add js/areas/body/data.js js/areas/body/logic.js tests/body-logic.test.js
git commit -m "feat: body values, quarter check logic"
```

### Task 2: Fotospeicher und Backup-Helfer (photos.js)

**Files:**
- Create: `js/areas/body/photos.js`
- Test: `tests/body-photos.test.js`

**Interfaces:**
- Consumes: `cleanPhotos`, `POSES` aus Task 1.
- Produces:
  - **Der Fotospeicher.** Ein „Store“ hat die Methoden:
    - `put(key, blob)`, `get(key) → Blob|null`, `del(key)`, `keys() → string[]`, `size() → bytes`
    - Alle sind async.
    - Schlüssel sind `YYYY-MM-DD:pose`.
  - Speicher öffnen:
    - `memPhotos({ failKeys = [] } = {})`: Attrappe; `put` lehnt für `failKeys` ab.
    - `idbPhotos(idb = globalThis.indexedDB) → Store|null`: Datenbank `ki-apps-photos`, Objektspeicher `photos`; `null`, wenn es kein IndexedDB gibt.
  - Umwandeln (async):
    - `blobToDataUrl(blob) → string`
    - `dataUrlToBlob(url) → Blob|null` (nur `image/jpeg|png|webp`, sonst `null`)
  - Index:
    - `mergeIndex(a, b)`: Vereinigung pro Datum und Pose, beide vorher bereinigt.
    - `exportPhotos(store, index) → { photos: { key: dataUrl }, index, count, missing }` (async)
      - Nur Bilder, die der Speicher hat.
      - `index` enthält nur die exportierten Bilder.
    - `importPhotos(store, photos) → { index, written, failed }` (async)
      - Ungültige Schlüssel (Datum oder Pose) werden still übersprungen.
      - Ungültige Daten oder Schreibfehler zählen als `failed`.
      - `index` enthält nur die geschriebenen Bilder.
  - Bild verkleinern: `resizeImage(file, max = 1080, quality = 0.85) → Blob` (async, nur im Browser).
    - Nutzt `createImageBitmap(file, { imageOrientation: 'from-image' })` und ein Canvas.
    - Schlägt das fehl, kommt ein `<img>`-Fallback.
    - Wirft bei unlesbaren Dateien.

- [ ] **Step 1: Write the failing tests** in `tests/body-photos.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { memPhotos, idbPhotos, blobToDataUrl, dataUrlToBlob, exportPhotos, importPhotos, mergeIndex } from '../js/areas/body/photos.js';

const jpeg = (s = 'a') => new Blob([s], { type: 'image/jpeg' });

test('data urls round-trip a blob', async () => {
  const url = await blobToDataUrl(new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }));
  assert.match(url, /^data:image\/jpeg;base64,/);
  assert.deepEqual([...new Uint8Array(await dataUrlToBlob(url).arrayBuffer())], [1, 2, 3, 250]);
  assert.equal(dataUrlToBlob('data:text/html;base64,PGI+'), null);
  assert.equal(dataUrlToBlob('nope'), null);
});

test('no IndexedDB means no photo store', () => {
  assert.equal(idbPhotos(undefined), null);
});

test('export skips images the store does not have', async () => {
  const s = memPhotos();
  await s.put('2026-11-02:vorne', jpeg());
  const r = await exportPhotos(s, { '2026-11-02': { vorne: true, hinten: true }, x: 5 });
  assert.deepEqual(Object.keys(r.photos), ['2026-11-02:vorne']);
  assert.deepEqual(r.index, { '2026-11-02': { vorne: true } });
  assert.deepEqual([r.count, r.missing], [1, 1]);
  assert.equal(await s.size(), 1);
});

test('import keeps going when one image fails', async () => {
  const s = memPhotos({ failKeys: ['2026-11-02:hinten'] }), url = await blobToDataUrl(jpeg());
  const r = await importPhotos(s, { '2026-11-02:vorne': url, '2026-11-02:hinten': url, '2026-11-03:vorne': 'kaputt', 'x:vorne': url, '2026-11-04:oben': url });
  assert.deepEqual(r.index, { '2026-11-02': { vorne: true } });
  assert.deepEqual([r.written, r.failed], [1, 2]);
  assert.ok(await s.get('2026-11-02:vorne'));
  assert.equal(await s.get('2026-11-02:hinten'), null);
});

test('mergeIndex joins poses per day', () => {
  assert.deepEqual(mergeIndex({ '2026-11-02': { vorne: true } }, { '2026-11-02': { hinten: true }, '2026-11-03': { seitlich: true }, x: 1 }),
    { '2026-11-02': { vorne: true, hinten: true }, '2026-11-03': { seitlich: true } });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/body-photos.test.js`
Expected: FAIL, das Modul `js/areas/body/photos.js` fehlt.

- [ ] **Step 3: Implement `photos.js`**

- Base64 entsteht über `blob.arrayBuffer()` und `btoa` in Blöcken von 32 KB, zurück über `atob`. Das läuft in Node 22 und im Browser.
- `idbPhotos` öffnet die Datenbank beim ersten Aufruf und verpackt jede IndexedDB-Anfrage in ein Promise.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add js/areas/body/photos.js tests/body-photos.test.js
git commit -m "feat: photo store on IndexedDB with backup helpers"
```

### Task 3: Bereich Körper: Übersicht, Messung, Verlauf-Liste, Quartals-Check

**Files:**
- Create: `js/areas/body/view.js`, `js/areas/body/index.js`
- Modify: `js/core/routes.js`, `js/app.js`
- Test: `tests/body-area.test.js`, `tests/routes.test.js`

**Interfaces:**
- Consumes: Task 1 (`checkForm`, `clean*`, `measureDays`, `series`, `quarterOf`, `quarterStatus`, `fmtNum`, `fmtTime`, `FIELDS`, `QUARTER_ITEMS`, `GOALS`).
- `parseRoute` bekommt die Routen von Körper:

  | Hash | Route |
  |---|---|
  | `#koerper` | `{ area: 'body', view: 'overview' }` |
  | `#koerper/verlauf` | `{ area: 'body', view: 'history' }` |
  | `#koerper/fotos` | `{ area: 'body', view: 'photos' }` |
  | `#koerper/messung` | `{ area: 'body', view: 'entry', date: null }` |
  | `#koerper/messung?YYYY-MM-DD` | `{ area: 'body', view: 'entry', date: 'YYYY-MM-DD' }` |

  Andere Unterpfade führen zur Übersicht, ein ungültiges Datum wird zu `null`.
- `app.js`: `AREAS.body`, `TITLES.body = 'Körper'`.
- `index.js` exportiert:
  - Bereichsvertrag: `reload`, `onNavigate`, `header`, `render`, `mount`, `onClick`, `onInput`, `onChange`
  - `summary(ctx) → { kg: { date, y }|null, quarter: { q, done, total } }`
  - `dayOf(ctx)`
  - `onNavigate` setzt Entwurf, Fehlermeldung und Lösch-Rückfrage zurück.
- **Messung:**
  - Der Tag ist `route.date`, wenn es gültig und nicht in der Zukunft ist, sonst heute.
  - Ein Entwurf `{ date, values }` gehört zu diesem Tag. Ihn erzeugen `render` und `onInput`, wenn er fehlt, vorausgefüllt aus dem Speicher (Zahlen mit Komma, Zeiten als m:ss).
  - Felder: `<input … data-a="bf" data-k="<id>" … value="…">` bzw. eine Textarea für `mob`.
  - Datum: `<input type="date" data-a="bdate" … value="<Tag>" max="<heute>">`. Eine Änderung führt zu `ctx.go('#koerper/messung?' + Tag)`.
  - Speichern mit `data-a="bsave"`:
    - Bei Fehler gibt es `<p class="err">` mit der Meldung, und nichts wird gespeichert.
    - Sonst wird das Gewicht in `body.weight` gesetzt oder gelöscht, die übrigen Werte in `body.log` (leerer Tag wird gelöscht). Danach `ctx.go('#koerper/verlauf')`.
- **Verlauf** (in dieser Task nur die Liste der Messtage, die Kurven kommen in Task 4):
  - Jeder Tag hat einen Link `href="#koerper/messung?<Tag>"` und Löschen mit `data-a="bdel" data-d="<Tag>"`.
  - Der erste Tipp zeigt „Sicher? Nochmal tippen“. Der zweite löscht den Tag aus `body.weight` und `body.log`.
- **Übersicht:**
  - Quartals-Check mit `<input type="checkbox" data-a="qtick" data-id="<id>" checked?>` (ein Leerzeichen vor `checked`):
    - Automatische Punkte tragen den Zusatz „(automatisch)“.
    - `pain` verlinkt `#recovery`.
    - Ist alles erledigt, steht dort nur „Quartals-Check Qn erledigt ✓“.
  - Letztes Gewicht mit Abstand zu 90 kg; letzte Werte für Körperfett, 5 km und Dead-Hang.
  - Link „Messung eintragen“ (`href="#koerper/messung"`).
- **Fotos:** in dieser Task nur ein Platzhalter.
- `onChange` `qtick`: setzt oder entfernt `body.quarter[q][id]` für das aktuelle Quartal.
- `header`: `<nav class="tabs">` mit Übersicht (`#koerper`), Verlauf (`#koerper/verlauf`) und Fotos (`#koerper/fotos`). Der aktive Reiter hat `class="on"`; die Messung zählt zur Übersicht.

- [ ] **Step 1: Write the failing tests**

In `tests/routes.test.js`, im Stil der Datei:

```js
test('body routes', () => {
  assert.deepEqual(parseRoute('#koerper'), { area: 'body', view: 'overview' });
  assert.deepEqual(parseRoute('#koerper/verlauf'), { area: 'body', view: 'history' });
  assert.deepEqual(parseRoute('#koerper/fotos'), { area: 'body', view: 'photos' });
  assert.deepEqual(parseRoute('#koerper/messung?2026-11-20'), { area: 'body', view: 'entry', date: '2026-11-20' });
  assert.deepEqual(parseRoute('#koerper/messung?quatsch'), { area: 'body', view: 'entry', date: null });
  assert.deepEqual(parseRoute('#koerper/xyz'), { area: 'body', view: 'overview' });
});
```

`tests/body-area.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as body from '../js/areas/body/index.js';
import * as food from '../js/areas/food/index.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const at = (h, m, d = 26, mo = 10) => new Date(2026, mo, d, h, m);
const OV = { area: 'body', view: 'overview' }, HIST = { area: 'body', view: 'history' }, PH = { area: 'body', view: 'photos' };
const ENTRY = (date = null) => ({ area: 'body', view: 'entry', date });
const mk = (now = at(9, 0)) => {
  const store = createStore(memBackend());
  const ctx = { store, now: () => now, status: '', setStatus(t) { ctx.status = t; }, toast() {}, rerender() {}, go(h) { ctx.went = h; }, prevHash: null };
  body.reload(ctx);
  body.onNavigate(OV, ctx);
  return ctx;
};
const click = dataset => ({ target: { closest: () => ({ dataset }) } });
const fill = (ctx, values, route = ENTRY()) => { for (const [k, v] of Object.entries(values)) body.onInput({ target: { dataset: { a: 'bf', k }, value: v } }, route, ctx); };
const tick = (ctx, id, checked) => body.onChange({ target: { dataset: { a: 'qtick', id }, checked } }, OV, ctx);

test('entry saves weight and values for the day', () => {
  const ctx = mk();
  body.render(ENTRY(), ctx);
  fill(ctx, { kg: '92,4', fat: '14,5', taille: '84', run5k: '23:45', mob: 'Hüfte steif' });
  body.onClick(click({ a: 'bsave' }), ENTRY(), ctx);
  assert.deepEqual(ctx.store.get('body.weight'), { '2026-11-26': 92.4 });
  assert.deepEqual(ctx.store.get('body.log'), { '2026-11-26': { fat: 14.5, taille: 84, run5k: 1425, mob: 'Hüfte steif' } });
  assert.equal(ctx.went, '#koerper/verlauf');
  assert.equal(food.weight(ctx).kg, 92.4);
});

test('an invalid field saves nothing and names the field', () => {
  const ctx = mk();
  body.render(ENTRY(), ctx);
  fill(ctx, { kg: '92', fat: '80' });
  body.onClick(click({ a: 'bsave' }), ENTRY(), ctx);
  assert.equal(ctx.store.get('body.weight'), null);
  assert.equal(ctx.store.get('body.log'), null);
  assert.match(body.render(ENTRY(), ctx), /class="err"[^>]*>Körperfett: 3–60 %/);
});

test('a cleared field deletes only that value', () => {
  const ctx = mk();
  ctx.store.set('body.weight', { '2026-11-26': 92 });
  ctx.store.set('body.log', { '2026-11-26': { fat: 15, taille: 84 } });
  assert.match(body.render(ENTRY(), ctx), /data-a="bf" data-k="fat"[^>]*value="15"/);
  fill(ctx, { fat: '' });
  body.onClick(click({ a: 'bsave' }), ENTRY(), ctx);
  assert.deepEqual(ctx.store.get('body.log'), { '2026-11-26': { taille: 84 } });
  assert.deepEqual(ctx.store.get('body.weight'), { '2026-11-26': 92 });
});

test('an older day opens prefilled, a future day falls back to today', () => {
  const ctx = mk();
  ctx.store.set('body.weight', { '2026-11-20': 93 });
  ctx.store.set('body.log', { '2026-11-20': { run5k: 1425 } });
  const html = body.render(ENTRY('2026-11-20'), ctx);
  assert.match(html, /data-a="bf" data-k="kg"[^>]*value="93"/);
  assert.match(html, /data-a="bf" data-k="run5k"[^>]*value="23:45"/);
  assert.match(body.render(ENTRY('2026-12-01'), ctx), /data-a="bdate"[^>]*value="2026-11-26"/);
});

test('deleting a measurement day takes two taps and removes the weight too', () => {
  const ctx = mk();
  ctx.store.set('body.weight', { '2026-11-01': 93, '2026-11-20': 92 });
  ctx.store.set('body.log', { '2026-11-20': { fat: 15 } });
  assert.match(body.render(HIST, ctx), /href="#koerper\/messung\?2026-11-20"/);
  body.onClick(click({ a: 'bdel', d: '2026-11-20' }), HIST, ctx);
  assert.match(body.render(HIST, ctx), /Sicher\? Nochmal tippen/);
  assert.equal(ctx.store.get('body.weight')['2026-11-20'], 92);
  body.onClick(click({ a: 'bdel', d: '2026-11-20' }), HIST, ctx);
  assert.deepEqual(ctx.store.get('body.weight'), { '2026-11-01': 93 });
  assert.deepEqual(ctx.store.get('body.log'), {});
  assert.equal(food.weight(ctx).kg, 93);
});

test('quarter check: automatic items and hand ticks', () => {
  const ctx = mk();
  ctx.store.set('body.weight', { '2026-10-05': 92 });
  const html = body.render(OV, ctx);
  assert.match(html, /Quartals-Check/);
  assert.match(html, /1\/8/);
  assert.match(html, /data-a="qtick" data-id="weight" checked/);
  assert.match(html, /\(automatisch\)/);
  assert.match(html, /href="#recovery"/);
  tick(ctx, 'plan', true);
  assert.deepEqual(ctx.store.get('body.quarter'), { '2026-Q4': { plan: true } });
  tick(ctx, 'weight', false);
  assert.deepEqual(body.summary(ctx).quarter, { q: '2026-Q4', done: 2, total: 8 });
  for (const id of ['photos', 'measures', 'mob', 'run5k', 'pain', 'hang']) tick(ctx, id, true);
  assert.match(body.render(OV, ctx), /Quartals-Check Q4 erledigt ✓/);
});

test('summary gives the latest weight and the quarter', () => {
  const ctx = mk();
  assert.deepEqual(body.summary(ctx), { kg: null, quarter: { q: '2026-Q4', done: 0, total: 8 } });
  ctx.store.set('body.weight', { '2026-11-01': 93, '2026-11-20': 92.4 });
  assert.deepEqual(body.summary(ctx).kg, { date: '2026-11-20', y: 92.4 });
  assert.match(body.render(OV, ctx), /2,4 kg bis 90/);
});

test('malformed body data never crashes', () => {
  for (const bad of ['x', [], 5, { '2026-11-20': 'x' }, { nope: { fat: 1 } }]) {
    const ctx = mk();
    for (const k of ['body.weight', 'body.log', 'body.quarter', 'body.photos']) ctx.store.set(k, bad);
    for (const r of [OV, HIST, ENTRY(), PH]) assert.doesNotThrow(() => body.render(r, ctx), JSON.stringify(bad));
    assert.doesNotThrow(() => body.summary(ctx));
    tick(ctx, 'plan', true);
    body.render(ENTRY(), ctx);
    fill(ctx, { kg: '90' });
    body.onClick(click({ a: 'bsave' }), ENTRY(), ctx);
    assert.equal(ctx.store.get('body.weight')['2026-11-26'], 90, JSON.stringify(bad));
  }
});

test('header highlights the tab', () => {
  assert.match(body.header({ area: 'body', view: 'history' }), /href="#koerper\/verlauf" class="on"/);
  assert.match(body.header(ENTRY()), /href="#koerper" class="on"/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. `js/areas/body/index.js` fehlt, und die Körper-Routen landen auf `heute`.

- [ ] **Step 3: Implement routes, app wiring, `view.js` and `index.js`**

Das Muster ist `js/areas/food/index.js`: `put` mit `setStatus` bei vollem Speicher, `twice`-artige Rückfrage, `map`-Leser.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add js/areas/body/view.js js/areas/body/index.js js/core/routes.js js/app.js tests/body-area.test.js tests/routes.test.js
git commit -m "feat: body area with entry, history list and quarter check"
```

### Task 4: Kurven im Verlauf (chart.js)

**Files:**
- Create: `js/areas/body/chart.js`
- Modify: `js/areas/body/index.js`, `js/areas/body/view.js`, `styles.css`
- Test: `tests/body-chart.test.js`, `tests/body-area.test.js`

**Interfaces:**
- Consumes:
  - `series`, `fmtNum`, `fmtTime`, `FIELDS`, `GOALS` (Task 1)
  - `ticks` aus `js/areas/training/logic.js`, `bindChart` aus `js/areas/training/chart.js`
- Produces: `lineChart({ pts, label, unit, fmt = fmtNum, goal = null, band = null, width }) → { html, ch }`
  - `html` hat das Markup von `chartSvg`: `<div class="chart"><svg …>…</svg><div class="tip"></div></div>`.
  - `ch = { W, pts: [{ x, y, val: '<fmt(y)> <unit>', lines: [dfmt(date)] }] }` passt zu `bindChart`.
  - Der Wertebereich schließt `goal` bzw. `band` ein.
  - Ziellinie: `<line class="goal" x1=… x2=… y1=… y2=…>` gestrichelt, Beschriftung „Ziel 90“.
  - Zielband: `<rect class="band" …>`, Beschriftung „Ziel 12–13 %“.
  - Zeiten (`run5k`, `hang`) nutzen `fmt = fmtTime`, die Einheit ist „min“ bzw. „s“.
- Verlauf zeigt über der Liste für jedes Feld aus `FIELDS`:
  - mit ≥ 2 Punkten eine Kurve in `<div class="bchart">`;
  - mit genau einem Punkt eine Zeile `<Label> <Wert> <Einheit> am <dfmt(Tag)>`.
- `mount` bindet jede `.bchart` einzeln mit `bindChart(el, CH[i])`. `CH` merkt sich der Bereich beim Zeichnen; die Breite kommt aus `#main.clientWidth`, Standard 600.

- [ ] **Step 1: Write the failing tests**

`tests/body-chart.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { lineChart } from '../js/areas/body/chart.js';
import { fmtTime } from '../js/areas/body/logic.js';

const two = [{ date: '2026-11-01', y: 93 }, { date: '2026-11-20', y: 92.4 }];

test('weight chart draws the goal line below the points', () => {
  const r = lineChart({ pts: two, label: 'Gewicht', unit: 'kg', goal: 90, width: 375 });
  assert.match(r.html, /class="goal"/);
  assert.match(r.html, /Ziel 90/);
  assert.equal(r.ch.pts.length, 2);
  assert.equal(r.ch.pts[1].val, '92,4 kg');
  const yGoal = +r.html.match(/class="goal"[^>]*y1="([\d.]+)"/)[1];
  assert.ok(yGoal > Math.max(...r.ch.pts.map(p => p.y)));
});

test('body fat band and time values', () => {
  const fat = lineChart({ pts: [{ date: '2026-11-01', y: 16 }, { date: '2026-11-20', y: 15 }], label: 'Körperfett', unit: '%', band: [12, 13], width: 375 });
  assert.match(fat.html, /class="band"/);
  assert.match(fat.html, /Ziel 12–13 %/);
  const run = lineChart({ pts: [{ date: '2026-10-01', y: 1500 }, { date: '2026-11-01', y: 1425 }], label: '5 km', unit: 'min', fmt: fmtTime, width: 375 });
  assert.equal(run.ch.pts[1].val, '23:45 min');
  assert.doesNotMatch(run.html, /class="goal"|class="band"/);
});
```

In `tests/body-area.test.js`:

```js
test('history draws a chart from two weights, one value stays a number', () => {
  const ctx = mk();
  ctx.store.set('body.weight', { '2026-11-01': 93, '2026-11-20': 92.4 });
  ctx.store.set('body.log', { '2026-11-20': { fat: 14.5 } });
  const html = body.render(HIST, ctx);
  assert.match(html, /class="goal"/);
  assert.match(html, /Körperfett 14,5 %/);
  assert.equal((html.match(/<svg/g) || []).length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. `chart.js` fehlt, und der Verlauf zeigt keine Kurve.

- [ ] **Step 3: Implement `chart.js`, the history curves and their CSS**

`.chart .goal` ist gestrichelt mit `var(--acc)`, `.chart .band` ist eine Fläche mit `var(--acc)` bei geringer Deckkraft. Abstand zwischen den Kurven wie im Training.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add js/areas/body/chart.js js/areas/body/index.js js/areas/body/view.js styles.css tests/body-chart.test.js tests/body-area.test.js
git commit -m "feat: body history curves with goal line and band"
```

### Task 5: Reiter Fotos mit Vorher/Nachher-Vergleich

**Files:**
- Modify: `js/areas/body/index.js`, `js/areas/body/view.js`, `styles.css`
- Test: `tests/body-area.test.js`

**Interfaces:**
- Consumes: `idbPhotos`, `resizeImage`, `cleanPhotos`, `POSES` (Tasks 1, 2).
- Produces in `index.js`:
  - `setPhotoStore(store|null)`, `setResizer(fn)` für Tests.
  - `photoStore()`: liefert den gesetzten Speicher. Sonst öffnet es einmal `idbPhotos()`; `null` heißt „nicht verfügbar“.
- Bildschirm-Zustand (`onNavigate` setzt ihn zurück):
  - `pday` (Tag für neue Fotos, Standard heute)
  - `pa`, `pb` (Vergleichstage, Standard ältester und neuester)
  - `pose` (Standard `vorne`)
  - Lösch-Rückfrage
- Markup:
  - Neue Fotos:
    - `<input type="date" data-a="pdate" …>`
    - pro Pose `<input type="file" accept="image/*" data-a="pfile" data-pose="<pose>">`, darüber das vorhandene Bild des Tages als `<img data-photo="<Tag>:<pose>" …>`
  - Vergleich:
    - `<select data-a="pa">` und `<select data-a="pb">` mit den Foto-Tagen
    - Knöpfe `data-a="ppose" data-pose="<pose>"`
    - zwei Bilder `<img data-photo="<Tag>:<pose>" alt="<pose> <dfmt(Tag)>">`. Fehlt die Pose an einem Tag, steht dort „kein Foto“.
    - Mit nur einem Foto-Tag wird dieser allein gezeigt, mit dem Hinweis „Vergleich ab zwei Terminen“.
  - Liste der Foto-Tage mit Löschen `data-a="pdel" data-d="<Tag>"`. Der erste Tipp zeigt „Sicher? Nochmal tippen“.
  - Ohne Speicher: „Fotos sind auf diesem Gerät nicht verfügbar“. Die anderen Reiter laufen weiter.
- `onChange` `pfile` (async, gibt ein Promise zurück):
  1. Bild mit `resize(file)` verkleinern.
  2. `store.put(Tag:pose, blob)`.
  3. Erst danach `body.photos[Tag][pose] = true` setzen und neu zeichnen.
  4. Bei Fehler: `ctx.setStatus('Foto konnte nicht gespeichert werden')`, der Index bleibt unverändert.
- `onClick` `pdel` (async): Der zweite Tipp löscht alle Posen des Tages im Speicher und dann den Tag aus dem Index.
- `mount` lädt für jedes `img[data-photo]` das Bild aus dem Speicher als Object-URL.
  - Fehlt es, wird das `<img>` durch „Foto nicht auf diesem Gerät“ ersetzt.
  - Object-URLs werden beim nächsten `mount` und in `onNavigate` freigegeben.

- [ ] **Step 1: Write the failing tests** in `tests/body-area.test.js`:

```js
import { memPhotos } from '../js/areas/body/photos.js'; // zum Kopf der Datei

const small = async () => new Blob(['small'], { type: 'image/jpeg' });
const pick = (ctx, pose) => body.onChange({ target: { dataset: { a: 'pfile', pose }, files: [new Blob(['big'])] } }, PH, ctx);

test('a photo is indexed only after the store has it', async () => {
  const ctx = mk(), s = memPhotos();
  body.setPhotoStore(s);
  body.setResizer(small);
  await pick(ctx, 'vorne');
  assert.deepEqual(ctx.store.get('body.photos'), { '2026-11-26': { vorne: true } });
  assert.ok(await s.get('2026-11-26:vorne'));
});

test('a failed save shows a message and indexes nothing', async () => {
  const ctx = mk();
  body.setPhotoStore(memPhotos({ failKeys: ['2026-11-26:vorne'] }));
  body.setResizer(small);
  await pick(ctx, 'vorne');
  assert.equal(ctx.store.get('body.photos'), null);
  assert.match(ctx.status, /Foto konnte nicht gespeichert werden/);
  body.setResizer(async () => { throw new Error('HEIC'); });
  body.setPhotoStore(memPhotos());
  await pick(ctx, 'hinten');
  assert.equal(ctx.store.get('body.photos'), null);
});

test('compare shows the oldest and newest day side by side', () => {
  const ctx = mk();
  body.setPhotoStore(memPhotos());
  ctx.store.set('body.photos', { '2026-08-01': { vorne: true }, '2026-09-01': { vorne: true }, '2026-11-02': { vorne: true, seitlich: true } });
  let html = body.render(PH, ctx);
  assert.match(html, /data-photo="2026-08-01:vorne"/);
  assert.match(html, /data-photo="2026-11-02:vorne"/);
  body.onChange({ target: { dataset: { a: 'pa' }, value: '2026-09-01' } }, PH, ctx);
  body.onClick(click({ a: 'ppose', pose: 'seitlich' }), PH, ctx);
  html = body.render(PH, ctx);
  assert.match(html, /data-photo="2026-11-02:seitlich"/);
  assert.match(html, /kein Foto/);
});

test('one photo day stands alone with a hint', () => {
  const ctx = mk();
  body.setPhotoStore(memPhotos());
  ctx.store.set('body.photos', { '2026-11-02': { vorne: true } });
  assert.match(body.render(PH, ctx), /Vergleich ab zwei Terminen/);
});

test('deleting a photo day takes two taps and removes the images', async () => {
  const ctx = mk(), s = memPhotos();
  body.setPhotoStore(s);
  await s.put('2026-11-02:vorne', await small());
  ctx.store.set('body.photos', { '2026-11-02': { vorne: true } });
  await body.onClick(click({ a: 'pdel', d: '2026-11-02' }), PH, ctx);
  assert.match(body.render(PH, ctx), /Sicher\? Nochmal tippen/);
  await body.onClick(click({ a: 'pdel', d: '2026-11-02' }), PH, ctx);
  assert.deepEqual(ctx.store.get('body.photos'), {});
  assert.equal(await s.get('2026-11-02:vorne'), null);
});

test('without a photo store the tab says so', () => {
  const ctx = mk();
  body.setPhotoStore(null);
  ctx.store.set('body.weight', { '2026-11-20': 92 });
  assert.match(body.render(PH, ctx), /Fotos sind auf diesem Gerät nicht verfügbar/);
  assert.match(body.render(OV, ctx), /92 kg/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. `setPhotoStore` ist nicht exportiert, und der Reiter Fotos ist noch der Platzhalter aus Task 3.

- [ ] **Step 3: Implement the photos view, handlers, `mount` loading and CSS**

- Die beiden Vergleichsbilder stehen bei 375 px nebeneinander, je die halbe Breite, mit `object-fit: contain` und gleichem Seitenverhältnis (3:4).
- Die Auswahlfelder und Pose-Knöpfe sind mindestens 44 px hoch.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add js/areas/body/index.js js/areas/body/view.js styles.css tests/body-area.test.js
git commit -m "feat: body photos with before/after comparison"
```

### Task 6: Heute, Backup mit Fotos, Einstellungen, Cache v6

**Files:**
- Modify:
  - `js/areas/heute.js`, `js/core/backup.js`, `js/areas/settings.js`
  - `sw.js`, `styles.css`
- Test: `tests/heute.test.js`, `tests/backup.test.js`

**Interfaces:**
- Consumes:
  - `summary` aus `js/areas/body/index.js` (Task 3)
  - `photoStore` (Task 5), `exportPhotos`, `importPhotos`, `mergeIndex`, `cleanPhotos` (Tasks 1, 2), `fmtNum` (Task 1)
- `heute.js`:
  - `export let bodySummary = ctx => bodySum(ctx)` und `setBodySummary(fn)`, gelesen mit `safe(...)`.
  - Kachel `<a class="tile" href="#koerper">` mit Label „Körper“:
    - mit Gewicht: „<fmtNum(kg)> kg“ und „<fmtNum(|kg−90|)> kg bis 90“, bei weniger als 0,05 kg Abstand „Ziel erreicht ✓“;
    - ohne Gewicht: „Gewicht fehlt“.
  - Solange der Quartals-Check nicht erledigt ist, nach der Backup-Karte `<a class="card warn" href="#koerper"><b>Quartals-Check fällig · x/8</b><span>Qn JJJJ · abhaken ›</span></a>`.
  - Die „Kommt bald“-Zeile nennt nur noch Arena.
- `backup.js`:
  - `PER_KEY` bekommt `body.log` und `body.quarter` dazu.
  - `buildBackup(store, exportedIso, { photos = false } = {})` lässt `body.photos` weg, außer bei `photos: true`.
  - `importBackup` übernimmt `body.photos` nie direkt. Den Index baut `importPhotos` aus den wirklich geschriebenen Bildern.
- `settings.js`:
  - Beim Backup ein Häkchen `<input type="checkbox" id="withPhotos">` mit „mit Fotos“, daneben `<span id="photoSize">`. `mount` füllt es mit „Fotos: x,x MB“ aus `photoStore().size()` bzw. „keine Fotos“.
  - Speichern wird async:
    - Mit Häkchen kommen die Fotos über `exportPhotos` dazu (`backup.photos`, `backup.data['body.photos']`).
    - Die Meldung in `#impMsg` lautet z. B. „Backup gespeichert · 12 Fotos (1 fehlte auf diesem Gerät)“.
  - Laden:
    1. Nach `importBackup` kommt `importPhotos` für `obj.photos`, falls vorhanden.
    2. Danach `body.photos = mergeIndex(alt, r.index)`.
    3. Die Meldung ergänzt „· Fotos: x geladen, y fehlgeschlagen“.
- `sw.js`: `CACHE = 'ki-apps-v6'`. `FILES` bekommt alle sechs `js/areas/body/*.js`.

- [ ] **Step 1: Write the failing tests**

In `tests/heute.test.js` (Import ergänzen: `setBodySummary, bodySummary as bodySummaryDefault`):

```js
test('body tile shows the latest weight and the distance to 90', () => {
  const s = createStore(memBackend());
  s.set('body.weight', { '2026-11-20': 92.4 });
  const html = render({ area: 'heute' }, ctx(s));
  assert.match(html, /href="#koerper"/);
  assert.match(html, /92,4 kg/);
  assert.match(html, /2,4 kg bis 90/);
  assert.match(render({ area: 'heute' }, ctx()), /Gewicht fehlt/);
});

test('quarter card shows until all eight are done', () => {
  const s = createStore(memBackend());
  assert.match(render({ area: 'heute' }, ctx(s)), /Quartals-Check fällig · 0\/8/);
  s.set('body.quarter', { '2026-Q4': Object.fromEntries(['weight', 'photos', 'measures', 'mob', 'run5k', 'plan', 'pain', 'hang'].map(k => [k, true])) });
  assert.doesNotMatch(render({ area: 'heute' }, ctx(s)), /Quartals-Check/);
});

test('broken body summary keeps Heute up', () => {
  const original = bodySummaryDefault;
  setBodySummary(() => { throw new Error('x'); });
  try { assert.match(render({ area: 'heute' }, ctx()), /Bereiche/); } finally { setBodySummary(original); }
});
```

Den bestehenden Test `coming-soon line after routines` anpassen: `soon` passt jetzt auf `/Arena/`, aber nicht mehr auf `/Körper/`.

In `tests/backup.test.js`:

```js
test('body keys merge per date; the photo index stays out of a plain backup', () => {
  const a = fresh();
  a.set('body.log', { '2026-11-20': { fat: 15 } });
  a.set('body.photos', { '2026-11-02': { vorne: true } });
  assert.equal('body.photos' in buildBackup(a, 'iso').data, false);
  assert.deepEqual(buildBackup(a, 'iso', { photos: true }).data['body.photos'], { '2026-11-02': { vorne: true } });
  const b = fresh();
  b.set('body.log', { '2026-11-21': { fat: 14 } });
  b.set('body.quarter', { '2026-Q3': { plan: true } });
  importBackup({ app: 'ki-apps', v: 1, data: { 'body.log': { '2026-11-20': { fat: 15 } }, 'body.quarter': { '2026-Q4': { pain: true } }, 'body.photos': { '2026-11-02': { vorne: true } } } }, b);
  assert.deepEqual(b.get('body.log'), { '2026-11-21': { fat: 14 }, '2026-11-20': { fat: 15 } });
  assert.deepEqual(b.get('body.quarter'), { '2026-Q3': { plan: true }, '2026-Q4': { pain: true } });
  assert.equal(b.get('body.photos'), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. Die Kachel und die Quartals-Karte fehlen, „Kommt bald“ nennt noch Körper, und `body.photos` landet im Backup.

- [ ] **Step 3: Implement Heute, backup options, settings export/import with photos, and `sw.js` v6**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün. Ein Vergleich von `FILES` in `sw.js` mit allen Dateien unter `js/` zeigt nichts Fehlendes.

- [ ] **Step 5: Check in the browser preview at 375×812**

Klicks per `el.click()` ohne Fokus, Zeiten über einen Unterklassen-`Date`. Bilder entstehen als Testbilder über ein Canvas (`canvas.toBlob` → `File` → `DataTransfer` → `input.files`, dann `change` auslösen).

Zu prüfen:
- Messung eintragen, Verlauf mit Kurven (Ziellinie und Band sichtbar, Tipp-Anzeige folgt dem Finger) und Messtag löschen.
- Quartals-Check auf Übersicht und Heute.
- Neue Fotos für zwei Tage: die gespeicherte lange Seite ist ≤ 1080 px. Dann Vergleich, Pose wechseln, einen Tag löschen.
- Einstellungen: die Foto-Größe wird angezeigt.
- Backup mit Fotos: Die Datei enthält `photos`. Laden in einen frischen Speicher stellt die Bilder her.

Expected: `scrollWidth` 375 in allen Ansichten, keine Konsolenfehler. Danach die Testdaten der Vorschau sichern und wiederherstellen. Die Sicherung liegt in `sessionStorage` bzw. als Kopie, die ein Neuladen übersteht, und gelöscht wird erst, nachdem die Sicherung gelesen ist.

- [ ] **Step 6: Commit**

```bash
git add js/areas/heute.js js/core/backup.js js/areas/settings.js sw.js styles.css tests/heute.test.js tests/backup.test.js
git commit -m "feat: body on Heute, backup with photos, cache v6"
```

- [ ] **Step 7: Final review, then push (freigegeben mit diesem Plan)**

Nach dem Abschluss-Review und dem Fix-Pass:
1. `git push origin main` ausführen.
2. Prüfen, bis `https://julians4.github.io/ki-apps/sw.js` `ki-apps-v6` enthält und `js/areas/body/index.js` mit 200 antwortet.
3. Live kurz prüfen: Körper öffnen, alle drei Reiter, keine Konsolenfehler.
