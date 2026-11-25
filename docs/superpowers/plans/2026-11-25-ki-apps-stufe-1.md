# KI-Apps · Stufe 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die neue App KI-Apps mit Startseite „Heute“, Einstellungen (Backup) und dem vollständigen Trainingsbereich bauen, die Daten aus der alten Hybrid-Training-App übernehmen und unter `julians4.github.io/ki-apps/` live schalten.

**Architecture:** Statische PWA ohne Build-Schritt. Eine `index.html` lädt `js/app.js` als ES-Modul. Reine Logik (Datum, Speicher, Routen, Week Routine, Backup, Trainingslogik) liegt in eigenen Modulen ohne DOM-Zugriff und wird mit `node --test` geprüft. Die Oberfläche jedes Bereichs ist ein Modul mit `render/mount/on*`, das `app.js` über die Route aufruft. Der Trainingsbereich ist eine Portierung von `hybrid-training/index.html` (Stand Commit `90dc751`).

**Tech Stack:** HTML, CSS, Vanilla-JS (ES-Module), localStorage, Service Worker, GitHub Pages. Tests: Node ≥ 22 mit `node:test` und `node:assert/strict`, ohne npm-Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-11-25-ki-apps-design.md` (Abschnitte 1–5, 6.1, 8, 11 · Stufe 1)

## Global Constraints

- Kein Build-Schritt, keine Laufzeit-Abhängigkeiten. Tests nur mit `node:test` und `node:assert/strict`. `package.json` hat `"type": "module"` und keine `dependencies`.
- Live-Adresse `https://julians4.github.io/ki-apps/`, Repo `JulianS4/ki-apps`, Branch `main`, Pages aus dem Root.
- Alle localStorage-Schlüssel beginnen mit `ki.`. In Stufe 1 gibt es `ki.train.plan`, `ki.train.sess` und `ki.meta.lastBackup`.
- Persönliche Daten verlassen das Gerät nie. In Stufe 1 gibt es keinerlei Netzwerkzugriffe außer Google Fonts und dem Apple-Health-Kurzbefehl-Link.
- UI-Sprache Deutsch, Zahlen mit Dezimalkomma (`12,5`), Datumsformat intern `YYYY-MM-DD` in lokaler Gerätezeit (Europe/Berlin).
- Look & Feel wie Hybrid Training: Schrift Archivo, Akzent `#e4002b`, Farben über `light-dark()`, eine Spalte bis 720 px, große Tap-Ziele (≥ 44 px).
- Der Trainingsbereich kann alles, was `hybrid-training@90dc751` kann: Wochenplan, Supersätze, Pausentimer, Rekorde, Fortschritt pro Übung, Nachtragen, Plan bearbeiten, Apple Health.
- **Reihenfolge-Entscheidung:** Mobility-Checkbox und Sonntags-Wochen-Check bleiben in Stufe 1 im Training. Sie ziehen erst in Stufe 2 nach Recovery, damit bis dahin nichts fehlt.
- Backup-Datei der neuen App: `{ app: 'ki-apps', v: 1, exported, data }`. Die alte App erzeugt `{ app: 'hybrid-training', v: 1, exported, plan, sess }`.

## Review Focus

1. **Echtes altes Backup mit lückenhaften Einheiten:** Einheiten ohne `n`, `health`, `week` oder mit Löchern in `sets`-Arrays werden importiert und angezeigt, ohne Absturz. Abgedeckt durch Test `importBackup keeps sparse legacy sessions` in Task 3.
2. **Mitternacht in „Jetzt / Als Nächstes“:** Montag 05:30 ist noch „Schlafen“ vom Sonntag, Sonntag 11:45 liegt in einer Lücke und zeigt nur „Als Nächstes“. Abgedeckt durch Tests in Task 2.
3. **Frische Installation ohne Daten:** „Heute“ und Training rendern mit Startplan, ohne Fehler. Abgedeckt durch `computePRs on empty sess` in Task 4 und die Browser-Prüfung in Task 6.
4. **Speicher nicht verfügbar oder voll** (privater Modus): `store.set` gibt `false` zurück, die Statuszeile meldet „Speichern nicht möglich“, die App stürzt nicht ab. Abgedeckt durch Test `set returns false when backend throws` in Task 1.
5. **Alte oder kaputte Links:** `#mo`, `#verlauf`, `#x-pistol` landen im Training, Unbekanntes landet auf „Heute“. Abgedeckt durch Tests in Task 2.

---

### Task 1: Projektgerüst, Datum und Speicher

**Files:**
- Create: `package.json`, `.gitignore`, `js/core/dates.js`, `js/core/store.js`, `tests/helpers.js`, `tests/dates.test.js`, `tests/store.test.js`
- Existing: `docs/superpowers/specs/2026-11-25-ki-apps-design.md`, `docs/superpowers/plans/2026-11-25-ki-apps-stufe-1.md`

**Interfaces:**
- Produces (`js/core/dates.js`):
  - `DAYS: string[]` = `['mo','di','mi','do','fr','sa','so']`
  - `DN: Record<string,string>` = `{mo:'Mo',…,so:'So'}`
  - `ds(d: Date): string`
  - `today(): string`
  - `dayIdx(d: Date): number` (Mo = 0)
  - `monday(d = new Date()): Date` (12:00 Uhr des Montags)
  - `addDays(day: string, n: number): string`
  - `dshort(day: string): string`
  - `dfmt(day: string): string`
- Produces (`js/core/store.js`): `createStore(backend, prefix = 'ki.')` → `{ get(key, fallback = null), set(key, value): boolean, remove(key), keys(): string[] }`. Schlüssel werden ohne Präfix übergeben, `keys()` liefert sie ohne Präfix.
- Produces (`tests/helpers.js`): `memBackend(): Storage-artig` mit `getItem`, `setItem`, `removeItem`, `key(i)` und `length`, Map-basiert.

- [ ] **Step 1:** `git init` in `ki-apps/`. Dann `package.json` anlegen: `{ "name": "ki-apps", "private": true, "type": "module", "scripts": { "test": "node --test tests/" } }`. `.gitignore` mit `node_modules/` und `.DS_Store`.
- [ ] **Step 2: Failing tests** in `tests/dates.test.js`:

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { ds, dayIdx, monday, addDays, dfmt, dshort } from '../js/core/dates.js';
test('ds formats local date', () => assert.equal(ds(new Date(2026,10,25,8)), '2026-11-25'));
test('dayIdx monday-based', () => assert.equal(dayIdx(new Date(2026,10,25)), 2));
test('monday of wed and sun', () => {
  assert.equal(ds(monday(new Date(2026,10,25))), '2026-11-23');
  assert.equal(ds(monday(new Date(2026,10,29))), '2026-11-23');
});
test('addDays across month, year and DST', () => {
  assert.equal(addDays('2026-11-30', -1), '2026-11-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-10-24', 1), '2026-10-25');
  assert.equal(addDays('2027-03-27', 1), '2027-03-28');
});
test('dfmt and dshort', () => { assert.equal(dfmt('2026-11-25'), 'Mi 25.11.'); assert.equal(dshort('2026-01-05'), '5.1.'); });
```

  Und in `tests/store.test.js`, Tests mit diesen Namen und Assertions:
  - `set and get roundtrip`: `set('train.plan',{a:1})` ist `true`, danach `get('train.plan')` deep-equal `{a:1}`, und `backend.getItem('ki.train.plan')` ist `'{"a":1}'`
  - `get missing returns fallback`: `get('x', 7) === 7`
  - `get corrupt json returns fallback`: Backend-Wert `'{oops'` ergibt `get('x','f') === 'f'`
  - `set returns false when backend throws`: `setItem` wirft, dann ist `set('x',1) === false`
  - `keys lists only prefixed`: Backend enthält `ki.a`, `ki.b` und `tr-sess`, dann ist `keys().sort()` deep-equal `['a','b']`
- [ ] **Step 3:** `npm test` ausführen. Erwartet: FAIL mit „Cannot find module …/js/core/dates.js“.
- [ ] **Step 4:** `js/core/dates.js` und `js/core/store.js` mit den Signaturen oben implementieren. `addDays` rechnet über `new Date(day + 'T12:00:00')`, damit die Zeitumstellung keine Rolle spielt. `store.get` und `store.set` fangen alle Fehler ab.
- [ ] **Step 5:** `npm test` ausführen. Erwartet: alle Tests PASS.
- [ ] **Step 6: Commit** mit allen Dateien inklusive `docs/`: `git commit -m "chore: scaffold ki-apps with date and storage core"`

### Task 2: Routen und Week Routine

**Files:**
- Create: `js/core/routes.js`, `js/core/schedule.js`, `tests/routes.test.js`, `tests/schedule.test.js`

**Interfaces:**
- Consumes: `DAYS`, `dayIdx`, `ds` aus `dates.js`
- Produces:
  - `parseRoute(hash: string): { area: 'heute'|'training'|'settings', view?: 'day'|'hist'|'ex', day?: string|null, ex?: string }`
  - `WEEK_ROUTINE: Record<DayId, Array<{ start: 'HH:MM', end: 'HH:MM', title: string }>>`
  - `nowNext(date: Date): { now: Block|null, next: Block & { day: DayId } }`

- [ ] **Step 1: Failing tests** in `tests/routes.test.js`, jeweils `assert.deepEqual(parseRoute(h), erwartet)`:

| hash | erwartet |
|---|---|
| `''`, `'#'`, `'#heute'` | `{area:'heute'}` |
| `'#training'` | `{area:'training', view:'day', day:null}` |
| `'#training/mo'` | `{area:'training', view:'day', day:'mo'}` |
| `'#training/verlauf'` | `{area:'training', view:'hist'}` |
| `'#training/x-pistol'` | `{area:'training', view:'ex', ex:'pistol'}` |
| `'#einstellungen'` | `{area:'settings'}` |
| `'#mo'` (alt) | `{area:'training', view:'day', day:'mo'}` |
| `'#verlauf'` (alt) | `{area:'training', view:'hist'}` |
| `'#x-pistol'` (alt) | `{area:'training', view:'ex', ex:'pistol'}` |
| `'#mehr'` (alt), `'#quatsch'`, `'#training/zz'` | `{area:'heute'}` bzw. für `#training/zz` `{area:'training', view:'day', day:null}` |

  In `tests/schedule.test.js` prüft jeder Test `nowNext(new Date(2026, 10, T, h, m))` (November 2026: 23 = Mo, 25 = Mi, 27 = Fr, 28 = Sa, 29 = So, 30 = Mo):
  - Mo 23.11. 16:30 → `now.title === 'Lower A Training'`, `next.start === '17:45'`
  - Mo 30.11. 05:30 → `now.title === 'Schlafen'` (Block vom Sonntag), `next.title === 'Morgenroutine'`, `next.start === '06:00'`
  - Sa 28.11. 07:30 → `now.title === 'Morgenroutine'`, `next.start === '08:00'`
  - Fr 27.11. 22:00 → `now.title === 'Abendroutine'`, `next.title === 'Schlafen'`, `next.start === '22:30'`
  - So 29.11. 11:45 → `now === null`, `next.title === 'Sonntag Routine'`, `next.start === '12:00'`
  - Mi 25.11. 23:00 → `now.title === 'Schlafen'`, `next.title === 'Morgenroutine'`, `next.day === 'do'`
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL, Module fehlen.
- [ ] **Step 3:** `js/core/routes.js` implementieren. Bekannte Training-Tage kommen aus `DAYS`, unbekannte Unterpfade im Training ergeben `day:null`.
- [ ] **Step 4:** `js/core/schedule.js` implementieren. Die Titel stehen exakt in der Tabelle unten und kommen aus Spec 5.

  Algorithmus von `nowNext`:
  - Minuten seit Mitternacht `t` berechnen.
  - **now:** Zuerst ein Block des Vortags mit `end < start` und `t < end`. Sonst ein heutiger Block mit `start ≤ t < (end > start ? end : 24:00)`.
  - **next:** Der erste heutige Block mit `start > t`, sonst der erste Block des Folgetags. `next.day` ist der Tag dieses Blocks.

| Tage | Blöcke (start–end Titel) |
|---|---|
| mo, di, do | 06:00–07:00 Morgenroutine · 07:00–07:15 Zur Arbeit fahren · 07:15–16:00 Arbeit + Frühstück, Supps & Mittag · 16:00–16:15 Heimfahrt · 16:15–17:45 {Lower A, Upper A, Lower B} Training · 17:45–20:30 Deep Work + Abendessen & Supps · 20:30–21:30 Abendroutine · 21:30–06:00 Schlafen |
| mi | wie mo bis 16:15 · 16:15–17:00 Joggen · 17:00–20:30 Recovery + Abendessen, Mealprep & Supps · 20:30–21:30 Abendroutine · 21:30–06:00 Schlafen |
| fr | wie mo bis 16:15 · 16:15–17:45 Upper B Training · 17:45–21:30 Deep Work + Abendessen & Supps · 21:30–22:30 Abendroutine · 22:30–07:00 Schlafen |
| sa | 07:00–08:00 Morgenroutine · 08:00–14:30 Deep Work + Frühstück & Supps · 14:30–15:00 Zum Training fahren · 15:00–16:30 Athlete Day · 16:30–21:00 Recovery + Freizeit · 21:00–21:30 Heimfahrt · 21:30–22:30 Abendroutine · 22:30–07:00 Schlafen |
| so | 07:00–08:00 Morgenroutine · 08:00–09:30 Recovery + Frühstück & Supps · 09:30–11:30 Kirche · 12:00–14:00 Sonntag Routine · 14:00–20:00 Freizeit · 20:00–20:30 Mealprep & Supplement-Prep · 20:30–21:30 Abendroutine · 21:30–06:00 Schlafen |

- [ ] **Step 5:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 6: Commit:** `git commit -m "feat: add routes and week routine schedule"`

### Task 3: Backup und Umzug

**Files:**
- Create: `js/core/backup.js`, `tests/backup.test.js`

**Interfaces:**
- Consumes: Store aus Task 1
- Produces:
  - `buildBackup(store, exportedIso: string): { app:'ki-apps', v:1, exported, data: Record<string, unknown> }`. `data` enthält alle Store-Schlüssel außer `meta.lastBackup`.
  - `importBackup(obj: unknown, store): { kind: 'ki-apps'|'hybrid-training', sessions: number }`. Wirft `Error('Keine gültige Backup-Datei')`, wenn die Datei kein bekanntes Format hat.

  Merge-Regeln:
  - `train.sess` wird pro Einheitsschlüssel zusammengeführt, bei gleichem Schlüssel gewinnt das Backup.
  - `train.plan` wird nur ersetzt, wenn `plan.days` 7 Einträge hat.
  - Alle anderen Schlüssel werden ersetzt.
  - `sessions` ist die Anzahl der Einheiten im Backup.

- [ ] **Step 1: Failing tests** in `tests/backup.test.js`:
  - `legacy import maps plan and sessions`: `{app:'hybrid-training', v:1, plan:{v:1, days:[7×{id}]}, sess:{'s_2026-11-23_mo':{date:'2026-11-23', day:'mo', sets:{pistol:[{v:'6', w:'15', ok:true}]}}}}` ergibt `kind === 'hybrid-training'` und `sessions === 1`. `store.get('train.sess')` enthält den Schlüssel, `store.get('train.plan').days.length === 7`.
  - `importBackup keeps sparse legacy sessions`: Die Einheit `{date:'2026-11-24', day:'di', sets:{wpush:[null, {v:'8', ok:true}]}}` ohne `n`, `warm` oder `week` wird unverändert übernommen (deep-equal).
  - `import is idempotent`: Zweimal dasselbe Backup ergibt dasselbe `train.sess` wie einmal.
  - `merge keeps existing sessions`: Mit vorhandener Einheit `s_2026-11-20_fr` enthält `train.sess` nach dem Import beide Schlüssel.
  - `invalid plan is ignored`: Ein Legacy-Backup mit `plan.days.length === 3` lässt den vorhandenen Plan unverändert.
  - `rejects unknown files`: `importBackup({foo:1}, store)` wirft mit der Meldung `'Keine gültige Backup-Datei'`, ebenso `importBackup(null, store)`.
  - `roundtrip`: `buildBackup` aus Store A, dann `importBackup` in einen leeren Store B, danach ist `B.get('train.sess')` deep-equal `A.get('train.sess')`. Außerdem `buildBackup(...).data['meta.lastBackup'] === undefined`.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** `js/core/backup.js` implementieren.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat: add backup export and legacy import"`

### Task 4: Trainingslogik als reines Modul

Portiert die DOM-freien Funktionen aus `hybrid-training/index.html` (Zeilen 209–431, Stand `90dc751`) und macht ihre Abhängigkeiten zu Parametern.

**Files:**
- Create: `js/areas/training/plan-default.js` (`CATS`, `WU_L`, `WU_U`, `E`, `DEF`, `UNIT`, `CHECKQ` 1:1 aus dem Original), `js/areas/training/logic.js`, `tests/training-logic.test.js`

**Interfaces:**
- Consumes: `dates.js`
- Produces (`logic.js`, alle Funktionen rein):
  - `num(v): number`
  - `fmtN(n): string`
  - `okSets(arr): Set[]`
  - `fmtSets(arr, ex): string`
  - `target(ex): string`
  - `prKind(ex): 'wv'|'v'|null`
  - `exDef(plan, sess, id): Exercise`
  - `exHist(sess, id): Session[]`
  - `lastFor(sess, exId, cutoff): Set[]|null`
  - `dateOf(sess, dayId, selD, todayStr, mondayStr): string`
  - `totals(day, session): { t, o }`
  - `weekDone(sess, dayId, mondayStr): boolean`
  - `prScan(sess, ex): { marks: Map<Session, Array<'w'|'v'|undefined>>, front, count }`
  - `computePRs(sess, plan): Map<Session, Record<exId, flags>>`
  - `prCount(prMap, s): number`
  - `prText(ex, x): string`
  - `metrics(sess, ex): Array<{ k:'w'|'best'|'sum', label, unit }>`
  - `series(sess, id, k): Array<{ s, date, y }>`
  - `ticks(lo, hi, minStep): number[]`

- [ ] **Step 1: Failing tests** in `tests/training-logic.test.js`. Die Fixture ist `sess` mit vier Montagseinheiten für `pistol` (`ex = {id:'pistol', unit:'reps', load:'kg'}`):
  - 02.11.: `5 kg × 6`
  - 09.11.: `5 kg × 7`
  - 16.11.: `7,5 kg × 5`
  - 23.11.: `7,5 kg × 5`

  Dazu eine Dienstagseinheit 24.11. mit `wpush`. Tests:
  - `fmtSets uses decimal comma`: `fmtSets([{v:'8',w:'12.5',ok:true},{v:'7',w:'12.5',ok:true},{}], {unit:'reps',load:'kg'}) === '8 · 7 @ 12,5 kg'`
  - `fmtN rounds to two decimals`: `fmtN(12.5) === '12,5'` und `fmtN(2.4000001) === '2,4'`
  - `lastFor respects cutoff`: `lastFor(sess,'pistol','2026-11-23')[0].w === '7.5'` (das ist der 16.11.) und `lastFor(sess,'pistol','2026-11-02') === null`
  - `dateOf picks this week's session, else today, else selection`:
    - `dateOf(sess,'di',{},'2026-11-25','2026-11-23') === '2026-11-24'`
    - `dateOf(sess,'fr',{},'2026-11-25','2026-11-23') === '2026-11-25'`
    - `dateOf(sess,'fr',{fr:'2026-11-20'},…) === '2026-11-20'`
  - `prScan flags weight and rep records, never the first session`:
    - `count === 2`
    - die Flags der 09.11.-Einheit sind `['v']`, die der 16.11.-Einheit `['w']`
    - der 02.11. und der 23.11. sind nicht in `marks`
  - `prScan ignores minute and check exercises`: `prScan(sess, {id:'jog', unit:'min', load:'km'}).count === 0`
  - `computePRs on empty sess`: `computePRs({}, DEF).size === 0`
  - `metrics by exercise type`: Die `k`-Werte sind:
    - `['w','sum']` für `pistol`
    - `['best','sum']` für `{unit:'reps', load:''}` mit Daten
    - `[]` für `{unit:'check'}`
  - `ticks are nice`: `ticks(5,15,0)` deep-equal `[5,7.5,10,12.5,15]` und `ticks(9,11,1)` deep-equal `[9,10,11]`
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** `plan-default.js` und `logic.js` implementieren. Die Bodies sind die Originalfunktionen, nur mit den Parametern oben statt der Globals `plan`, `sess`, `selD` und `PR`.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat: port training logic as pure module"`

### Task 5: App-Schale, Heute und Einstellungen

**Files:**
- Create: `index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`, `icon-180.png`, `icon-192.png`, `icon-512.png` (aus `hybrid-training` kopiert), `js/app.js`, `js/areas/heute.js`, `js/areas/settings.js`, `tests/fixtures/legacy-backup.json` (Format der alten App mit 2 Einheiten: Mo 23.11. `pistol` 6 · 6 · 5 @ 15 kg, Di 24.11. `wpush` 10 · 8 · 7 @ 15 kg)
- Modify: `.claude/launch.json` im Ordner `VSC`, Eintrag `ki-apps`: `python -m http.server 5181 --directory …/VSC/ki-apps`, Port 5181

**Interfaces:**
- Consumes: Tasks 1–3, `logic.totals`, `plan-default.DEF`
- Produces:
  - **Bereichsvertrag** für jedes Modul in `js/areas/`: `render(route, ctx): string`, `mount(root: HTMLElement, route, ctx): void` (optional), `onClick(e, route, ctx)`, `onInput(e, route, ctx)` und `onChange(e, route, ctx)` (jeweils optional).
  - **`ctx` aus `app.js`:**
    - `store`
    - `rerender(): void`
    - `setStatus(text): void`
    - `toast(title, line): void`
    - `go(hash): void`
  - **Shell-Elemente in `index.html`:**
    - `#main`
    - `#status`
    - Kopfzeile `#top` mit Titel und Link „‹ Heute“ in Bereichen
    - Toast `#toast`
    - Pausenleiste `#bar` mit `#barT`, `#bPlus` und `#bSkip`
    - Bearbeiten-Sheet `#sheet` mit den Feld-IDs aus dem Original
  - **`heute.js`:** `render` zeigt:
    - Datum, z. B. „Mittwoch, 25. November“
    - Karte **Jetzt / Als Nächstes** aus `nowNext(new Date())`
    - Karte **Training** mit Name der heutigen Einheit und Sätzen `o/t`, Link `#training`
    - Karte **Backup**, wenn `meta.lastBackup` fehlt oder älter als 14 Tage ist: „Letztes Backup vor N Tagen“ bzw. „Noch kein Backup“, Link `#einstellungen`
    - Zeile „Kommt bald: Recovery · Ernährung · Routinen · Körper · Arena“
  - **`settings.js`:**
    - Backup speichern: lädt `ki-apps-backup-YYYY-MM-DD.json` herunter und setzt `meta.lastBackup` auf das heutige Datum.
    - Backup laden: Datei-Input, ruft `importBackup` auf. Erfolg: „Backup geladen ✓ (N Einheiten)“. Fehler: Meldung aus dem Error.
    - Apple-Health-Anleitung, Text 1:1 aus `moreView()` des Originals.
    - Hinweis zum Installieren.
  - **`sw.js`:** `CACHE = 'ki-apps-v1'`. Beim Installieren alle Dateien der App vorladen, danach Netzwerk zuerst mit Cache-Fallback wie im Original.

- [ ] **Step 1:** Die Schale bauen.
  - `index.html` enthält Meta-Tags wie im Original, Titel „KI-Apps“ und `<script type="module" src="js/app.js">`.
  - `styles.css` enthält das CSS des Originals plus `.tiles` und `.card` für die Startseite.
  - `manifest.webmanifest`: `name` und `short_name` sind „KI-Apps“, `start_url` und `scope` sind `./`, `display` ist `standalone`, `theme_color` `#0e0e0f`.
- [ ] **Step 2:** `js/app.js` schreiben.
  - Store über `createStore(localStorage)`.
  - Bereichstabelle `{heute, training, settings}`. Training ist bis Task 6 ein Platzhalter mit `render() → 'Training folgt'`.
  - `render()` schreibt `area.render(parseRoute(location.hash), ctx)` in `#main` und ruft danach `mount` auf.
  - Delegierte Listener für click, input und change auf `#main` geben das Event an den aktiven Bereich weiter.
  - `hashchange` speichert die Scrollposition pro Hash und stellt sie wieder her, wenn man aus einer `view:'ex'`-Route zurückkommt.
  - Service Worker nur bei `https:` registrieren.
- [ ] **Step 3:** `heute.js` und `settings.js` laut Interfaces schreiben.
- [ ] **Step 4: Verify** mit `preview_start` für `ki-apps` und in der mobilen Ansicht (375 × 812):
  - „Heute“ zeigt Jetzt / Als Nächstes und die Karte „Noch kein Backup“.
  - In den Einstellungen `tests/fixtures/legacy-backup.json` laden. Erwartet „Backup geladen ✓ (2 Einheiten)“.
  - „Backup speichern“ lädt eine Datei herunter, danach ist die Backup-Karte auf „Heute“ weg.
  - Die Konsole zeigt keine Fehler.
  - Hell und dunkel prüfen.
- [ ] **Step 5:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 6: Commit:** `git commit -m "feat: add app shell, Heute start page and settings with backup"`

### Task 6: Trainingsbereich portieren

**Files:**
- Create:
  - `js/areas/training/view.js`: Tag, Verlauf, Übungsdetail, Ereignisse, Pausentimer, Bearbeiten-Sheet, Apple Health
  - `js/areas/training/chart.js`: `chartSvg`, `bindChart`, `spark`
  - `js/areas/training/index.js`: Bereichsvertrag
  - `tests/fixtures/legacy-8-weeks.json`: Legacy-Backup mit 9 Wochen ab Mo 28.09.2026 bis gestern. Woche `w` = 0…8:
    - **Mo:** `pistol` (6+w%2) · 6 · (5+w%2) @ 5+⌊w/2⌋·2,5 kg · `nordic` · `rdl` @ 16+⌊w/3⌋·2 kg · `copen` 30 s · `hlr`
    - **Di:** `wpush` @ 10+⌊w/3⌋·2,5 kg · `wpullw` · `hspu`
    - **Mi:** `rope` 5 min · `jog` 30 min @ 4,6+0,05·w km
    - **Sa:** `spr10` 4 × ✓ · `boxj` 4 × 4
- Modify: `js/app.js` (Platzhalter durch `training/index.js` ersetzen), `sw.js` (neue Dateien in die Vorlade-Liste)

**Interfaces:**
- Consumes: `logic.js`, `plan-default.js`, `dates.js`, `ctx` aus Task 5
- Produces:
  - `training/index.js` exportiert den Bereichsvertrag sowie `todaySummary(ctx): { name: string, type: string, done: number, total: number }` für „Heute“. `heute.js` nutzt diese Funktion statt eigener Berechnung.
  - **Zustand im Modul:** `plan` (`store.get('train.plan')` oder `DEF`), `sess` (`store.get('train.sess', {})`), `selD`, `edit`, `exM`, `allEx`, `PR`. Speichern über `store.set` in `train.plan` und `train.sess`. Liefert `store.set` `false`, ruft das Modul `ctx.setStatus('Speichern nicht möglich – privater Modus?')` auf.
  - **Links neu:**
    - `#mo` wird zu `#training/mo`
    - `#verlauf` wird zu `#training/verlauf`
    - `#x-<id>` wird zu `#training/x-<id>`
  - **Kopf des Trainings:** Tabs „Woche · Verlauf“. Den Tab „Mehr“ gibt es nicht mehr, sein Inhalt steht in den Einstellungen.

- [ ] **Step 1:** `view.js` und `chart.js` aus dem Original portieren. Die Funktionen bleiben, nur so umgestellt:
  - globale Daten werden zu Modulzustand bzw. Aufrufen von `logic.js`
  - `location.hash`-Routen werden zu `route`
  - `$('#status')` wird zu `ctx.setStatus`
  - Die Breitenmessung im Chart nutzt `root.clientWidth`.
- [ ] **Step 2:** `index.js` verdrahtet die Ereignisse:
  - `onClick` für `chk`, `back`, `metric`, `exall`, `edit`, `scale`, `exedit`, `add`, `reset` und `health`
  - `onInput` für Satzfelder und Wochen-Notiz
  - `onChange` für `warm`, `mob` und `date`
  - Pausenleiste und Sheet einmalig beim ersten `mount` binden.
- [ ] **Step 3:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 4: Verify** in der Vorschau (mobil, hell und dunkel), nachdem `tests/fixtures/legacy-8-weeks.json` über die Einstellungen geladen wurde. Jeder Punkt muss stimmen:
  - **Tagesansicht:** Ring zählt mit, Satz abhaken startet den Pausentimer, „Letztes Mal“ stimmt.
  - **Rekorde:** Ein Satz mit 17,5 kg ergibt Toast „Neues Höchstgewicht“, „PR“ am Satz und das Banner.
  - **Übungsdetail:** `#training/x-pistol` zeigt Kacheln, Kurve mit Tooltip, Bestwerte und Einheiten. „‹ Zurück“ stellt die Scrollposition wieder her.
  - **Verlauf:** Heatmap, 4 Kacheln, Übungsliste mit Mini-Kurven, „· N PR“ bei den Einheiten.
  - **Nachtragen:** Datum auf „Gestern“ stellen und einen Satz abhaken. Die Einheit liegt dann unter gestern, der Apple-Health-Hinweis erscheint statt des Knopfes.
  - **Plan bearbeiten:** Übung ändern und speichern, danach „Auf Notion-Stand zurücksetzen“.
  - **Heute:** Die Trainingskarte zeigt die heutige Einheit mit Sätzen.
  - **Fehlerfreiheit:** Keine Konsolenfehler, kein horizontales Scrollen bei 375 px.
- [ ] **Step 5: Commit:** `git commit -m "feat: port training area into KI-Apps"`

### Task 7: Umzugs-Hinweis in der alten App

**Files:**
- Modify: `../hybrid-training/index.html`. Darin: neues Element im Kopf, Export-Code aus dem Klick-Handler in die Funktion `exportBackup()` auslagern, und `../hybrid-training/sw.js` mit `CACHE = 'hybrid-training-v3'`.

**Interfaces:**
- Produces: Unter dem Kopf ein Banner mit diesem Inhalt:
  - Text „**Diese App zieht um nach KI-Apps.** 1. Backup speichern · 2. In KI-Apps unter Einstellungen laden.“
  - Knopf „Backup speichern“, ruft `exportBackup()` auf
  - Link „KI-Apps öffnen“ auf `https://julians4.github.io/ki-apps/`

- [ ] **Step 1:** Banner einbauen, Export auslagern, `sw.js` hochzählen.
- [ ] **Step 2: Verify** in der Vorschau der alten App:
  - Das Banner erscheint.
  - „Backup speichern“ lädt `training-backup-YYYY-MM-DD.json` herunter.
  - Diese Datei lässt sich in KI-Apps (Vorschau aus Task 6) laden, und die Einheiten erscheinen im Verlauf.
- [ ] **Step 3: Commit** im Repo `hybrid-training`: `git commit -m "Add move notice to KI-Apps"`. Gepusht wird erst in Task 8, nachdem KI-Apps live ist.

### Task 8: Veröffentlichen und umziehen

Braucht Julian an drei Stellen. Das ist so markiert.

- [ ] **Step 1 (Julian):** Auf github.com das öffentliche Repo `ki-apps` ohne README anlegen.
- [ ] **Step 2:** `git remote add origin https://github.com/JulianS4/ki-apps.git`, dann `git push -u origin main`.
- [ ] **Step 3 (Julian):** Im Repo unter Settings → Pages als Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)` wählen.
- [ ] **Step 4: Verify:** Abfragen, bis `https://julians4.github.io/ki-apps/` mit HTTP 200 antwortet und `js/app.js` ausliefert. Dann die Live-Seite im Browser öffnen und prüfen: keine Konsolenfehler, „Heute“ rendert.
- [ ] **Step 5:** `hybrid-training` pushen (Task-7-Commit). Prüfen, bis die alte Live-Seite das Banner enthält.
- [ ] **Step 6 (Julian, auf dem iPhone):**
  - In der alten App auf „Backup speichern“ tippen.
  - `julians4.github.io/ki-apps/` in Safari öffnen und zum Home-Bildschirm hinzufügen.
  - In KI-Apps unter Einstellungen → Backup laden.
  - Prüfen, ob Verlauf und Rekorde stimmen.
