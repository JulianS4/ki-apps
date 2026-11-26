# KI-Apps · Stufe 3 · Ernährung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Bereich Ernährung bauen: Protein mit Ziel aus dem Gewicht, Gerichte per Antippen, Wasser, Tagesregel „sauber“ mit Serie, Supplements und Einkaufsliste. Gerichte, Supplements und Einkaufsliste sind bearbeitbar, und „Heute“ zeigt Stand und Hinweise.

**Architecture:** Neuer Bereich `js/areas/food/` nach dem Bereichsvertrag aus Stufe 1 und 2 (`render`, `mount`, `header`, `on*`, `reload`, `onNavigate`, `summary`). Inhalte aus Notion liegen in `data.js`, reine Rechenlogik in `logic.js` (mit Node getestet), Ansichten als Strings in `view.js`, Zustand und Ereignisse in `index.js`. Alle Einträge liegen im Store, und Heute liest sie über `summary(ctx)`. Das Gewicht steht unter `body.weight`, dort liest es Stufe 4 („Körper“) später weiter.

**Tech Stack:** wie Stufe 1 und 2. Vanilla-JS-ES-Module, localStorage, `node --test`, keine Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-11-25-ki-apps-design.md`, Abschnitte 6.3 (Ernährung), 5 (Heute-Kachel), 7 (Zeilen Körper → Ernährung, Routinen → Ernährung), 8 (Startstand, bearbeitbare Listen, Backup) und 11 (Stufe 3).

**Quellen aus Notion** (Stand 22.–24.11.2026, gelesen am 26.11.): „Ernährungsplan“, „Supplementplan“, „Einkaufsliste“, „Recovery · Trainingstag“. Die Spec nennt Gerichte und Kategorien. Zutaten und Artikel stehen nur in Notion und sind in Task 1 wörtlich übernommen.

## Global Constraints

- Alles aus den Global Constraints von Stufe 1 und 2 gilt weiter: kein Build, keine Abhängigkeiten, Präfix `ki.`, Deutsch, Dezimalkomma, Look & Feel wie bisher, jeder vom Nutzer eingegebene Text läuft durch `esc()`.
- **Kein Kalorienzählen.** Gezählt werden nur Protein (g) und Wasser (ml).
- **Neue Store-Schlüssel:**
  - `food.days`: `{ [date]: { meals: Array<Meal>, water: number(ml), clean?: boolean, broken?: string[], supps?: { [suppId]: true } } }`, wobei `Meal = { id, name, g, slot, t:'HH:MM', dish?: dishId, supp?: suppId }`
  - `food.dishes`: `Array<Dish> | null`. `null` bedeutet Notion-Startstand. `Dish = { id, slot:'fr'|'mi'|'ab'|'sn'|'dr', days:'wt'|'we'|'all', name, g, ing, free?: true }`
  - `food.supps`: `Array<{ id, group:'morgens'|'mittags'|'abends', name, hint?, shake?: number }> | null`
  - `food.shop`: `Array<{ cat, items: Array<{ id, name }> }> | null`
  - `food.need`: `{ [itemId]: true }` für Artikel, die fehlen
  - `food.settings`: `{ bottle: 330|500|750|1000 }`, Standard 500
  - `body.weight`: `{ [date]: kg }`. Den Schlüssel teilt sich die Ernährung mit „Körper“ (Stufe 4).
- **Backup:** `food.days` und `body.weight` werden pro Datum zusammengeführt (in `PER_KEY` aufnehmen). Alle anderen `food.*`-Schlüssel werden wie bisher als Ganzes ersetzt.
- **Ziele:**
  - Protein `round(2 × neuestes Gewicht)` g.
  - Wasser 3 500 ml, volles Ziel 4 000 ml.
  - Letzte Mahlzeit 19:00. Ein Eintrag mit `t > '19:00'` gilt als spät.
- **Einträge speichern Name und Gramm als Kopie.** Ein später geändertes oder gelöschtes Gericht ändert keine alten Tage.
- **Routen:** `#ernaehrung` (Tag), `#ernaehrung/gerichte`, `#ernaehrung/einkauf`. Der Bereich heißt intern `food` und hat den Titel „Ernährung“. Die Tabs heißen „Tag · Gerichte · Einkauf“.
- **Service Worker:** Der Cache wird `ki-apps-v3`, und die Dateiliste enthält alle neuen Module.
- **Nicht in dieser Stufe:**
  - Der Morgenroutine-Schritt „500 ml“ zählt erst mit Stufe 4 mit, das gemeinsame Abend-Supplement-Häkchen ebenso.
  - Arena-Vorschläge kommen mit Stufe 5.
  - Diese Stufe legt nur die Daten so an, dass die späteren Stufen sie lesen können.

## Review Focus

1. **Noch kein Gewicht:**
   - Ernährung fragt zuerst nach dem Gewicht, es wird nie durch 0 geteilt, und es erscheint kein „NaN“.
   - Heute zeigt „Protein x g · Ziel fehlt“.
   - Tests `protein asks for the weight first` (Task 3) und `heute food tile without a weight` (Task 7).
2. **Gericht nach 19:00 und Tageswechsel:**
   - Ein Eintrag bekommt Uhrzeit und Datum aus `ctx.now()` im Moment des Tippens, nicht aus dem letzten Rendern.
   - Ab 19:01 wird er als „nach 19 Uhr“ markiert.
   - Test `a meal after 19:00 is marked late` (Task 3).
3. **„Kreatin + Protein“ mehrfach antippen:**
   - Abhaken legt genau einen Protein Shake (25 g) an, Abwählen entfernt genau diesen.
   - Wiederholtes Abhaken legt keinen zweiten Shake an.
   - Test `creatine tick adds exactly one shake` (Task 4).
4. **Gericht ändern oder auf Notion-Stand zurücksetzen:** Alte Einträge behalten Namen und Gramm. Test `editing a dish does not change logged meals` (Task 5).
5. **Serie „sauber“:**
   - Ein heute noch offener Tag unterbricht die Serie nicht.
   - Ein gebrochener Tag setzt sie zurück, und eine Lücke ohne Eintrag beendet sie.
   - Test `cleanStreak` (Task 1).

---

### Task 1: Ernährungs-Daten und Logik

**Files:**
- Create: `js/areas/food/data.js`, `js/areas/food/logic.js`, `tests/food-logic.test.js`
- Modify: `js/areas/recovery/data.js`. Thoracic Extension bekommt den Hinweis `'8–10 langsame Wdh'`, so steht es in Notion. Damit wird die Stufe-2-Entscheidung nach der gekürzten Spec korrigiert.

**Interfaces:**
- Consumes: `dates.js` (`DAYS`, `dayIdx`, `addDays`), `schedule.js` (`WEEK_ROUTINE`)
- **Produces `data.js`:**
  - `DISHES: Dish[]`. Werte exakt. Zutaten wörtlich aus Notion, die IDs sind die Slugs in Klammern:
    - **Frühstück, `fr`, `wt`:**
      - Joghurt Bowl 45 (`joghurt-bowl`), „Griechischer Joghurt + Whey + Tahini + Honig + Gefrorene Beeren + Kerne deiner Wahl“
      - Overnight Oats 45 (`overnight-oats`), „Milch + Haferflocken zart + Whey + geschälte Hanfsamen + Kakaopulver + Zimt + Kurkuma + Mandeln + Walnüsse“
      - High Protein Wrap 35 (`protein-wrap`), „Vollkornwrap + Eier + Frischkäse + Knoblauch + Pute + Kerne deiner Wahl + Avocado“
    - **Frühstück, `fr`, `we`:**
      - Rührei mit Hüttenkäse Toast 40 (`ruehrei-toast`), „Vollkornbrot + Eier + Hüttenkäse + Babyspinat + Babytomaten + Kerne deiner Wahl“
      - Lachs Salat 45 (`lachs-salat`), „Eier + Baby-Römersalat + Gekochte Linsen + Gurke + Kapern + Geräucherter Lachs/Forelle + Petersilie + Haselnüsse + Kerne deiner Wahl · Dressing: Natives Olivenöl extra + Knoblauch + Sumach + Zitrone“
    - **Mittag, `mi`, `wt`:** Aldi 30 (`aldi`), `free: true`, Zutaten „frei, Protein schätzen“
    - **Mittag, `mi`, `we`:**
      - Ofen Platte 55 (`ofen-platte`), „Hähnchenbrust + Kartoffel-Wedges + Natives Olivenöl extra + Paprika + Süßkartoffel + Brokkoli + Parmesan + Kerne deiner Wahl“
      - Quinoa Power Bowl 30 (`quinoa-bowl`), „Quinoa + Kichererbsen (geröstet) + Avocado + Cherrytomaten + Rucola + Feta + Kürbiskerne“
    - **Abend, `ab`, `wt`:**
      - Lachspfanne mit Süßkartoffeln 35 (`lachspfanne`), „Lachsfilet + Süßkartoffel-Würfel + Brokkoli + Knoblauch + Natives Olivenöl + Zitronensaft + Dill“
      - Hähnchen mit Linsen-Dahl 50 (`linsen-dahl`), „Hähnchenbrust + Rote Linsen + Kokosmilch + Tomaten + Zwiebel + Kurkuma + Kreuzkümmel + Ingwer + Koriander“
      - Bolognese 45 (`bolognese`), „Rinderhackfleisch (mager) + Zucchini-Nudeln oder Vollkornnudeln + Tomaten + Zwiebel + Knoblauch + Basilikum + Parmesan“
    - **Abend, `ab`, `we`:**
      - Gegrilltes Steak mit Gemüse 50 (`steak`), „Rinderfilet oder Hüftsteak + Ofenkartoffeln + Gegrillter Spargel + Cherrytomaten + Knoblauchbutter + Rosmarin“
      - Gebackener Kabeljau mit Quinoa 45 (`kabeljau`), „Kabeljaufilet + Quinoa + Babyspinat + Kapern + Zitronenschale + Natives Olivenöl + Kräuter der Provence“
    - **Snacks, `sn`, `all`:**
      - Früchte & Beeren 2 (`fruechte`, „statt Süßigkeiten“)
      - Datteln 2 (`datteln`)
      - Dunkle Schokolade > 80 % 3 (`schokolade`)
      - Nüsse (ungesalzen) 6 (`nuesse`, „statt Chips“)
      - Sonnenblumenkerne 6 (`sonnenblumenkerne`)
      - Geröstete Kichererbsen 8 (`kichererbsen`)
      - Linsen- oder Kichererbsenchips 7 (`chips`)
    - **Drinks, `dr`, `all`:**
      - Tee 0 (`tee`, „Grüner/Schwarzer Tee, statt Kaffee“)
      - Matcha 0 (`matcha`)
      - Smoothie 3 (`smoothie`, „statt Softdrinks, auch selbst gepresste Säfte“)
      - Protein Shake 25 (`shake`, „statt Milchshakes“)
  - `SLOTS = { fr: 'Frühstück', mi: 'Mittag', sn: 'Snacks', ab: 'Abendessen', dr: 'Drinks' }`, `SLOT_ORDER = ['fr','mi','sn','ab','dr']`
  - `SUPPS`:
    - morgens: `omega` „Omega 3 EPA & DHA + Vitamin D3 K2“, `ingwer` „Ingwer + Bio-Honig + 1 TL Schwarzkümmelöl“, `kreatin` „Kreatin + Protein“ mit `shake: 25`
    - mittags: `flohsamen` „Flohsamenschalen + Rote-Bete-Saft“ mit Hinweis „zum Mittagessen“
    - abends: `magnesium` „Magnesium + Glycin + Zink“, `kirsch` „Sauerkirschsaft“
  - `SUPP_GROUPS = ['morgens','mittags','abends']` mit den Labels „Morgens · Mittags · Abends“
  - `SHOP`: Kategorien und Artikel wörtlich aus Notion „Einkaufsliste“, in der Reihenfolge von dort. Die IDs sind Slugs der Namen.
    - **Milchprodukte & Eier (9):** Griechischer Joghurt, Milch, Hüttenkäse, Frischkäse, Feta, Parmesan, Butter, Eier, Kokosmilch
    - **Fleisch & Fisch (7):** Hähnchenbrust, Putenbrust, Rinderhackfleisch (mager), Rinderfilet oder Hüftsteak, Lachsfilet, Geräucherter Lachs oder Forelle, Kabeljaufilet
    - **Obst (4):** Zitronen, Gefrorene Beeren, Bananen, Äpfel
    - **Snacks & Getränke (6):** Datteln, Dunkle Schokolade (> 80 %), Geröstete Kichererbsen, Linsen- oder Kichererbsenchips, Grüner / Schwarzer Tee, Matcha
    - **Gemüse (15):** Avocado, Babyspinat, Baby-Römersalat, Rucola, Cherrytomaten, Gurke, Brokkoli, Paprika, Zucchini, Spargel, Süßkartoffeln, Kartoffeln, Zwiebeln, Knoblauch, Ingwer
    - **Kohlenhydrate & Hülsenfrüchte (8):** Haferflocken (zart), Vollkornwraps, Vollkornbrot, Vollkornnudeln, Quinoa, Kichererbsen, Rote Linsen, Linsen (zum Kochen)
    - **Vorrat (5):** Whey, Natives Olivenöl extra, Gehackte Tomaten (Dose), Kapern, Kakaopulver
    - **Nüsse, Kerne & Samen (7):** Mandeln, Walnüsse, Haselnüsse, Geschälte Hanfsamen, Kürbiskerne, Tahini, Kernemix: Sonnenblumenkerne, Chiasamen, Leinsamen (ungesalzen)
    - **Gewürze & Kräuter (14):** Jodsalz & Pfeffer, Honig, Zimt, Kurkuma, Kreuzkümmel, Sumach, Oregano, Paprikapulver, Kräuter der Provence, Basilikum, Dill, Koriander, Petersilie, Rosmarin
  - `SHOP_NOTE = 'Alles Bio, wenn möglich · So viel TK wie möglich'`
  - `RULES = [['softdrinks','Softdrinks'],['fastfood','Fast Food'],['suess','Süßigkeiten/Snacks'],['alkohol','Alkohol'],['kaffee','Kaffee'],['verarbeitet','Stark Verarbeitetes']]`
  - `FOOD_NOTE = 'Jodsalz verwenden · so viel Bio wie möglich'`
  - `WATER = { goal: 3500, full: 4000, bottles: [330, 500, 750, 1000], bottle: 500 }`
  - `LAST_MEAL = '19:00'`
- **Produces `logic.js` (rein):**
  - `latestWeight(weights): { date, kg } | null`. Ignoriert Werte, die keine Zahl > 0 sind.
  - `proteinTarget(kg): number`, gleich `Math.round(2 * kg)`
  - `slotAt(hhmm): 'fr'|'mi'|'sn'|'ab'`. Grenzen: vor 10:30 `fr`, vor 14:30 `mi`, vor 17:00 `sn`, danach `ab`.
  - `suggestions(dishes, day, hhmm): { now: Dish[], rest: Dish[] }`
    - `now` sind die Gerichte des aktuellen Slots, deren `days` zum Tag passt (`wt` Mo–Fr, `we` Sa–So, `all` immer).
    - `rest` sind alle übrigen, sortiert nach `SLOT_ORDER`.
  - `foodTotals(entry): { protein, water }`. Ohne Eintrag `{0, 0}`.
  - `isLate(t): boolean`
  - `cleanStreak(days, today): number`
  - `dueGroup(hhmm)`: vor 11:00 `morgens`, vor 17:00 `mittags`, danach `abends`.
  - `trainingBlock(day): { start, end, title } | null`. Das ist der Block aus `WEEK_ROUTINE`, dessen Titel `/^(.+ Training|Joggen|Athlete Day)$/` entspricht. „Zum Training fahren“ zählt nicht.
  - `snackHint(day, hhmm, meals): boolean`
    - Es gibt einen Trainingsblock, und `hhmm` liegt in [Start − 2 h, Start).
    - Kein Eintrag hat `t` in [Start − 3 h, `hhmm`].
  - `dinnerHint(day, hhmm, meals): boolean`. Es gibt einen Trainingsblock, `hhmm ≥ Ende` und `hhmm ≤ '19:00'`, und es gibt noch keinen Eintrag mit `slot === 'ab'`.
  - `mealprepDay(day): boolean`, wahr an Mi und So.
  - `slug(text): string`. Kleinbuchstaben, ä/ö/ü/ß werden zu ae/oe/ue/ss, alles andere zu `-`.

- [ ] **Step 1: Failing tests** in `tests/food-logic.test.js`:
  - `latestWeight picks the newest valid entry`:
    - `{ '2026-11-20': 86, '2026-11-25': 85.2, '2026-11-26': 'x' }` ergibt `{date:'2026-11-25', kg:85.2}`
    - `{}` ergibt `null`
  - `proteinTarget doubles the weight`: `85` ergibt `170`, `82.4` ergibt `165`.
  - `slotAt boundaries`: `07:30`, `10:30`, `14:30`, `17:00` und `18:00` ergeben `fr`, `mi`, `sn`, `ab` und `ab`.
  - `suggestions follow time and weekday`, die Namen von `now`:
    - Do 26.11. 07:30 ergibt Joghurt Bowl, Overnight Oats und High Protein Wrap.
    - Sa 28.11. 07:30 ergibt Rührei mit Hüttenkäse Toast und Lachs Salat.
    - Do 12:00 ergibt Aldi.
    - Do 18:00 ergibt die drei Abendessen unter der Woche.
    - `now.length + rest.length` ist `DISHES.length`.
  - `foodTotals`: `{meals:[{g:45},{g:30}], water:2500}` ergibt `{protein:75, water:2500}`, `undefined` ergibt `{protein:0, water:0}`.
  - `isLate`: `'19:00'` ist false, `'19:01'` ist true.
  - `cleanStreak`, Stichtag ist `today='2026-11-26'`:
    - 23., 24. und 25. clean ergibt `3`, heute noch offen.
    - Kommt der 26. clean dazu, ergibt es `4`.
    - Ist der 24. `clean:false`, ergibt es `1`.
    - Fehlt der 24., ergibt es `1`.
    - `{}` ergibt `0`.
  - `dueGroup`: `08:00`, `11:00`, `16:59` und `17:00` ergeben `morgens`, `mittags`, `mittags` und `abends`.
  - `trainingBlock`:
    - Do 26.11. ergibt `{start:'16:15', end:'17:45', title:'Lower B Training'}`
    - Mi 25.11. ergibt Joggen 16:15–17:00
    - Sa 28.11. ergibt Athlete Day mit Start 15:00
    - So 29.11. ergibt `null`
  - `snackHint`, Do 26.11. mit Training um 16:15:
    - Mittag `{t:'12:00'}`: 14:15 ergibt true, 14:14 false, 16:15 false.
    - Mit einem weiteren Eintrag `{t:'14:20'}` ergibt 14:30 false.
    - Mittag um 13:30 ergibt um 14:30 false.
    - So 29.11. ergibt immer false.
  - `dinnerHint`, Do 26.11.:
    - ohne Einträge: 18:00 true, 17:30 false, 19:01 false
    - mit einem Eintrag `slot:'ab'` ergibt 18:00 false
  - `mealprepDay`: Mi 25.11. und So 29.11. sind true, Do 26.11. ist false.
  - `slug`: `'Rinderhackfleisch (mager)'` ergibt `'rinderhackfleisch-mager'`, `'Äpfel'` ergibt `'aepfel'`.
  - `shop ids are unique` über alle `SHOP`-Artikel, ebenso `dish ids are unique`.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL, Module fehlen.
- [ ] **Step 3:** `data.js` und `logic.js` implementieren, dazu den Hinweis bei Thoracic Extension korrigieren.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit:** `feat: add nutrition data and logic`

### Task 2: Bereich, Routen, Backup

**Files:**
- Create: `js/areas/food/index.js`, `js/areas/food/view.js` (zunächst nur das Gerüst), `tests/food-area.test.js`
- Modify: `js/core/routes.js` plus `tests/routes.test.js`, `js/app.js` (`AREAS.food`, `TITLES.food = 'Ernährung'`), `js/core/backup.js` (`PER_KEY` + `food.days`, `body.weight`) plus `tests/migrate.test.js`

**Interfaces:**
- **Routen:**

| Hash | Route |
|---|---|
| `#ernaehrung` | `{area:'food', view:'today'}` |
| `#ernaehrung/gerichte` | `{area:'food', view:'dishes'}` |
| `#ernaehrung/einkauf` | `{area:'food', view:'shop'}` |
| unbekannter Unterpfad | `view:'today'` |

- **`index.js`** exportiert `render`, `header`, `mount`, `reload`, `onNavigate`, `onClick`, `onChange`, `onInput` und `summary(ctx)`.
  - `summary(ctx)` liefert `{ protein, target|null, water, waterGoal, clean, streak, due: { group, done, total }, snack, dinner, mealprep }`.
  - Helfer, die der ganze Bereich nutzt:
    - `dishes(ctx)`, `supps(ctx)` und `shop(ctx)` liefern die gespeicherte Liste oder den Notion-Startstand.
    - `dayOf(ctx)` liefert `ds(ctx.now())`.
    - `editDay(ctx, fn)` liest den Tag, wendet `fn` an und speichert.
    - `put(ctx, key, value)` speichert und meldet einen Fehler wie in Recovery.
- **Kopf:** Tabs „Tag · Gerichte · Einkauf“

- [ ] **Step 1: Failing tests:**
  - **Routen-Fälle** in `tests/routes.test.js` laut Tabelle.
  - **Backup** in `tests/migrate.test.js`, `backup import merges food days and weights per date`:
    - Ein vorhandenes `food.days['2026-11-26']` bleibt erhalten, ein importiertes `'2026-11-20'` kommt hinzu.
    - Für `body.weight` gilt dasselbe.
  - **`tests/food-area.test.js`**, Kontext wie in `recovery-area.test.js`, „jetzt“ ist Do 26.11.2026 07:30:
    - `header highlights the active tab`: Bei `view:'shop'` enthält der Kopf `href="#ernaehrung/einkauf" class="on"`.
    - `summary on a fresh install`: `{ protein: 0, target: null, water: 0, waterGoal: 3500, clean: undefined, streak: 0 }`. Dazu ist `due` deep-equal `{ group: 'morgens', done: 0, total: 3 }`.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren und den Bereich in `app.js` eintragen. `render` gibt in diesem Task für alle Ansichten eine schlichte Überschrift aus, die Inhalte folgen in Task 3 bis 6.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit:** `feat: add nutrition area skeleton, routes and backup merge`

### Task 3: Tag · Protein und Gerichte

**Files:**
- Modify: `js/areas/food/view.js`, `js/areas/food/index.js`, `styles.css`, `tests/food-area.test.js`

**Interfaces:**
- **Kopf der Ansicht:**
  - Datum, Hero „Ernährung“.
  - Darunter die Protein-Karte „45 / 170 g“ mit Balken und dem Text „Ziel 2 g × 85 kg“.
  - Der Link „Gewicht ändern“ (`data-a="wedit"`) öffnet das Gewichtsfeld.
  - **Ohne Gewicht** steht stattdessen die Karte „Wie viel wiegst du? Dein Proteinziel ist 2 g pro kg.“ mit `<input type="number" inputmode="decimal" data-a="weight">`.
  - **Speichern:** `onChange` schreibt `body.weight[heute] = kg`, wenn 30 ≤ kg ≤ 250, mit Komma oder Punkt.
- **Gerichte-Raster:**
  - Zuerst `suggestions(...).now` unter dem Slot-Namen, z. B. „Frühstück · jetzt“, als Knöpfe `data-a="dish" data-id` mit Name und „~45 g“.
  - Darunter `details` „Andere Gerichte“ mit `rest`, gruppiert nach Slot.
- **Antippen** legt einen Eintrag `{ id, name, g, slot, t: HH:MM aus ctx.now(), dish }` an. Bei `free` (Aldi) öffnet sich der Eintrag direkt zum Bearbeiten.
- **Halten:**
  - 450 ms Drücken zeigt eine Karte „Zutaten“ mit `ing`, Protein und dem Knopf „Hinzufügen“ (`data-a="dish"`) bzw. „Schließen“ (`data-a="peekx"`).
  - Das folgende `click` legt dann nichts an.
  - Umsetzung in `mount` an den frisch gerenderten Knöpfen: `pointerdown`, `pointerup`, `pointerleave`, `pointercancel` und `contextmenu`. Dazu ein `held`-Flag, das `onClick` einmal verbraucht.
  - CSS `-webkit-touch-callout:none; user-select:none; touch-action:manipulation`
- **Freie Eingabe:**
  - Chips „+10 g“, „+20 g“ und „+30 g“ (`data-a="quick" data-g`).
  - Ein Zahlenfeld (`data-a="free"`, über `onInput` im Entwurf gehalten) mit „+ Hinzufügen“ (`data-a="fadd"`).
  - Die Einträge heißen „Eigene Eingabe“ mit `slot:'frei'`.
- **Einträge heute:**
  - Liste mit Uhrzeit, Name und Gramm, neueste unten.
  - Einträge mit `isLate` tragen die Marke „nach 19 Uhr“.
  - Antippen (`data-a="medit" data-id`) öffnet die Zeile mit einem Zahlenfeld (`data-a="mg" data-id`, speichert bei `change`, 0–300 g) und „Löschen“ (`data-a="mdel" data-id`).
- **Notizen:** Am Ende der Ansicht stehen `FOOD_NOTE` und „Letzte Mahlzeit 19:00“.

- [ ] **Step 1: Failing tests** in `tests/food-area.test.js`:
  - `protein asks for the weight first`:
    - Ohne `body.weight` enthält das HTML `data-a="weight"` und kein „NaN“.
    - `onChange {a:'weight'}` mit dem Wert `'85,0'` ergibt `body.weight['2026-11-26'] === 85`.
    - Danach enthält das HTML „0 / 170 g“.
    - Der Wert `'12'` speichert nichts.
  - `tapping a dish logs it with time and protein`:
    - `onClick {a:'dish', id:'joghurt-bowl'}` ergibt den ersten Eintrag des Tages mit `name:'Joghurt Bowl', g:45, t:'07:30', slot:'fr', dish:'joghurt-bowl'`.
    - Das HTML enthält „45 / 170 g“, das Gewicht ist 85.
  - `suggested dishes come first`: Um 07:30 kommt `data-id="joghurt-bowl"` im HTML vor `data-id="lachspfanne"`.
  - `a meal after 19:00 is marked late`:
    - Mit `now` um 19:30 enthält das HTML nach `dish` „nach 19 Uhr“.
    - Um 18:59 enthält es das nicht.
  - `aldi opens for its grams`: `dish aldi` ergibt `g:30`, und das HTML enthält `data-a="mg"`.
  - `free grams, editing and deleting an entry`:
    - `quick 20` ergibt einen Eintrag `{name:'Eigene Eingabe', g:20}`.
    - `medit` und danach `onChange {a:'mg', id}` mit `'25'` ergeben `g === 25`.
    - `mdel` ergibt 0 Einträge.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Ansicht, Ereignisse und Halten implementieren. CSS:
  - `.pbar`: Fortschrittsbalken 8 px wie `.prog`
  - `.dishes`: Raster `repeat(auto-fill,minmax(9.5em,1fr))`
  - `.dish`: Knopf mit Name und Gramm
  - `.late`: Marke im Stil von `.chip`
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Verify** in der Vorschau, 375 × 812, hell und dunkel:
  - Gewicht eingeben, dann zwei Gerichte antippen: Der Balken wächst.
  - Ein Gericht halten: Die Zutaten erscheinen, und es entsteht kein Eintrag.
  - Einen Eintrag ändern und löschen.
  - Kein horizontales Scrollen, keine Konsolenfehler.
- [ ] **Step 6: Commit:** `feat: log protein by tapping dishes`

### Task 4: Tag · Wasser, Regeln, Supplements

**Files:**
- Modify: `js/areas/food/view.js`, `js/areas/food/index.js`, `styles.css`, `tests/food-area.test.js`

**Interfaces:**
- **Wasser:**
  - Karte „2,0 / 3,5 L“ mit Balken und Marke bei 4 L.
  - Knopf „+ 0,5 L“ (`data-a="water"`, addiert die Flaschengröße) und „−“ (`data-a="waterminus"`, zieht die Flaschengröße ab, nie unter 0).
  - Ab 3 500 ml steht „Ziel erreicht ✓“ da, ab 4 000 ml „Volles Ziel ✓“.
  - Die Flaschengröße steht in einem `select` (`data-a="bottle"`) mit 0,33 / 0,5 / 0,75 / 1,0 L und landet in `food.settings.bottle`.
- **Tagesregel „sauber“:**
  - Knopf „Alles eingehalten“ (`data-a="clean"`, setzt `clean:true` und `broken:[]`, ein zweites Tippen setzt zurück auf offen).
  - Darunter die Chips der `RULES` (`data-a="broke" data-k`). Antippen schaltet die Regel in `broken` um, `clean` ist dann `broken.length === 0 ? undefined : false`.
  - Anzeige der Serie: „N Tage sauber in Folge“, bei 1 „1 Tag“.
- **Supplements:**
  - Drei Gruppen, die fällige (`dueGroup`) zuerst mit der Marke „jetzt“.
  - Jede Gruppe zeigt „x/y“, und jedes Supplement ist eine Checkbox (`data-a="supp" data-id`) in `food.days[heute].supps`.
  - Ein Supplement mit `shake` legt beim Abhaken einen Eintrag `{ name:'Protein Shake (Kreatin)', g: shake, slot:'dr', supp: id }` an, falls noch keiner mit dieser `supp`-ID existiert. Beim Abwählen wird er entfernt.

- [ ] **Step 1: Failing tests:**
  - `water adds the bottle size`:
    - zweimal `water` ergibt `1000`, das HTML enthält „1,0 / 3,5 L“
    - `waterminus` ergibt `500`
    - `bottle` mit `'750'` und danach `water` ergibt `1250`
    - `waterminus` bei 0 bleibt 0
  - `clean day and broken rules`:
    - `clean` ergibt `clean === true`, das HTML enthält „1 Tag sauber“
    - `broke kaffee` ergibt `clean === false` und `broken` deep-equal `['kaffee']`
    - noch einmal `broke kaffee` ergibt `clean === undefined`
  - `creatine tick adds exactly one shake`:
    - `onChange {a:'supp', id:'kreatin'}` mit `checked:true`, zweimal, ergibt genau einen Eintrag mit `supp:'kreatin', g:25`
    - `checked:false` ergibt keinen solchen Eintrag mehr, `supps.kreatin` ist undefined
    - Protein ist wieder 0
  - `due supplements come first`: Um 07:30 steht „Morgens“ im HTML vor „Mittags“, um 18:00 steht „Abends“ vor „Morgens“.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Verify** in der Vorschau: Wasser, Regeln und das Kreatin-Häkchen samt Shake in der Liste. Mobil, hell und dunkel.
- [ ] **Step 6: Commit:** `feat: add water, clean-day rule and supplements`

### Task 5: Gerichte-Ansicht · Zutaten und Bearbeiten

**Files:**
- Modify: `js/areas/food/view.js`, `js/areas/food/index.js`, `tests/food-area.test.js`

**Interfaces:**
- **Ansicht `dishes`:**
  - Gruppen in der Reihenfolge: Frühstück Mo–Fr, Frühstück Sa–So, Mittag Mo–Fr, Mittag Sa–So, Abendessen Mo–Fr, Abendessen Sa–So, Snacks, Drinks.
  - Pro Gericht ein `details` mit Name, „~45 g“ und den Zutaten.
- **„Bearbeiten“** (`data-a="dedit"`) schaltet auf Eingabefelder um:
  - Name (`data-a="dn" data-id`)
  - Protein (`data-a="dg" data-id`, 0–150)
  - Zutaten (`textarea`, `data-a="di" data-id`)
  - „Löschen“ (`data-a="ddel" data-id`)
  - pro Gruppe „+ Gericht“ (`data-a="dadd" data-slot data-days`, legt „Neues Gericht“ mit 20 g an)
- Textfelder speichern über `onInput`, ohne neu zu zeichnen. Zahlen speichern über `onChange`.
- Beim ersten Bearbeiten wird `food.dishes` aus `DISHES` kopiert.
- **„Auf Notion-Stand zurücksetzen“** (`data-a="dreset"`) braucht zwei Tipps wie „Deload jetzt starten“ und setzt `food.dishes` auf `null`.

- [ ] **Step 1: Failing tests:**
  - `dishes view shows the ingredients`: Das HTML enthält „Griechischer Joghurt + Whey“ und „Frühstück Sa–So“.
  - `editing a dish changes the plan`: `dedit` und danach `dg` mit `'50'` für `joghurt-bowl` ergeben, dass ein `dish joghurt-bowl` auf „Tag“ 50 g loggt.
  - `editing a dish does not change logged meals`:
    - Erst `joghurt-bowl` loggen, dann `dn` auf „Bowl XL“ und `dg` auf 60 setzen.
    - Der gespeicherte Eintrag bleibt `{name:'Joghurt Bowl', g:45}`.
    - Nach `dreset` mit zwei Tipps ist `food.dishes === null` und der Eintrag unverändert.
  - `adding and deleting a dish`: `dadd sn all` ergibt ein neues Snack-Gericht, `ddel` entfernt es.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit:** `feat: show and edit dishes with ingredients`

### Task 6: Einkaufsliste und Supplements bearbeiten

**Files:**
- Modify: `js/areas/food/view.js`, `js/areas/food/index.js`, `styles.css`, `tests/food-area.test.js`

**Interfaces:**
- **Ansicht `shop`:**
  - Oben `SHOP_NOTE`. An Mi und So zusätzlich die Karte „Heute Mealprep · Liste durchgehen“.
  - Die Kategorien sind Checkbox-Listen (`data-a="need" data-id`). Abgehakt heißt „fehlt“ und landet in `food.need`.
- **Umschalter** „Nur fehlende (N)“ (`data-a="onlyneed"`, Zustand nur für den Bildschirm) zeigt beim Einkaufen nur die fehlenden Artikel. Ein Tippen auf einen Artikel nimmt ihn dann aus `food.need`.
- **„Liste zurücksetzen“** (`data-a="shopclear"`, zwei Tipps) setzt `food.need = {}`.
- **„Bearbeiten“** (`data-a="iedit"`):
  - pro Artikel „×“ (`data-a="idel" data-id`)
  - pro Kategorie ein Feld (`data-a="inew" data-cat`, im Entwurf) mit „+“ (`data-a="iadd" data-cat`). Die ID ist `slug(name)`, bei einer Kollision mit Zähler.
  - „Auf Notion-Stand zurücksetzen“ (`data-a="ireset"`, zwei Tipps) setzt `food.shop = null`.
- **Supplements bearbeiten** auf „Tag“: Der Knopf „Bearbeiten“ (`data-a="sedit"`) schaltet in derselben Art um:
  - Name (`data-a="sn"`)
  - „×“ (`data-a="sdel"`)
  - pro Gruppe „+ Supplement“ (`data-a="sadd" data-group`)
  - Zurücksetzen (`data-a="sreset"`)
  - `shake` bleibt beim Umbenennen erhalten.

- [ ] **Step 1: Failing tests:**
  - `shopping list marks missing items`:
    - `need eier` mit `checked:true` ergibt `food.need.eier === true`.
    - `onlyneed` ergibt ein HTML mit „Eier“, aber ohne „Milch“.
    - `shopclear` mit zwei Tipps ergibt `{}`.
  - `adding and removing a shopping item`: `inew` „Hafermilch“ in „Milchprodukte & Eier“ plus `iadd` ergibt den Artikel `hafermilch`, `idel` entfernt ihn, und `ireset` mit zwei Tipps ergibt `food.shop === null`.
  - `mealprep reminder on wednesday and sunday`: Am Mi 25.11. enthält die Ansicht „Heute Mealprep“, am Do 26.11. nicht.
  - `editing supplements keeps the shake`: `sn kreatin` „Kreatin + Whey“ und danach `supp kreatin` legen weiter einen 25-g-Shake an.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Verify** in der Vorschau: Fehlende Artikel abhaken, umschalten, im „Laden“ abhaken. Einen Artikel hinzufügen und zurücksetzen. Mobil, hell und dunkel.
- [ ] **Step 6: Commit:** `feat: add shopping list and editable supplements`

### Task 7: Heute an Ernährung anbinden

**Files:**
- Modify: `js/areas/heute.js`, `tests/heute.test.js`

**Interfaces:**
- **Consumes:** `food/index.js` `summary(ctx)`, ersetzbar über `setFoodSummary(fn)` wie bei Recovery.
- **Kachel Ernährung** (`href="#ernaehrung"`):
  - Text „Protein 45 / 170 g“, ohne Gewicht „Protein 45 g · Ziel fehlt“.
  - Zweite Zeile „Wasser 1,0 / 3,5 L · Morgens 1/3“, das ist die fällige Gruppe mit offenen Supplements. Ist sie komplett, steht da „Supps ✓“.
- **Hinweis-Karten** (`.card`) nach den Recovery-Karten:
  - `snack`: „Vor dem Training: Kohlenhydrat-Snack“ mit dem Text „Dein Essen ist über 3 h her“ und Link `#ernaehrung`.
  - `dinner`: „Abendessen: 30–40 g Protein + Kohlenhydrate“ mit Link `#ernaehrung`.
  - `mealprep`: „Heute Mealprep · Einkaufsliste prüfen“ mit Link `#ernaehrung/einkauf`.
- **„Kommt bald“** zeigt „Routinen · Körper · Arena“.

- [ ] **Step 1: Failing tests** in `tests/heute.test.js`:
  - `heute food tile with protein and water`:
    - Gewicht 85 und ein Eintrag mit 45 g ergeben „Protein 45 / 170 g“.
    - Das HTML enthält `href="#ernaehrung"`.
  - `heute food tile without a weight`: Das HTML enthält „Ziel fehlt“ und kein „NaN“.
  - `snack hint before training`: Do 26.11. 14:30 mit Mittag um 12:00 ergibt „Kohlenhydrat-Snack“.
  - `dinner hint after training`: Do 18:00 ergibt „30–40 g Protein“.
  - `mealprep hint on wednesday`: Mi 25.11. ergibt „Heute Mealprep“, Do 26.11. nicht.
  - `coming-soon line`: „Kommt bald“ enthält nicht „Ernährung“.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 5: Verify** in der Vorschau: Die Kachel zeigt die Werte aus „Ernährung“, und die Hinweise erscheinen zu den gestellten Uhrzeiten (per `Date`-Überschreibung in der Konsole). Mobil, hell und dunkel, keine Konsolenfehler.
- [ ] **Step 6: Commit:** `feat: show nutrition on the Heute page`

### Task 8: Veröffentlichen

- [ ] **Step 1:** In `sw.js` den Cache auf `CACHE = 'ki-apps-v3'` setzen und `js/areas/food/data.js`, `logic.js`, `view.js` und `index.js` in die Liste aufnehmen. Danach die Liste mit allen Dateien in `js/` abgleichen, mit dem Skript aus Stufe 2.
- [ ] **Step 2:** `npm test` ausführen. Erwartet: PASS.
- [ ] **Step 3: Commit:** `chore: release nutrition (cache v3)`
- [ ] **Step 4:** Abschluss-Review des gesamten Bereichs durch einen frischen Prüfer. Wichtige Funde mit Test beheben.
- [ ] **Step 5:** `git push origin main` ausführen, dann prüfen, bis `https://julians4.github.io/ki-apps/js/areas/food/index.js` mit 200 antwortet und `sw.js` `ki-apps-v3` enthält. Danach die Live-Seite öffnen: keine Konsolenfehler, und Ernährung wird angezeigt.
- [ ] **Step 6 (Julian):**
  - Die App einmal mit Netz öffnen.
  - Gewicht eingeben, Frühstück antippen, Wasser und Supplements abhaken.
  - Einmal ein Gericht halten, um die Zutaten zu sehen.
