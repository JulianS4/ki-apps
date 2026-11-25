# KI-Apps · Stufe 2 · Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Bereich Recovery bauen (Morgen-Check mit Ampel, geführte Mobility, Box-Breathing, Recovery-Blöcke, Wochen-Check, Deload-Zyklus mit Hinweisen, Beschwerden), Mobility und Wochen-Check aus dem Training dorthin umziehen und Training sowie „Heute“ damit verbinden.

**Architecture:** Neuer Bereich `js/areas/recovery/` nach dem Bereichsvertrag aus Stufe 1, also `render`, `mount`, `header`, `on*`, `reload` und `init`. Inhalte aus Notion liegen in `data.js`, reine Rechenlogik in `logic.js` (mit Node getestet), Ansichten als Strings in `view.js`. Die Timer laufen als DOM-Runner in `index.js` und lesen ihren Zustand aus den reinen Funktionen `timerState` und `boxPhase`. Training und Heute lesen die Recovery-Daten über den Store und rufen die reinen Funktionen aus `recovery/logic.js` auf. Ein einmaliger, wiederholbarer Umzug (`core/migrate.js`) verschiebt `s.mob` und `s.week` aus den Trainingseinheiten.

**Tech Stack:** wie Stufe 1. Vanilla-JS-ES-Module, localStorage, `node --test`, keine Abhängigkeiten. Dazu die Screen Wake Lock API, soweit vorhanden.

**Spec:** `docs/superpowers/specs/2026-11-25-ki-apps-design.md`, Abschnitte 6.2, 6.1 (Recovery-Teile), 7 (Zeilen Recovery → Training/Heute) und 8 (Umzug von `s.week` und `s.mob`).

## Global Constraints

- Alles aus den Global Constraints von Stufe 1 gilt weiter: kein Build, keine Abhängigkeiten, Präfix `ki.`, Deutsch, Dezimalkomma, Look & Feel wie Hybrid Training.
- **Neue Store-Schlüssel:**
  - `rec.morning`: `{ [date]: { schlaf, energie, muskeln, bed:'HH:MM', wake:'HH:MM', puls:number|null } }`
  - `rec.mobility`: `{ [date]: { done: true } }`
  - `rec.weekly`: `{ [sonntag]: { schlaf, energie, gelenke, ziel, gut:'', next:'' } }`
  - `rec.blocks`: `{ [date]: { [i]: true } }`
  - `rec.cycle`: `{ anchor:'YYYY-MM-DD' }`
  - `rec.flags`: `{ [montag]: { leistung?:true, stimmung?:true } }`
  - `rec.complaints`: `Array<{ id, place, level, start, note, resolved: date|null }>`
- **Zyklus-Anker** ist `2026-10-19`. 6 Wochen Aufbau plus 1 Woche Deload, endlos wiederholt. Ergibt Deload-Wochen am 30.11.2026, 18.01.2027, 08.03.2027 und 26.04.2027.
- **Ampel:** 12–15 Grün, 9–11 Gelb, 3–8 Rot. Die Texte stehen exakt in Task 1.
- **Mobility:** Upper (Routine A) an Di, Fr, So. Lower (Routine B) an Mo, Mi, Do, Sa. 15 min, samstags 20 min: Die letzte Übung läuft dann 5 min länger.
- Rekord-**Toasts** sind in der Deload-Woche aus. „PR“-Markierungen in Verlauf und Detail bleiben.
- **Keine automatische Satzreduktion**, bei Gelb, Rot und Deload nur Banner.
- Der Service-Worker-Cache wird `ki-apps-v2` und die Dateiliste enthält alle neuen Module.

## Review Focus

1. **Datum ohne Morgen-Check** (heute nichts eingetragen, oder nur ein bis zwei der drei Werte): Es gibt keine Ampel, keine Banner, und der Deload-Hinweis zählt den Tag nicht. Test `checkSum is null until all three values exist` in Task 1, `no ampel banner without a complete check` in Task 6.
2. **Wochen-Check zum Wochenwechsel:** Am Montag gehört ein neuer Check zum nächsten Sonntag. Der alte Check bleibt im Verlauf. Test `weekly check belongs to this week's sunday` in Task 5.
3. **Bettzeit über Mitternacht:** Wer nach Mitternacht ins Bett geht (z. B. 00:30–06:00), bekommt 5,5 h, nicht −18,5 h. Test `hoursInBed handles after-midnight bedtimes` in Task 1.
4. **Timer im Hintergrund:** Wird die App während der Mobility kurz verlassen, rechnet der Timer beim Zurückkommen mit der echten Uhrzeit weiter, statt hängen zu bleiben. `timerState` wird aus Startzeit und `Date.now()` berechnet. Browser-Prüfung in Task 4.
5. **Umzug doppelt oder nach späterem Import alter Backups:** Kein Eintrag wird doppelt angelegt, und vorhandene Recovery-Einträge werden nicht überschrieben. Tests `migration is idempotent` und `migration never overwrites recovery entries` in Task 2.

---

### Task 1: Recovery-Daten und Logik

**Files:**
- Create: `js/areas/recovery/data.js`, `js/areas/recovery/logic.js`, `tests/recovery-logic.test.js`

**Interfaces:**
- Consumes: `dates.js` (`DAYS`, `dayIdx`, `addDays`, `monday`, `ds`), `schedule.js` (`WEEK_ROUTINE`)
- **Produces `data.js`:**
  - `MOBILITY = { A: { name:'Upper', steps }, B: { name:'Lower', steps } }`, wobei `steps` vom Typ `Array<{ at:number(s), title, hint }>` ist. Werte exakt:
    - **A:**
      - 0 Cat-Cow „8–10 langsame Wdh“
      - 90 Thread the Needle „45 s/Seite“
      - 180 Wall Slides „10–15 Wdh“
      - 270 Doorway Chest Stretch „45 s/Seite“
      - 360 Lat Stretch „45 s/Seite“
      - 450 Cross-Body Shoulder Stretch „45 s/Seite“
      - 540 Upper Trap / Neck Stretch „45 s/Seite“
      - 630 Thoracic Extension „8–10 langsame Wdh“
      - 750 Child's Pose mit Seit-Reach „75 s/Seite“
    - **B:**
      - 0 Deep Squat Hold „“
      - 90 Couch Stretch „45 s/Seite“
      - 180 90/90 Hip Stretch „45 s/Seite“
      - 270 Seated Forward Fold „“
      - 360 Calf Stretch „45 s/Seite“
      - 450 Adductor Rockbacks „10–15/Seite“
      - 570 Pigeon Stretch „60 s/Seite“
      - 690 Ankle Dorsiflexion „45 s/Seite“
      - 780 Child's Pose → Deep Squat „je 1 min“
  - `BLOCKS = { mi, sa, so }` als `Array<{ t, link?: 'mobility'|'weekly' }>`:
    - **mi:**
      - Joggen ohne Musik, Podcast oder Hörbuch
      - Abendessen + Mealprep · 60 min
      - Personal Time, keine Arbeit, kein Deep Work · 60 min
    - **sa:**
      - Mobility: Waden, Achillessehne, Hamstrings, Adduktoren, Hüftbeuger · 20 min (link mobility)
      - Warme Dusche oder Sauna (optional) · 15 min
      - Personal Time inkl. 5 min Box-Breathing · 25 min
    - **so:**
      - Spaziergang ohne Kopfhörer · 30 min
      - Mobility Upper · 15 min (link mobility)
      - Wochen-Check · 15 min (link weekly)
      - Frühstück in Ruhe, danach Kirche · 30 min
      - Nachmittags Personal Time, kaum Bildschirm
  - `RIR = [ {week:1, main:'3', iso:'2–3', goal:'Technik, Gewichte aus Woche 4'}, …, {week:7, main:'3–4', iso:'4', goal:'Deload'} ]`. Werte exakt aus Spec 6.2.
  - `DELOAD_RULES: string[]`, die 5 Zeilen aus Spec 6.2.
  - `CYCLE_ANCHOR = '2026-10-19'`
  - `AMPEL`:
    - `{ gruen: { label:'Grün', advice:'Training wie geplant' }`
    - `gelb: { label:'Gelb', advice:'Gewichte halten, 1 Wdh mehr im Tank, pro Übung 1 Isolationssatz weniger' }`
    - `rot: { label:'Rot', advice:'Halbe Sätze oder Pause. 2× Rot pro Woche → Deload vorziehen' } }`
  - `SIGH`: Text „2× durch die Nase einatmen, lang durch den Mund aus. Bei Stress und nach dem Training.“
- **Produces `logic.js` (rein):**
  - `checkSum(entry): number|null`. Liefert `null`, solange nicht alle drei Werte (`schlaf`, `energie`, `muskeln`) gesetzt sind.
  - `ampel(sum: number|null): { key:'gruen'|'gelb'|'rot', label, advice } | null`
  - `plannedBed(day): { bed, wake }`. Das ist der Schlafen-Block des Vortags aus `WEEK_ROUTINE`.
  - `hoursInBed(bed, wake): number`
  - `cycleInfo(day, anchor = CYCLE_ANCHOR): { week: 1..7, deload: boolean, main, iso, goal, start: date, nextDeload: date }`
  - `mobilityFor(day): { routine:'A'|'B', name:'Upper'|'Lower', minutes: 15|20, end: 900|1200 }`
  - `timerState(steps, end, t): { index, step, left, total, done }`. `left` sind die Sekunden bis zum nächsten Schritt bzw. bis `end`, `total = end − t`.
  - `boxPhase(t): { phase:'Einatmen'|'Halten'|'Ausatmen', left: 1..4, n: 0..3 }`
  - `sundayOf(day): date`
  - `deloadTriggers({ morning, complaints, flags }, today): { items: Array<{ key, label, on, auto }>, count, suggest }`
    - Schlüssel und Labels: `rot2` „2× Rot in 7 Tagen“, `schlaf3` „3 Nächte schlecht geschlafen“, `puls` „Ruhepuls erhöht“, `schmerz` „Gelenk- oder Sehnenschmerz > 3 Tage“, `leistung` „Leistung 2 Einheiten in Folge gesunken“, `stimmung` „Stimmung mehrere Tage im Keller“.
    - Die ersten vier sind `auto`, die letzten zwei kommen aus `flags[montag]`.
    - `suggest = count ≥ 2`.

- [ ] **Step 1: Failing tests** in `tests/recovery-logic.test.js`, jeweils `assert.equal`/`deepEqual`:
  - `checkSum is null until all three values exist`:
    - `checkSum({schlaf:4, energie:3})` ergibt `null`
    - `checkSum({schlaf:4, energie:3, muskeln:5})` ergibt `12`
  - `ampel thresholds`: Die Schlüssel für die Summen 15, 12, 11, 9, 8 und 3 sind `gruen`, `gruen`, `gelb`, `gelb`, `rot`, `rot`. `ampel(null)` ergibt `null`. `ampel(10).advice` entspricht dem Gelb-Text oben.
  - `plannedBed uses the previous evening`:
    - `plannedBed('2026-11-30')` ergibt `{bed:'21:30', wake:'06:00'}`
    - `plannedBed('2026-11-28')` ergibt `{bed:'22:30', wake:'07:00'}`
    - `plannedBed('2026-11-29')` ergibt `{bed:'22:30', wake:'07:00'}`
  - `hoursInBed handles after-midnight bedtimes`:
    - `('21:30','06:00')` ergibt `8.5`
    - `('23:15','06:00')` ergibt `6.75`
    - `('00:30','06:00')` ergibt `5.5`
  - `cycleInfo follows the notion dates`:

| Datum | week | deload | sonst |
|---|---|---|---|
| `'2026-11-25'` | 6 | false | `goal` ist `'Peak'`, `main` ist `'1'`, `nextDeload` ist `'2026-11-30'` |
| `'2026-11-30'` | 7 | true | |
| `'2026-12-06'` | 7 | | |
| `'2026-12-07'` | 1 | | `nextDeload` ist `'2027-01-18'` |
| `'2027-01-18'` | | true | |

  - `cycleInfo with a moved anchor`: Mit Anker `'2026-11-30'` ist `cycleInfo('2026-11-25', …)` week 7 mit deload true, und `cycleInfo('2026-11-30', …)` ist week 1.
  - `mobilityFor by weekday`:
    - Mo 23.11. ergibt `{routine:'B', name:'Lower', minutes:15, end:900}`
    - Di 24.11. ergibt Routine A, 15 min
    - Sa 28.11. ergibt `{routine:'B', name:'Lower', minutes:20, end:1200}`
    - So 29.11. ergibt Routine A
  - `timerState walks through the routine`, mit `MOBILITY.B.steps`:
    - `t=0` ergibt `index 0`, `left 90`
    - `t=575` ergibt `index 6` (Pigeon Stretch), `left 115`
    - `t=900`, `end=900` ergibt `done true`
    - `end=1200`, `t=1000` ergibt `index 8`, `left 200`
  - `boxPhase cycles every 16 seconds`:
    - `t=0` ergibt Einatmen, left 4
    - `t=5` ergibt Halten, left 3, n 1
    - `t=9` ergibt Ausatmen, left 3
    - `t=13` ergibt Halten, left 3, n 3
    - `t=16` ergibt Einatmen, left 4
  - `sundayOf`:
    - `sundayOf('2026-11-25')` ergibt `'2026-11-29'`
    - `sundayOf('2026-11-29')` ergibt `'2026-11-29'`
  - `deloadTriggers`, Stichtag ist `today='2026-11-25'`:
    - Zwei Morgen-Checks mit Summe ≤ 8 am 20.11. und 24.11. ergeben `rot2.on`. Liegt der zweite stattdessen am 17.11., ist es nicht mehr aktiv.
    - Schlaf ≤ 2 an 3 Tagen innerhalb von 7 Tagen ergibt `schlaf3.on`.
    - Ruhepuls: 14 Tage lang 50 und an 3 der letzten 7 Tage 56 ergibt `puls.on`.
    - Eine Beschwerde, `start` am 22.11., `resolved` null, ergibt `schmerz.on`. Mit `start` am 23.11. ist es aus, ebenso mit `resolved` gesetzt.
    - `flags {'2026-11-23': {leistung:true}}` ergibt `leistung.on`.
    - Ist `rot2` plus `leistung` aktiv, dann ist `count === 2` und `suggest === true`. Mit nur einem aktiven Punkt ist `suggest === false`.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL, Module fehlen.
- [ ] **Step 3:** `data.js` und `logic.js` implementieren.
  - `cycleInfo`: Wochen seit dem Anker sind `n = ⌊(Tage zwischen monday(anchor) und monday(day)) / 7⌋`, daraus `week = ((n mod 7) + 7) mod 7 + 1`.
  - Puls-Regel: Der Schnitt kommt aus allen `puls`-Werten der letzten 14 Tage inklusive heute. Gezählt werden Tage der letzten 7 mit `puls ≥ Schnitt + 5`.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit:** `feat: add recovery data and logic`

### Task 2: Umzug von Mobility und Wochen-Check

**Files:**
- Create: `js/core/migrate.js`, `tests/migrate.test.js`
- Modify: `js/app.js` (vor `training.init` den Aufruf `runMigrations(ctx.store)`), `js/areas/settings.js` (nach `importBackup` und vor `ctx.reloadAll()` ebenfalls `runMigrations(ctx.store)`)

**Interfaces:**
- **Produces:** `migrateToRecovery(sess, rec): { sess, rec: { mobility, weekly }, moved: number }`. Arbeitet rein auf Kopien.
  - `s.mob === true` wird zu `rec.mobility[s.date] = { done: true }`.
  - Eine Einheit mit `s.day === 'so'` und nicht leerem `s.week` wird zu `rec.weekly[s.date] = { schlaf, energie, gelenke, ziel, gut: s.week.note || '', next: '' }`.
  - Danach werden `mob` und `week` aus der Einheit gelöscht.
  - Einheiten ohne abgehakte Sätze, ohne `warm: true` und ohne `health` werden entfernt.
  - Vorhandene `rec`-Einträge werden nie überschrieben.
- **Produces:** `runMigrations(store): number`. Liest `train.sess`, `rec.mobility` und `rec.weekly`, schreibt nur bei `moved > 0` und gibt `moved` zurück.

- [ ] **Step 1: Failing tests** in `tests/migrate.test.js`:
  - `moves mobility flags`: Aus `{ 's_2026-11-23_mo': { date, day:'mo', sets:{pistol:[{v:'6', ok:true}]}, mob:true } }` wird `rec.mobility['2026-11-23']` deep-equal `{done:true}`, das `mob` der Einheit ist `undefined`, und die Einheit bleibt bestehen.
  - `moves the sunday week check and drops the empty session`: `{ 's_2026-11-22_so': { date:'2026-11-22', day:'so', sets:{}, week:{schlaf:4, energie:3, gelenke:5, ziel:4, note:'gut'} } }` ergibt in `rec.weekly['2026-11-22']` `{schlaf:4, energie:3, gelenke:5, ziel:4, gut:'gut', next:''}`, und `sess['s_2026-11-22_so']` ist `undefined`.
  - `migration never overwrites recovery entries`: Mit vorhandenem `rec.weekly['2026-11-22'] = {schlaf:1}` bleibt er unverändert.
  - `migration is idempotent`: Der zweite Lauf auf das Ergebnis des ersten liefert `moved === 0` und dasselbe `rec`.
  - `runMigrations writes the store`: Mit einem Store wie oben liefert `runMigrations` 2, danach enthalten `store.get('rec.mobility')` und `store.get('rec.weekly')` die Einträge.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** `migrate.js` implementieren und die beiden Aufrufe einbauen.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit:** `feat: move mobility and week check data to recovery`

### Task 3: Recovery-Bereich · Heute-Ansicht

**Files:**
- Create: `js/areas/recovery/view.js`, `js/areas/recovery/index.js`, `tests/recovery-area.test.js`
- Modify: `js/core/routes.js` plus `tests/routes.test.js`, `js/app.js` (`AREAS.recovery` und `TITLES.recovery = 'Recovery'`), `styles.css` (Ampel-Farben)

**Interfaces:**
- **Routen:**

| Hash | Route |
|---|---|
| `#recovery` | `{area:'recovery', view:'today'}` |
| `#recovery/woche` | `{area:'recovery', view:'week'}` |
| `#recovery/zyklus` | `{area:'recovery', view:'cycle'}` |
| `#recovery/mobility` | `{area:'recovery', view:'mobility'}` |
| `#recovery/atmung` | `{area:'recovery', view:'breath', min:2}` |
| `#recovery/atmung?5` | `{area:'recovery', view:'breath', min:5}` |
| unbekannter Unterpfad | `view:'today'` |

- **`index.js`** exportiert `render`, `header`, `mount`, `init`, `reload`, `onClick`, `onChange` und `onInput`, dazu `summary(ctx): { ampel: ampel-Objekt|null, sum, mobility: { routine, name, minutes, done }, cycle: cycleInfo, suggest: boolean }` für Heute und Training.
- **Heute-Ansicht** (`view:'today'`), in dieser Reihenfolge:
  1. **Morgen-Check:**
     - drei `.scale` mit 1–5: `data-a="mc" data-k="schlaf|energie|muskeln" data-n`
     - Zeitfelder `type=time` mit `data-a="bed"` und `data-a="wake"`, vorbelegt mit `plannedBed(heute)`
     - Zahlenfeld `data-a="puls"`
     - Ist die Summe vollständig, eine Karte `.amp.<key>` mit `label`, Summe und `advice`
  2. **Mobility:**
     - „Routine B · Lower · 15 min“
     - Knopf „Starten“ führt zu `#recovery/mobility`
     - Checkbox `data-a="mobdone"` für erledigt
  3. **Atmung:** Knöpfe „Box-Breathing 2 min“ und „5 min“ führen zu `#recovery/atmung?2` bzw. `?5`. Darunter der Text `SIGH` in einem `details`-Element.
  4. **Recovery-Block** nur an Mi, Sa und So:
     - Checkliste aus `BLOCKS` mit `data-a="blk"`
     - Einträge mit `link` sind nicht abhakbar, sondern zeigen den Status von Mobility bzw. Wochen-Check und verlinken dorthin
  5. **Zyklus-Zeile** „Woche N · Ziel · RIR Haupt/Iso“ als Link zu `#recovery/zyklus`. Ist `suggest`, zusätzlich die Karte „Deload vorziehen?“.
- **Kopf:** Tabs „Heute · Woche · Zyklus“.

- [ ] **Step 1: Failing tests.** Zuerst die neuen Routen in `tests/routes.test.js`. Dann `tests/recovery-area.test.js`, Kontext wie in `training-area.test.js`, „heute“ ist Mo 23.11.2026 08:00:
  - `today view shows the three scales and planned bed times`: Das HTML enthält `data-k="muskeln"` sowie `value="21:30"` und `value="06:00"`.
  - `scoring the morning check stores it and shows the ampel`:
    - `onClick` mit `{a:'mc', k:'schlaf', n:'4'}`, danach `energie` 4 und `muskeln` 3
    - `store.get('rec.morning')['2026-11-23']` enthält `schlaf:4, energie:4, muskeln:3`
    - `render` enthält `class="amp gruen"` und „Training wie geplant“
  - `today view shows lower mobility on monday`: Das HTML enthält „Routine B · Lower · 15 min“.
  - `mobility done is stored per day`: `onChange` mit `{a:'mobdone'}` und `checked:true` ergibt in `rec.mobility['2026-11-23']` `{done:true}`.
  - `no block on monday, block on wednesday`: Am Mo enthält das HTML nicht „Recovery-Block“, am Mi 25.11. enthält es „Mealprep“.
  - `summary reports ampel, mobility and cycle`: Nach dem Check oben ist `summary(ctx).ampel.key === 'gruen'`, `mobility.routine === 'B'` und `cycle.week === 6`.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Routen, `view.js` (Heute-Ansicht) und `index.js` (Zustand aus dem Store, Ereignisse, `summary`) implementieren und den Bereich in `app.js` eintragen. CSS:
  - `.amp`: Karte mit 4 px Randleiste links
  - `.amp.gruen`: `#1f9d55`
  - `.amp.gelb`: `#d39b00`
  - `.amp.rot`: `var(--acc)`
  - Die Farbe sitzt nur im Rand und in einem Punkt, der Text bleibt in Textfarbe.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Verify** in der Vorschau (375 × 812, hell und dunkel):
  - Check ausfüllen: Die Ampel erscheint.
  - Eine Zeit ändern: Sie bleibt nach dem Neuladen erhalten.
  - Kein horizontales Scrollen, keine Konsolenfehler.
- [ ] **Step 6: Commit:** `feat: add recovery area with morning check, mobility card and blocks`

### Task 4: Geführte Mobility und Box-Breathing

**Files:**
- Modify: `js/areas/recovery/view.js` (Ansichten `mobility` und `breath`), `js/areas/recovery/index.js` (Runner), `styles.css` (Vollbild-Timer)

**Interfaces:**
- **Mobility-Ansicht:**
  - große Übung mit `title` und `hint`, Restzeit des Schritts `m:ss`, Gesamtrest, „Als Nächstes: …“, Fortschrittsbalken
  - Knöpfe „Start“, „Pause“ und „Beenden“
  - Am Ende (`done`) setzt der Runner `rec.mobility[heute] = {done:true}`, piept, und die Ansicht zeigt „Geschafft ✓“ mit Link „‹ Recovery“.
- **Atmung-Ansicht:**
  - Kreis, der bei Einatmen wächst und bei Ausatmen schrumpft (CSS-Transition 4 s, bei `prefers-reduced-motion` aus)
  - darin Phase und `left`, darunter die Restzeit
  - Dauer aus `route.min`
- **Runner:**
  - Speichert `startedAt` und `pausedTotal` und rechnet `t` bei jedem Tick (250 ms) aus `Date.now()`. Dadurch stimmt der Timer auch nach einem Wechsel in den Hintergrund.
  - Fordert beim Start `navigator.wakeLock.request('screen')` an, falls vorhanden, und gibt ihn bei Pause oder Ende frei.
  - Piept beim Schrittwechsel. Dafür wird ein eigener Beep im Recovery-Modul angelegt, mit derselben Implementierung wie im Training.
  - Stoppt bei `onNavigate` weg von der Ansicht.
  - Wechselt die Route, während ein Timer läuft, wird er beendet, ohne `done` zu setzen.

- [ ] **Step 1:** Ansichten und Runner implementieren. Die Rechenlogik kommt ausschließlich aus `timerState` und `boxPhase` (Task 1, getestet).
- [ ] **Step 2:** `npm test` ausführen. Erwartet: PASS, keine Regression.
- [ ] **Step 3: Verify** in der Vorschau:
  - Mobility starten: Die Anzeige zählt herunter.
  - Den Tab für 5 s verstecken, etwa über einen anderen Tab: Beim Zurückkommen ist die Zeit um rund 5 s weiter (Review Focus 4).
  - „Pause“ hält die Zeit an.
  - Mit `Date.now` um 899 s vorgespult per Konsole: Danach steht „Geschafft ✓“ da, und `rec.mobility[heute].done` ist `true`.
  - Box-Breathing zeigt die Phasen im 4-s-Takt.
  - Keine Konsolenfehler.
- [ ] **Step 4: Commit:** `feat: add guided mobility and box breathing timers`

### Task 5: Woche und Zyklus

**Files:**
- Modify: `js/areas/recovery/view.js` (Ansichten `week` und `cycle`), `js/areas/recovery/index.js`, `tests/recovery-area.test.js`

**Interfaces:**
- **Woche:**
  - Der Wochen-Check gehört zu `sundayOf(heute)`. Vier `.scale` mit `data-a="wk"` (`schlaf`, `energie`, `gelenke`, `ziel`) und zwei Textfelder mit `data-a="wkt"` (`gut`: „Was lief gut?“, `next`: „Ziel nächste Woche“).
  - Darunter der Verlauf der Morgen-Checks der letzten 14 Tage als Liste: Datum, Summe, Ampelpunkt, Bettzeit.
  - Und die früheren Wochen-Checks, die neuesten zuerst.
- **Zyklus:**
  - Tabelle der 7 Wochen mit der aktuellen Woche markiert, nächste Deload-Woche mit Datum.
  - In der Deload-Woche die `DELOAD_RULES`.
  - Knopf „Deload jetzt starten“ mit doppeltem Tippen wie „Plan zurücksetzen“. Er setzt `rec.cycle.anchor = addDays(Montag dieser Woche, 7)`, wodurch die laufende Woche zur Deload-Woche wird.
  - „Deload vorziehen?“ zeigt die 6 Punkte aus `deloadTriggers`. Die Auto-Punkte sind nur Anzeige (✓/–), `leistung` und `stimmung` sind Checkboxen mit `data-a="flag"` für die laufende Woche.
  - **Beschwerden:** Formular mit Körperstelle (Text), Stärke 1–5 und Notiz, Knopf „Hinzufügen“ mit `data-a="cadd"`. Die offenen Beschwerden stehen mit „seit N Tagen“ und dem Knopf „Erledigt“ (`data-a="cres" data-id`) darunter, die erledigten eingeklappt.

- [ ] **Step 1: Failing tests** in `tests/recovery-area.test.js`:
  - `weekly check belongs to this week's sunday`: `onClick {a:'wk', k:'ziel', n:'4'}` am Mi 25.11. ergibt `rec.weekly['2026-11-29'].ziel === 4`. Dieselbe Aktion am Mo 30.11. schreibt nach `'2026-12-06'`.
  - `cycle view marks week 6 and the next deload`: `render({view:'cycle'})` am 25.11. enthält „Woche 6“ und „30.11.“.
  - `starting a deload now makes this week the deload week`:
    - zweimal `onClick {a:'deload'}` am 25.11.
    - `rec.cycle.anchor === '2026-11-30'`
    - `summary(ctx).cycle.deload === true`
  - `adding and resolving a complaint`:
    - `cadd` mit place „Knie links“, level 3
    - `rec.complaints.length === 1`, `resolved === null`
    - `cres` mit dieser id setzt `resolved` auf `'2026-11-25'`
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Ansichten und Ereignisse implementieren.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Verify** in der Vorschau: Die Woche zeigt die migrierten Wochen-Checks aus den Testdaten. Der Zyklus zeigt Woche 6. „Deload jetzt starten“ funktioniert und lässt sich zurücksetzen, indem man den Anker per Konsole entfernt. Beschwerden lassen sich anlegen und erledigen. Mobil, hell und dunkel.
- [ ] **Step 6: Commit:** `feat: add weekly check, deload cycle and complaints`

### Task 6: Training an Recovery anbinden

**Files:**
- Modify: `js/areas/training/view.js`, `js/areas/training/index.js`, `tests/training-area.test.js`

**Interfaces:**
- **Consumes:** `recovery/index.js` `summary(ctx)` bzw. die Funktionen aus `recovery/logic.js` mit `ctx.store`
- **Trainingstag:**
  - **Ampel-Banner:** nur wenn `dt === heute` und die Ampel Gelb oder Rot ist. `<div class="amp gelb|rot">` mit „Morgen-Check: Gelb“ und `advice`, Link „Recovery ›“.
  - **Zyklus-Zeile** in `.hero .m` an Kraft-, Cardio- und Athletik-Tagen, angehängt: „· Woche N · RIR Haupt“. In der Deload-Woche stattdessen „· Deload-Woche“ plus ein Banner `.amp.deload` mit den `DELOAD_RULES`.
  - **Mobility:** Die Checkbox `data-a="mob"` entfällt. Stattdessen ein Link `#recovery` „Mobility · Routine B · Lower · 15 min“ mit „✓ erledigt“ bzw. „offen“ aus `rec.mobility[dt]`.
  - **Sonntag:** Statt `restView` eine Karte „Wochen-Check → Recovery“ mit Link `#recovery/woche` und dem Status aus `rec.weekly[sundayOf(dt)]`.
- **Woche in der Leiste:** `weekDone` für `so` ist wahr, wenn `rec.weekly[Sonntag dieser Woche]` existiert.
- **Deload-Woche:** In `onClick` für `chk` gibt es keinen Rekord-Toast und keine Vibration.

- [ ] **Step 1: Failing tests** in `tests/training-area.test.js`:
  - `no ampel banner without a complete check`: Ohne `rec.morning` enthält der Tag kein `class="amp`.
  - `yellow check shows the advice on today's training`: Mit `rec.morning['2026-11-23'] = {schlaf:3, energie:3, muskeln:4}` enthält er `class="amp gelb"` und „1 Wdh mehr im Tank“.
  - `cycle line in the hero`: Am 23.11. enthält der Tag „Woche 6“.
  - `mobility is a link to recovery`: Das HTML enthält `href="#recovery"` und „Routine B“, aber nicht `data-a="mob"`.
  - `sunday links to the weekly check`: Der Tag `so` enthält `href="#recovery/woche"` und nicht `data-a="scale"`.
  - `deload week shows the rules and silences record toasts`:
    - `rec.cycle.anchor = '2026-11-30'`, Tag 23.11. Das HTML enthält „Deload-Woche“ und „Sätze halbieren“.
    - Ein `chk` auf einen Rekord-Satz ruft `ctx.toast` nicht auf. Geprüft wird mit einem Spy auf `ctx.toast`.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren. `restView` und die Behandlung von `mob`, `scale` und `wnote` werden aus dem Training entfernt.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Verify** in der Vorschau mit `tests/fixtures/legacy-8-weeks.json`:
  - Nach dem Import sind die Mobility-Häkchen migriert, und Training-Mo zeigt „✓ erledigt“.
  - Ein gelber Check erscheint als Banner.
  - Sonntag verlinkt zur Woche.
  - Die Leiste markiert So bei vorhandenem Wochen-Check.
- [ ] **Step 6: Commit:** `feat: connect training to recovery`

### Task 7: Heute an Recovery anbinden

**Files:**
- Modify: `js/areas/heute.js`, `tests/heute.test.js`

**Interfaces:**
- **Consumes:** `recovery/index.js` `summary(ctx)`. Für die Tests lässt es sich wie `setTrainingSummary` ersetzen, über `setRecoverySummary(fn)`, mit Standardwert aus dem Store.
- **Heute:**
  - unter dem Datum die Zyklus-Zeile „Woche N · Ziel · RIR Haupt“ bzw. „Deload-Woche“
  - **Morgen-Check:** Ist er offen, eine Karte `.card.warn` „Morgen-Check offen · 30 Sekunden ›“ mit Link `#recovery`, ganz oben. Ist er erledigt, eine Karte `.amp.<key>` mit Label, Summe und Empfehlung.
  - bei `suggest` die Karte „Deload vorziehen?“ mit Link `#recovery/zyklus`
  - neue Kachel **Recovery**: „Mobility B · Lower“ und „offen“ bzw. „✓ erledigt“, Link `#recovery`
  - „Kommt bald“ ohne Recovery

- [ ] **Step 1: Failing tests** in `tests/heute.test.js`:
  - `heute asks for the morning check`: Ohne `rec.morning` enthält Heute „Morgen-Check offen“ und `href="#recovery"`.
  - `heute shows the ampel once checked`: Mit Summe 13 enthält es `class="amp gruen"`, „Grün“ und „13“.
  - `heute shows the cycle line`: Am 23.11. enthält es „Woche 6“.
  - `recovery tile and coming-soon line`: Die Recovery-Kachel enthält „Mobility B“. „Kommt bald“ enthält nicht „Recovery“.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren. In `app.js` registriert `recovery.init` die Zusammenfassung über `setRecoverySummary`.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Verify** in der Vorschau: Morgens offen, nach dem Check die Ampel, die Recovery-Kachel. Mobil, hell und dunkel, keine Konsolenfehler.
- [ ] **Step 6: Commit:** `feat: show recovery on the Heute page`

### Task 8: Veröffentlichen

- [ ] **Step 1:** `sw.js` anpassen: `CACHE = 'ki-apps-v2'` und `FILES` um `js/core/migrate.js`, `js/areas/recovery/data.js`, `logic.js`, `view.js` und `index.js` ergänzen. Prüfen, dass jede Datei in `js/` in der Liste steht. Dafür `ls -R js` mit der Liste vergleichen.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 3: Commit:** `chore: release recovery (cache v2)`
- [ ] **Step 4:** Abschluss-Review des gesamten Bereichs (frischer Reviewer). Wichtige Funde mit Test beheben.
- [ ] **Step 5:** `git push origin main` ausführen, dann prüfen, bis `https://julians4.github.io/ki-apps/js/areas/recovery/index.js` mit 200 antwortet. Live-Seite öffnen, keine Konsolenfehler, Recovery rendert.
- [ ] **Step 6 (Julian):** App einmal mit Netz öffnen. Den ersten Morgen-Check machen und eine Mobility mit Timer laufen lassen.
