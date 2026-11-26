# KI-Apps · Stufe 4a · Routinen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Bereich Routinen bauen: Morgen- und Abendroutine nach Uhrzeit, abhaken einzeln oder mit „Alles erledigt“, die Packlisten, einen geführten Timer für die Chinese Grandpa Routine und den Halterungs-Modus. Dazu kommen die Verbindungen zu Recovery (Mobility, Box-Breathing), Ernährung (500 ml, Abend-Supplements) und „Heute“.

**Architecture:**
- Neuer Bereich `js/areas/routines/` nach dem Bereichsvertrag, mit `data.js`, `logic.js` (rein, getestet), `view.js` und `index.js`.
- Der geführte Timer aus Recovery wandert nach `js/core/guided.js`. Recovery (Mobility, Atmung) und Routinen (Chinese Grandpa) nutzen ihn gemeinsam.
- Verknüpfte Häkchen werden nie doppelt gespeichert. Der Mobility-Schritt liest und schreibt `rec.mobility`, der Supplement-Schritt die Abend-Gruppe in `food.days`. Der Schritt „500 ml trinken“ steht in `rout.days`, und die Ernährung zählt ihn beim Wasser mit.

**Tech Stack:** wie bisher. Vanilla-JS-ES-Module, localStorage, `node --test`, Screen Wake Lock API, keine Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-11-25-ki-apps-design.md`, Abschnitte 6.4 (Routinen), 5 (Heute-Kachel), 7 (Zeilen Mobility, „500 ml“, Abend-Supplements) und 11 (Stufe 4).

**Quelle aus Notion:** „Morgen & Abend Routine“, Stand 24.11.2026, gelesen am 26.11. Die Schritttexte sind daraus wörtlich übernommen. Sie gehen an drei Stellen über die Spec hinaus: „Alexa Regengeräusche (automatisch)“, „Lichter aus (automatisch)“ und „Fitbit Edge“.

**Stufe 4b (Körper)** bekommt einen eigenen Plan, sobald 4a live ist: Werte, Maße, Fotos, Verläufe, Quartals-Check, Ziele in den Einstellungen.

## Global Constraints

- Alles aus den Global Constraints der Stufen 1 bis 3 gilt weiter:
  - kein Build, keine Abhängigkeiten
  - Präfix `ki.`
  - Deutsch
  - jeder eingegebene Text läuft durch `esc()`
- **Gespeicherte Werte immer defensiv lesen**, wie in Ernährung: Nur Objekte und Arrays der erwarteten Form zählen, kaputte Einträge werden übergangen und bringen nie eine Ansicht oder „Heute“ zum Absturz.
- **Neuer Store-Schlüssel:** `rout.days: { [date]: { morgen?: { [stepId]: true }, abend?: { [stepId]: true }, pack?: { [itemId]: true } } }`
  - Er wird im Backup pro Datum zusammengeführt (`PER_KEY`).
  - Verknüpfte Schritte (`mobility`, `supps`) speichern hier nichts.
- **Zeiten:**
  - Morgen ab 06:00, Sa und So eine Stunde später (07:00).
  - Abend ab 20:30, Fr und Sa eine Stunde später (21:30).
- **Routen:**

| Hash | Route |
|---|---|
| `#routinen` | `{area:'routines', view:'today'}` |
| `#routinen/grandpa` | `{area:'routines', view:'grandpa'}` |
| `#routinen/halterung` | `{area:'routines', view:'holder'}` |

  - Der Titel ist „Routinen“, die Tabs heißen „Tag · Halterung“.
- **Service Worker:** Der Cache wird `ki-apps-v4`, und die Dateiliste enthält alle neuen Module.

## Review Focus

1. **Abendroutine erst am nächsten Morgen abgehakt:**
   - Bis 12:00 zeigt der Tag eine Karte „Gestern Abend x/7“ mit „Alles erledigt“, die den Vortag abhakt, wie „Gestern sauber gegessen?“ in der Ernährung.
   - Tests `yesterday evening card shows in the morning` (Task 3) und `yesterday evening can be completed in the morning` (Task 4).
2. **Verschobene Zeiten:**
   - Freitagabend und das Wochenende liegen eine Stunde später.
   - Der Halterungs-Modus zeigt um Fr 21:15 noch „Nächste Routine: Abendroutine um 21:30“.
   - Tests `times shift on weekends and fridays` und `activeStep` (Task 1).
3. **Geteilte Häkchen:**
   - Mobility aus Recovery oder Routinen und die Abend-Supplements aus Ernährung oder Routinen erscheinen in beiden Bereichen gleich.
   - Abwählen in einem Bereich wirkt im anderen.
   - Tests `mobility tick is shared with recovery` und `evening supplements tick is shared with nutrition` (Task 4).
4. **500 ml zählen genau einmal:**
   - Abhaken zählt +0,5 L beim Wasser, Abwählen nimmt sie wieder weg.
   - „−“ bei Wasser geht nie unter diesen Anteil.
   - Test `morning water counts half a litre once` (Task 4).
5. **Timer nach dem Umbau:**
   - Mobility und Atmung in Recovery verhalten sich exakt wie vorher. Alle bestehenden Recovery-Tests bleiben unverändert grün.
   - Verlässt man eine Timer-Ansicht, endet der Timer, und der Halterungs-Modus gibt den Wake Lock frei.
   - Browser-Prüfung in Task 2 und 5.

---

### Task 1: Routinen-Daten und Logik

**Files:**
- Create: `js/areas/routines/data.js`, `js/areas/routines/logic.js`, `tests/routines-logic.test.js`

**Interfaces:**
- **Produces `data.js`.** Schritte als `{ id, from:'HH:MM', to?:'HH:MM', title, link? }`, Zeiten für Mo–Do (Werte exakt):
  - **`MORNING`:**
    - `wecker` 06:00 „Wecker · 5500K Beleuchtung“
    - `wasser` 06:00–06:05 „500 ml trinken · Bett machen · Rollladen auf & Fenster zu“, `link:'water'`
    - `grandpa` 06:05–06:10 „Anziehen → Chinese Grandpa Routine im Tageslicht“, `link:'grandpa'`
    - `toilette` 06:10–06:20 „Toilette“
    - `mund` 06:20–06:25 „Mundroutine“
    - `dusche` 06:25–06:35 „Duschroutine“
    - `abtrocknen` 06:35–06:45 „Abtrocknen · Skincare · Haare“
    - `deo` 06:45–06:55 „Deo · Anziehen · Parfum“
    - `tasche` 06:55–07:00 „Tasche & Essentials packen“, `link:'pack'`
    - `los` 07:00 „Losfahren“
  - **`EVENING`:**
    - `shutdown` 20:30 „PC Shutdown · Alexa Regengeräusche (automatisch)“
    - `dusche` 20:30–20:45 „Duschroutine (an Trainingstagen) · Zahnroutine“
    - `abtrocknen` 20:45–20:55 „Abtrocknen · Skincare · Fenster auf“
    - `mobility` 20:55–21:10 „Mobility Routine (15 min · Upper/Lower laut Recoveryplan)“, `link:'mobility'`
    - `lesen` 21:10–21:28 „Lesen · Supplements“, `link:'supps'`
    - `box` 21:28–21:30 „Box-Breathing“, `link:'breath'`
    - `schlafen` 21:30 „Schlafen · Lichter aus (automatisch)“
  - **`PACK`:**
    - `{ cat:'Tasche', items }` mit Metall-Flasche, Glas-Frühstücksbehälter, Metall-Mittagessenbehälter, Zuckerfreier Kaugummi, Mouthwash, Taschentücher, Deo, Laptop oder Tablet, Ladekabel
    - `{ cat:'Essentials', items }` mit Handy, AirPods, Fitbit Edge, Mosolf-Chip, Schlüssel, Geldbeutel
    - Die IDs sind `slug(name)`.
  - **`GRANDPA`:**
    - Steps im Format der Mobility (`{at, title, hint:'30 s'}`), je 30 s: Lymphatic Hops, Deep Squat, Arm Waves/Half Squat, Golf Swings, High Knee, Deep Breathing, Tapping auf Lymphknoten, Sitzen in Seiza.
    - `GRANDPA_END = 240`
  - `PHONE_NOTE = 'Kein Handy in dieser Zeit. Einfach in der Handyhalterung lassen.'`
  - `LABELS = { morgen: 'Morgenroutine', abend: 'Abendroutine' }`
- **Produces `logic.js` (rein):**
  - `shiftTime(hhmm, min): string`
  - `routineFor(kind:'morgen'|'abend', day): Step[]`
    - Gibt die Schritte mit verschobenen Zeiten zurück, morgen +60 an Sa und So, abend +60 an Fr und Sa.
    - Jeder Schritt bekommt dazu `until`, also `to` oder sonst `from` des nächsten Schritts. Der letzte Schritt bekommt `from` + 1 min.
  - `activeStep(day, hhmm): { kind, step, next } | { kind: null, upcoming: { kind, day, from } }`
    - Aktiv ist der Schritt mit `from ≤ t < until`.
    - Schritte ohne Dauer werden übersprungen.
    - Außerhalb beider Routinen ist `upcoming` die nächste Routine (morgen heute, abend heute oder morgen am nächsten Tag).
  - `progress(steps, ticks, linked): { done, total }`
    - `ticks` ist `{ [id]: true }`, `linked` ist `{ mobility?: bool, supps?: bool }`.
    - Ein Schritt mit `link` `mobility` oder `supps` zählt über `linked`, alle anderen über `ticks`.

- [ ] **Step 1: Failing tests** in `tests/routines-logic.test.js`:
  - `times shift on weekends and fridays`:
    - `routineFor('morgen', Do 26.11.)[0].from` ist `'06:00'`, am Sa 28.11. `'07:00'`.
    - `routineFor('abend', Fr 27.11.)[0].from` ist `'21:30'`, am So 29.11. `'20:30'`.
    - Am Sa ist der letzte Abendschritt `schlafen` um `'22:30'`.
  - `activeStep`:
    - Do 06:00 ergibt `wasser`, weil der Wecker keine Dauer hat.
    - Do 06:07 ergibt `grandpa` mit `next.id === 'toilette'`.
    - Sa 07:07 ergibt `grandpa`.
    - Do 21:15 ergibt `lesen`.
    - Fr 21:15 ergibt `{kind:null, upcoming:{kind:'abend', from:'21:30'}}`.
    - Do 22:00 ergibt `upcoming` `{kind:'morgen', day:'2026-11-27', from:'06:00'}`.
    - Fr 23:00 ergibt `upcoming` am Sa mit `from:'07:00'`.
  - `progress counts ticks and linked steps`: Abend mit `ticks {shutdown:true, box:true}` und `linked {mobility:true, supps:false}` ergibt `{done:3, total:7}`.
  - `pack ids are unique`, außerdem hat `GRANDPA` 8 Schritte mit den `at`-Werten 0, 30, …, 210.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit:** `feat: add routines data and logic`

### Task 2: Geführter Timer als gemeinsames Modul

**Files:**
- Create: `js/core/guided.js`, `tests/guided.test.js`
- Modify: `js/areas/recovery/index.js`, `js/areas/recovery/view.js` (die Mobility-Ansicht nutzt `stepTimerView` aus `guided.js`)

**Interfaces:**
- **Produces `guided.js`.** Läufer, Uhr, Piepton, Wake Lock und die Schritt-Timer-Ansicht, verschoben aus Recovery und verallgemeinert:
  - `startRun(def)`
    - `def = { kind, key, end, steps?, onDone?(ctx) }`
    - `kind` ist der Name der Ansicht, z. B. `'mobility'`, `'breath'` oder `'grandpa'`.
    - `key` unterscheidet Läufe derselben Art, z. B. die Minuten beim Atmen.
  - `toggleRun()` schaltet zwischen Pause und Weiter, `stopRun()` beendet.
  - `runOf(kind, key?): { status:'running'|'paused'|'done', t } | null`
  - `mountRun(kind, ctx, paint)` startet den 250-ms-Takt und hält den Bildschirm an.
    - Bei Schritt-Timern piept es beim Schrittwechsel.
    - Am Ende ruft der Läufer `def.onDone(ctx)` auf, piept und zeichnet neu.
    - `paint(t)` liefert die Felder für die Anzeige.
  - `unlockAudio()` für den ersten Tipp und `keepAwake(on)` für den Halterungs-Modus.
  - `stepTimerView(v)`
    - `v = { label, steps, end, state, status, back, doneTitle, doneNote, doneToday? }`
    - Gibt bei gleicher Eingabe dieselbe HTML-Ausgabe wie die bisherige Mobility-Ansicht.
  - `stepFields(steps, state, end)`
- **Recovery** nutzt `guided.js` für Mobility (`kind:'mobility'`) und Atmung (`kind:'breath'`, `key:min`).
  - `breathView` und `breathFields` bleiben in Recovery.
  - Die Ausgabe der Mobility-Ansicht bleibt Zeichen für Zeichen gleich.

- [ ] **Step 1: Failing tests** in `tests/guided.test.js` (mit `t.mock.method(Date,'now')`):
  - `a run follows the clock and calls onDone once`: `startRun` mit den `GRANDPA`-Schritten und `end:240`.
    - Nach 35 s ergibt `runOf('grandpa').t` 35 und `status:'running'`.
    - `mountRun` nach 240 s ruft `onDone` genau einmal auf, und `status` ist `'done'`.
  - `pause holds the time`: `toggleRun` bei 10 s, dann 30 s warten: `t` bleibt 10.
  - `runOf with another kind is null`, und `stopRun` ergibt `null`.
  - `stepTimerView shows the first step`: Das HTML enthält „Lymphatic Hops“, „Als Nächstes: Deep Squat“, „0:30“ und `data-a="tstart"`.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL. Die bestehenden Recovery-Tests bleiben grün.
- [ ] **Step 3:** `guided.js` implementieren und Recovery darauf umstellen. **Die Recovery-Tests werden dabei nicht verändert.**
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS, einschließlich aller bisherigen Recovery-Tests.
- [ ] **Step 5: Verify** in der Vorschau: Mobility starten, „Pause“, Ende per `Date.now` +899 s ergibt „Geschafft ✓“. Atmung wechselt die Phasen. Keine Konsolenfehler.
- [ ] **Step 6: Commit:** `refactor: share the guided timer between areas`

### Task 3: Routinen-Bereich · Tag

**Files:**
- Create: `js/areas/routines/view.js`, `js/areas/routines/index.js`, `tests/routines-area.test.js`
- Modify: `js/core/routes.js` plus `tests/routes.test.js`, `js/app.js` (`AREAS.routines`, `TITLES.routines = 'Routinen'`), `js/core/backup.js` (`rout.days` in `PER_KEY`) plus `tests/migrate.test.js`, `styles.css`

**Interfaces:**
- **`index.js`** exportiert `render`, `header`, `mount`, `reload`, `onNavigate`, `onClick`, `onChange` und `summary(ctx): { morgen: {done,total}, abend: {done,total} }`.
- **Ansicht „Tag“:**
  - Hero mit Datum und „Routinen“, darunter `PHONE_NOTE`.
  - **Zwei Abschnitte**, vor 14:00 zuerst „Morgenroutine“, danach zuerst „Abendroutine“.
    - Jeder Abschnitt hat den Kopf „ab 06:00 · x/10“ und eine Liste mit Uhrzeit und Text.
    - Pro Schritt eine Checkbox `data-a="step" data-k="morgen|abend" data-id`.
  - Darunter „Alles erledigt“ (`data-a="all" data-k`). Das setzt alle Schritte dieses Tages, inklusive der verknüpften.
- **Zusätze an verknüpften Schritten:**
  - `grandpa`: Link „Timer · 4 min ›“ zu `#routinen/grandpa`
  - `pack`: `details` „Packliste“ mit beiden Listen, Checkboxen `data-a="pack" data-id`
  - `water`: Hinweis „zählt 0,5 L beim Wasser“
  - `mobility`: Routine und Dauer von heute aus `mobilityFor`, dazu der Link „Starten ›“ zu `#recovery/mobility`
  - `supps`: die Namen der Abend-Supplements aus der Ernährung
  - `breath`: Link „Box-Breathing ›“ zu `#recovery/atmung?2`
- **Gestern Abend:**
  - Ist es vor 12:00 und die Abendroutine von gestern nicht vollständig, steht oben die Karte „Gestern Abend x/7“ mit „Alles erledigt“ (`data-a="yall"`).
  - Sie wirkt auf den Vortag, inklusive `rec.mobility` und Supplements des Vortags.

- [ ] **Step 1: Failing tests:**
  - **Routen-Fälle** in `tests/routes.test.js`.
  - **Backup** in `tests/migrate.test.js`: `rout.days` wird pro Datum zusammengeführt.
  - **`tests/routines-area.test.js`**, „jetzt“ ist Do 26.11.2026 06:07:
    - `today shows both routines with shifted times`: Das HTML enthält „ab 06:00“ und „ab 20:30“. Am Sa enthält es „ab 07:00“ und „ab 21:30“.
    - `ticking a step is stored per day`: `onChange step morgen toilette` mit `checked` ergibt `rout.days['2026-11-26'].morgen.toilette === true`, und `summary(ctx).morgen` ist deep-equal `{done:1, total:10}`.
    - `everything done in one tap`: `all morgen` ergibt `done === 10`.
    - `pack list ticks`: `pack handy` ergibt `rout.days[...].pack.handy === true`.
    - `yesterday evening card shows in the morning`: Um 07:00 enthält das HTML „Gestern Abend 0/7“, um 12:30 fehlt die Karte.
    - `malformed routine data never crashes`: `rout.days` mit den Werten `'x'`, `[]`, `{ '2026-11-26': { morgen: 5, pack: [] } }` rendert ohne Fehler, und Abhaken speichert danach korrekt.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren. Die verknüpften Schritte lesen in diesem Task nur. Das Schreiben bei `step` und `all` für `mobility` und `supps` kommt in Task 4.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Verify** in der Vorschau (375 × 812, hell und dunkel): Schritte abhaken, „Alles erledigt“, die Packliste. Kein horizontales Scrollen, keine Konsolenfehler.
- [ ] **Step 6: Commit:** `feat: add routines area with morning and evening checklists`

### Task 4: Verbindungen und Chinese-Grandpa-Timer

**Files:**
- Modify: `js/areas/routines/index.js`, `js/areas/food/index.js` (Wasser und Abend-Gruppe), `js/areas/food/view.js`, `tests/routines-area.test.js`, `tests/food-area.test.js`

**Interfaces:**
- **Produces in `food/index.js`:**
  - `setSuppGroup(ctx, group, on, day?)` hakt alle Supplements einer Gruppe ab bzw. ab, mit der Shake-Logik aus Stufe 3.
  - `groupDone(ctx, group, day?): boolean`
  - `routineWater(ctx, day): 0|500`, gleich 500, wenn `rout.days[day].morgen.wasser` gesetzt ist.
- **Ernährung zählt `routineWater` beim Wasser mit:**
  - in `summary`, in der Wasser-Karte und auf „Heute“
  - Die Karte zeigt dann „inkl. 0,5 L aus der Morgenroutine“.
  - `food.days[].water` bleibt der von Hand getippte Anteil, und „−“ zieht nur von diesem ab.
- **Routinen schreiben die verknüpften Häkchen in die Bereiche, denen sie gehören:**
  - `mobility` schreibt `rec.mobility[day] = {done:true}` bzw. löscht den Eintrag.
  - `supps` ruft `setSuppGroup(ctx, 'abends', on, day)` auf.
  - `all` und `yall` setzen beide mit.
- **Ansicht `grandpa`:**
  - `stepTimerView` mit dem Label „Chinese Grandpa Routine“ und `back:'#routinen'`.
  - Am Ende wird `rout.days[heute].morgen.grandpa = true` gesetzt.
  - Verlässt man die Ansicht, endet der Timer (`onNavigate`).

- [ ] **Step 1: Failing tests:**
  - `mobility tick is shared with recovery`:
    - `step abend mobility` ergibt `rec.mobility['2026-11-26']` deep-equal `{done:true}`.
    - Danach Abwählen ergibt `undefined`.
    - Ist `rec.mobility` von außen gesetzt, enthält das Routinen-HTML die Mobility-Checkbox als `checked`.
  - `evening supplements tick is shared with nutrition`:
    - `step abend lesen` ergibt bei `food.days['2026-11-26'].supps` für `magnesium` und `kirsch` jeweils `true`.
    - Sind beide in der Ernährung abgehakt, ist `summary(ctx).abend.done` um 1 höher.
  - `morning water counts half a litre once`:
    - `step morgen wasser` ergibt `food.summary(ctx).water === 500`, das Ernährungs-HTML enthält „0,5 / 3,5 L“.
    - `water` dazu ergibt 1000, zweimal `waterminus` ergibt 500.
    - `wasser` abwählen ergibt 0.
  - `yesterday evening can be completed in the morning`: Um 07:00 ergibt `yall`, dass der Abend des 25.11. 7/7 hat. `rec.mobility['2026-11-25']` ist gesetzt, die Abend-Supplements des 25.11. sind abgehakt, und die Karte ist verschwunden.
  - `grandpa timer ticks the step when done`: `tstart` auf `view:'grandpa'`, `Date.now` +240 s, `mount` ergibt `rout.days[...].morgen.grandpa === true`. `onNavigate` beendet den Timer.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Verify** in der Vorschau:
  - Mobility in Routinen abhaken: Recovery zeigt „erledigt“.
  - „Lesen · Supplements“ abhaken: Ernährung zeigt Abends 2/2.
  - „500 ml“ abhaken: Wasser 0,5 L.
  - Den Grandpa-Timer starten.
- [ ] **Step 6: Commit:** `feat: connect routines to recovery and nutrition`

### Task 5: Halterungs-Modus

**Files:**
- Modify: `js/areas/routines/view.js`, `js/areas/routines/index.js`, `styles.css`, `tests/routines-area.test.js`

**Interfaces:**
- **Ansicht `holder`:**
  - Ganz oben steht „Morgenroutine“ bzw. „Abendroutine“.
  - Darunter riesig der aktuelle Schritt aus `activeStep`, dazu „06:05–06:10“ und „Danach: Toilette“.
  - Außerhalb einer Routine steht da „Nächste Routine: Abendroutine um 20:30“, bei einem anderen Tag mit Wochentag.
  - Es gibt keine Bedienelemente außer dem Kopf.
- **`mount`** hält mit `keepAwake(true)` den Bildschirm an und zeichnet alle 15 s neu. `onNavigate` weg von `holder` ruft `keepAwake(false)` auf und stoppt den Takt.
- **CSS `.holder`:**
  - Der Schritt steht in `clamp(40px, 12vw, 88px)`.
  - Hoher Kontrast, gut lesbar aus 1–2 m Entfernung.

- [ ] **Step 1: Failing tests:**
  - `holder shows the current step`: Do 06:07 ergibt ein HTML mit „Anziehen → Chinese Grandpa Routine im Tageslicht“, „06:05–06:10“ und „Danach: Toilette“.
  - `holder between routines shows the next one`: Fr 21:15 ergibt „Nächste Routine: Abendroutine um 21:30“, Do 22:00 ergibt „Morgenroutine“ und „Fr 06:00“.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Verify** in der Vorschau:
  - Der Halterungs-Modus zeigt den Schritt zur Uhrzeit (mit überschriebenem `Date`).
  - Nach dem Verlassen läuft kein Takt mehr, zu prüfen per Konsolenzähler.
  - Mobil, hell und dunkel.
- [ ] **Step 6: Commit:** `feat: add the phone-holder mode for routines`

### Task 6: Heute anbinden und veröffentlichen

**Files:**
- Modify: `js/areas/heute.js`, `tests/heute.test.js`, `sw.js`

**Interfaces:**
- **Kachel Routinen** (`href="#routinen"`): „Morgen x/10“ und darunter „Abend y/7“. Sie wird wie die anderen Kacheln einzeln über `safe()` gelesen.
- **Die Karte „Jetzt“** wird zum Link `#routinen/halterung`, wenn der aktuelle Block der Week Routine „Morgenroutine“ oder „Abendroutine“ ist.
- **„Kommt bald“** zeigt „Körper · Arena“.

- [ ] **Step 1: Failing tests** in `tests/heute.test.js`:
  - `heute routines tile`: Mit `rout.days` für den 23.11. und 3 Morgenschritten enthält das HTML „Morgen 3/10“ und `href="#routinen"`.
  - `now card links to the holder during a routine`: Mo 23.11. 06:30 ergibt `href="#routinen/halterung"`, um 16:30 nicht.
  - `coming-soon line`: „Kommt bald“ enthält „Körper“, aber nicht „Routinen“.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5:** In `sw.js` den Cache auf `CACHE = 'ki-apps-v4'` setzen und `js/core/guided.js` sowie die vier Routinen-Module in die Liste aufnehmen. Dann mit dem Prüfskript gegen `js/` abgleichen und `npm test` ausführen.
- [ ] **Step 6: Commit:** `feat: show routines on the Heute page (cache v4)`
- [ ] **Step 7:** Abschluss-Review durch einen frischen Prüfer. Wichtige Funde mit Test beheben.
- [ ] **Step 8:** `git push origin main` ausführen, dann prüfen, bis `https://julians4.github.io/ki-apps/js/areas/routines/index.js` mit 200 antwortet und `sw.js` `ki-apps-v4` enthält. Danach die Live-Seite öffnen: keine Konsolenfehler, und Routinen werden angezeigt.
- [ ] **Step 9 (Julian):**
  - Am nächsten Morgen die Routine im Halterungs-Modus laufen lassen.
  - Danach abhaken: einmal einzeln, einmal mit „Alles erledigt“.
