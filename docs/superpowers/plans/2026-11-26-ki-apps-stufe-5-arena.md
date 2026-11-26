# KI-Apps · Stufe 5 · Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den täglichen Punktewettkampf Julian gegen Uygar online bauen:
- Ansichten Heute, Woche und Verlauf mit Live-Punkten
- gemeinsame Aufgabenliste
- Vorschläge für Julian
- Einrichtung über eingefügte Firebase-Konfiguration und Einladungslink
- Heute-Kachel

**Architecture:**
- Neuer Bereich `js/areas/arena/` mit:
  - `data.js` (Startaufgaben, Spieler)
  - `logic.js` (rein, getestet: Punkte, Berliner Tag, Wochen, Verlauf, Änderungsfenster, Vorschläge, Einladung/Konfiguration)
  - `net.js` (Online-Schnittstelle: `firebaseNet` lädt das SDK; `memServer`/`memNet` als Attrappe für Tests, die dieselben Rechte durchsetzt wie die Regeln)
  - `view.js`, `index.js`
- Die Ansicht liest ein Modell im Speicher, das die Abonnements füllen.
- Der Zugang liegt in `ki.arena.conn`, der letzte Stand für Heute in `ki.arena.cache`.

**Tech Stack:**
- Vanilla-JS-ES-Module, localStorage, `node --test` (Node 22 mit ICU für `Europe/Berlin`), keine Abhängigkeiten im Repo
- Firebase JS SDK **10.14.1** als ES-Module von `https://www.gstatic.com/firebasejs/10.14.1/`: `firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js`

**Spec:**
- `docs/superpowers/specs/2026-11-26-ki-apps-stufe-5-arena-design.md`
- Haupt-Spec: `docs/superpowers/specs/2026-11-25-ki-apps-design.md` §6.6, §9

## Global Constraints

- **Im Repo** steht keine Firebase-Konfiguration, kein Arena-Code und kein Schlüssel; nur Platzhalter in der Anleitung.
- **Online** liegen nur Spielernamen, Aufgaben, Ja/Nein, Werte und Punkte. Nichts aus anderen Bereichen; Vorschläge rechnen lokal.
- **Das SDK** lädt nur in der Arena, nie auf Heute oder in anderen Bereichen. Die Heute-Kachel liest `ki.arena.cache`.
- **Tagesgrenze:** Europe/Berlin, unabhängig von der Gerätezeitzone.
- **Punkte:**
  - Ja = 1, Nein = 0, Wert ÷ Ziel ohne Obergrenze.
  - Anzeige mit einer Nachkommastelle und Komma, intern ungerundet.
  - Punkte werden beim Schreiben pro Tag gespeichert.
- **Änderbar** sind heute und gestern. In der Startwoche zusätzlich alle Tage dieser Woche bis heute.
- **Texte wörtlich:**
  - Einrichtung und Zugang: „Arena einrichten“, „Arena anlegen“, „Einladung einfügen“, „Einladung für Uygar“, „Link für mich“, „Neue Arena anlegen“, „Arena verlassen“
  - Anzeige: „Weitere Bereiche einblenden“, „Gestern ändern ›“, „Übernehmen“, „wird gesendet“
  - Hinweise: „Noch keine Arena auf diesem Gerät“, „Arena braucht beim ersten Mal Netz“
  - Bearbeiten: „Auf Notion-Stand zurücksetzen“, „Sicher? Nochmal tippen“
- **Layout:** 375 px ohne seitliches Scrollen, Tippziele ≥ 44 px. Kaputte gespeicherte Daten werfen nie.
- **Service-Worker:** Cache `ki-apps-v7`, neue Dateien in `FILES`. Er hält die SDK-Dateien der festen Version vor und lässt andere fremde Anfragen (Firestore-Kanal) unberührt.

## Review Focus

1. **Uygars Weg auf dem iPhone:**
   - Link in WhatsApp → öffnet in Safari.
   - Danach Installation auf dem Home-Bildschirm, oder die App ist schon installiert.
   - Erwartet: Mit „Einladung einfügen“ kommt der Zugang in die installierte App. Der Hinweis in Safari erklärt das. Die Adresse verliert die Daten erst, nachdem der Zugang gespeichert ist.
2. **Netzverlust mitten im Eintragen** (Funkloch, Flugmodus):
   - Erwartet: Die Eingabe bleibt sichtbar und zeigt „wird gesendet“. Sie kommt beim anderen an, sobald Netz da ist.
   - Ein erster Start ohne Netz zeigt „Arena braucht beim ersten Mal Netz“ statt zu hängen.
3. **Tagesgrenze und Zeitzone:**
   - Einträge um 23:59 und 00:01 deutscher Zeit, ein Gerät in anderer Zeitzone, der Wechsel Sonntag → Montag in der Wochen-Ansicht.
   - Erwartet: Tag und Woche nach Berliner Zeit. „Gestern“ ist der Berliner Vortag.
4. **Rechte:**
   - Uygar versucht Julians Tag zu schreiben.
   - Ein Fremder mit Konfiguration, aber ohne Code, versucht Arenen aufzulisten.
   - Ein Gerät ohne gültigen Schlüssel liest Tage.
   - Erwartet: alles abgelehnt. In der App führt das zu einer Meldung, nicht zu einem Absturz. Geprüft wird im Regel-Playground nach der Prüfliste.
5. **Kaputte oder alte lokale Daten:**
   - `ki.arena.conn` ist kaputt oder halb gefüllt, `ki.arena.cache` ist alt.
   - Ein Backup mit anderem Arena-Code wird geladen.
   - Erwartet: Nichts wirft. Die Arena zeigt die Einrichtung bzw. die Meldung „Arena-Zugang aus dem Backup übernommen“.

---

### Task 1: Daten und reine Logik

**Files:**
- Create: `js/areas/arena/data.js`, `js/areas/arena/logic.js`
- Test: `tests/arena-logic.test.js`

**Interfaces:**
- **Produces `data.js`:**
  - `PLAYERS = { julian: 'Julian', uygar: 'Uygar' }`
  - `TASKS`: in dieser Reihenfolge `{ id, name, kind, unit?, goal?, hint, order, archived: false }`:
    - `health` Health (Ja/Nein): „8 h Quality Sleep · Healthy Nutrition · 3 L Water“
    - `income` Income (Wert, €, Ziel 50): „How much money did you earn today?“
    - `skills` Skills (Ja/Nein): „Did you learn a new skill today?“
    - `training` Training (Ja/Nein): „Did you train hard today?“
    - `work` Work Hours (Wert, h, Ziel 10): „How many hours did you work today?“
- **Produces `logic.js` — Zahlen und Punkte:**
  - `fmt1(n) → string`: eine Nachkommastelle, Komma, „,0“ wird weggelassen.
  - `taskPoints(task, value) → number`
  - `dayPoints(tasks, values) → { points: { id: n }, total }`: nur Aufgaben mit Wert in `values`.
  - `cleanTasks(raw) → Task[]`: ungültige fallen weg, sortiert nach `order`.
- **Tage und Wochen:**
  - `berlinDay(date) → 'YYYY-MM-DD'`: Kalendertag in Europe/Berlin.
  - `mondayOf(day)`, `weekDays(monday) → 7 Tage`, `isoWeek(day) → { year, week }`
- **Ändern:** `editable(day, today, start) → bool`, Regel wie in den Global Constraints.
- **Woche und Verlauf:**
  - `weekSums(days, monday) → { julian, uygar, leader: 'julian'|'uygar'|null, diff }`. `days` ist eine Liste von Tagesdokumenten `{ player, date, total }`.
  - `history(days, start, today) → [{ year, week, monday, julian, uygar, winner }]`, neueste zuerst, von der Startwoche bis zur aktuellen Woche. Bei Gleichstand ist `winner` `null`.
  - `totalsSince(days) → { julian, uygar, wins: { julian, uygar } }`. Die Siege zählen nur abgeschlossene Wochen, also nicht die aktuelle; dafür erwartet die Funktion die aktuelle Woche.
- **Vorschläge:** `suggest({ sleepH, clean, water, sets }) → { health: bool, training: bool }`
  - Health: `sleepH ≥ 8 && clean === true && water ≥ 3000`
  - Training: `sets ≥ 1`
- **Einladung und Konfiguration:**
  - `parseConfig(text) → cfg|null`: nimmt JSON oder das JS-Objekt aus der Konsole an. Pflicht sind `apiKey`, `authDomain`, `projectId`, `appId`.
  - `randomId(bytes) → base64url` (über `crypto.getRandomValues`)
  - `encodeInvite(conn) → string` (base64url von JSON)
  - `decodeInvite(text) → conn|null`:
    - Nimmt einen ganzen Link, `#arena/einladung?…` oder nur den Teil danach.
    - Prüft: `cfg` laut `parseConfig`-Pflichtfeldern, `code` passt auf `/^[A-Za-z0-9_-]{22,}$/`, `player` ∈ PLAYERS, `key` hat ≥ 32 Zeichen.
  - `cleanConn(raw) → conn|null`: gleiche Prüfung für `ki.arena.conn`. Ein vorhandenes `keys` wird nur übernommen, wenn es beide Spieler hat.

- [ ] **Step 1: Write the failing tests** in `tests/arena-logic.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { TASKS } from '../js/areas/arena/data.js';
import { fmt1, taskPoints, dayPoints, cleanTasks, berlinDay, mondayOf, weekDays, isoWeek, editable, weekSums, history, totalsSince, suggest, parseConfig, randomId, encodeInvite, decodeInvite, cleanConn } from '../js/areas/arena/logic.js';

const CFG = { apiKey: 'AIzaTest', authDomain: 'x.firebaseapp.com', projectId: 'x', appId: '1:2:web:3' };
const conn = (o = {}) => ({ cfg: CFG, code: 'A'.repeat(22), player: 'uygar', key: 'K'.repeat(32), ...o });

test('points: yes is 1, values divide by the goal without a cap', () => {
  const [health, income, , , work] = TASKS;
  assert.equal(taskPoints(health, true), 1);
  assert.equal(taskPoints(health, false), 0);
  assert.equal(taskPoints(income, 100), 2);
  assert.equal(taskPoints(work, 12), 1.2);
  assert.equal(taskPoints(work, 'x'), 0);
  const d = dayPoints(TASKS, { health: true, income: 35, skills: false, training: true, work: 9 });
  assert.deepEqual(d.points, { health: 1, income: 0.7, skills: 0, training: 1, work: 0.9 });
  assert.ok(Math.abs(d.total - 3.6) < 1e-9);
  assert.equal(fmt1(d.total), '3,6');
  assert.equal(fmt1(2), '2');
  assert.equal(fmt1(1.25), '1,3');
});

test('task list is cleaned and sorted', () => {
  assert.deepEqual(cleanTasks([{ id: 'b', name: 'B', kind: 'yes', order: 2 }, { id: 'a', name: 'A', kind: 'value', goal: 5, unit: 'h', order: 1 }, { id: '', kind: 'yes' }, { id: 'c', name: 'C', kind: 'value', goal: 0 }, 'x']).map(t => t.id), ['a', 'b']);
  assert.deepEqual(cleanTasks('x'), []);
});

test('the day follows Berlin, not the device', () => {
  assert.equal(berlinDay(new Date('2026-11-26T22:59:00Z')), '2026-11-26');
  assert.equal(berlinDay(new Date('2026-11-26T23:01:00Z')), '2026-11-27');
  assert.equal(berlinDay(new Date('2026-07-01T22:30:00Z')), '2026-07-02');
});

test('weeks', () => {
  assert.equal(mondayOf('2026-11-29'), '2026-11-23');
  assert.equal(mondayOf('2026-11-23'), '2026-11-23');
  assert.deepEqual(weekDays('2026-11-23'), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
  assert.deepEqual(isoWeek('2026-11-26'), { year: 2026, week: 48 });
  assert.deepEqual(isoWeek('2027-01-01'), { year: 2026, week: 53 });
});

test('today, yesterday and the start week are editable', () => {
  assert.equal(editable('2026-11-26', '2026-11-26', '2026-11-26'), true);
  assert.equal(editable('2026-11-25', '2026-11-26', '2026-11-20'), true);
  assert.equal(editable('2026-11-24', '2026-11-26', '2026-11-20'), false);
  assert.equal(editable('2026-11-23', '2026-11-26', '2026-11-26'), true);
  assert.equal(editable('2026-11-23', '2026-12-01', '2026-11-26'), false);
  assert.equal(editable('2026-11-27', '2026-11-26', '2026-11-26'), false);
});

test('week sums, history and totals', () => {
  const days = [
    { player: 'julian', date: '2026-11-23', total: 3 }, { player: 'uygar', date: '2026-11-23', total: 2.5 },
    { player: 'julian', date: '2026-11-30', total: 1 }, { player: 'uygar', date: '2026-12-01', total: 4 },
    { player: 'julian', date: '2026-12-07', total: 2 }, { player: 'uygar', date: '2026-12-07', total: 2 },
  ];
  assert.deepEqual(weekSums(days, '2026-11-23'), { julian: 3, uygar: 2.5, leader: 'julian', diff: 0.5 });
  const h = history(days, '2026-11-23', '2026-12-08');
  assert.deepEqual(h.map(w => [w.week, w.winner]), [[50, null], [49, 'uygar'], [48, 'julian']]);
  assert.deepEqual(totalsSince(days, '2026-12-08'), { julian: 6, uygar: 8.5, wins: { julian: 1, uygar: 1 } });
});

test('suggestions need all three for health', () => {
  assert.deepEqual(suggest({ sleepH: 8, clean: true, water: 3000, sets: 1 }), { health: true, training: true });
  assert.deepEqual(suggest({ sleepH: 7.5, clean: true, water: 3500, sets: 0 }), { health: false, training: false });
  assert.deepEqual(suggest({ sleepH: 9, clean: false, water: 3500, sets: 0 }).health, false);
  assert.deepEqual(suggest({}), { health: false, training: false });
});

test('config from the console snippet or JSON', () => {
  const snippet = 'const firebaseConfig = {\n  apiKey: "AIzaTest",\n  authDomain: "x.firebaseapp.com",\n  projectId: "x",\n  storageBucket: "x.appspot.com",\n  appId: "1:2:web:3"\n};';
  assert.deepEqual(parseConfig(snippet), { ...CFG, storageBucket: 'x.appspot.com' });
  assert.deepEqual(parseConfig(JSON.stringify(CFG)), CFG);
  assert.equal(parseConfig('{"apiKey":"x"}'), null);
  assert.equal(parseConfig('quatsch'), null);
});

test('invites round-trip and reject anything odd', () => {
  const t = encodeInvite(conn());
  assert.match(t, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeInvite(t), conn());
  assert.deepEqual(decodeInvite(`https://julians4.github.io/ki-apps/#arena/einladung?${t}`), conn());
  assert.deepEqual(decodeInvite(`#arena/einladung?${t}`), conn());
  assert.equal(decodeInvite(encodeInvite(conn({ player: 'max' }))), null);
  assert.equal(decodeInvite(encodeInvite(conn({ code: 'kurz' }))), null);
  assert.equal(decodeInvite('kaputt!'), null);
  assert.match(randomId(16), /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(randomId(16), randomId(16));
});

test('stored access is checked on read', () => {
  assert.deepEqual(cleanConn(conn()), conn());
  assert.equal(cleanConn({ cfg: CFG }), null);
  assert.equal(cleanConn('x'), null);
  const j = conn({ player: 'julian', keys: { julian: 'J'.repeat(32), uygar: 'U'.repeat(32) } });
  assert.deepEqual(cleanConn(j).keys, j.keys);
  assert.equal('keys' in cleanConn(conn({ keys: { julian: 'x' } })), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/arena-logic.test.js`
Expected: FAIL, `ERR_MODULE_NOT_FOUND` für `js/areas/arena/data.js`.

- [ ] **Step 3: Implement `data.js` and `logic.js`**

- `berlinDay` nutzt `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })`.
- Wochen- und Tagesrechnung auf Datums-Strings läuft mittags in UTC, damit keine Sommerzeit-Sprünge entstehen.
- base64url läuft über `btoa`/`atob` auf UTF-8 (`TextEncoder`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add js/areas/arena/data.js js/areas/arena/logic.js tests/arena-logic.test.js
git commit -m "feat: arena points, weeks, invites (logic)"
```

### Task 2: Online-Schnittstelle, Regeln und Anleitung

**Files:**
- Create:
  - `js/areas/arena/net.js`
  - `firestore.rules`
  - `docs/arena-firebase.md` (Anleitung für Julian und Prüfliste für den Regel-Playground)
- Test: `tests/arena-net.test.js`

**Interfaces:**
- Consumes: `cleanTasks`, `PLAYERS`, `TASKS` (Task 1).
- **Produces — gemeinsame Schnittstelle** (`firebaseNet(conn)` und `memNet(server, conn)` liefern dasselbe):
  - **`ready: Promise`**: angemeldet und für `conn.player` beansprucht. Lehnt mit `Error('offline' | 'denied' | 'config')` ab.
  - **`create({ start, tasks, keys })`**: legt Arena, beide Schlüssel und Aufgaben an. Nur beim Einrichten; vor `ready` aufzurufen.
  - **Abonnements** (geben eine Abmeldefunktion zurück):
    - `watchTasks(cb)`: `cb(Task[])` bei jeder Änderung.
    - `watchDays(from, to, cb)`: `cb(DayDoc[])` für die Tage `from..to` beider Spieler.
  - **`putDay({ date, values })`**:
    - Berechnet nichts selbst, schreibt das übergebene `{ player: conn.player, date, values, points, total }`.
    - Der Aufrufer liefert `points` und `total` mit.
  - **`putTask(task)`**
  - **`status() → { pending: bool }`**: ungesendete Schreibvorgänge vorhanden.
  - **`close()`**
- **Attrappe:**
  - `memServer()`: hält Arenen, Schlüssel und Ansprüche im Speicher und setzt dieselben Rechte durch wie `firestore.rules`:
    - Anspruch nur mit passendem Schlüssel.
    - Tage nur für den beanspruchten Spieler.
    - Lesen nur mit Anspruch.
    - Unbekannter Code → `denied`.
  - `memServer({ offline: true })` lässt `ready` mit `offline` scheitern.
  - `server.putDayAs(player, doc)` dient Tests als „der andere schreibt“.
  - Abonnements der Attrappe rufen ihre Rückruffunktion sofort und nach jeder Änderung synchron auf.
- **`firebaseNet(conn)`:**
  - Lädt die drei SDK-Module per `import()` von der festen URL.
  - `initializeApp(conn.cfg, 'arena')`, dann `signInAnonymously`.
  - `initializeFirestore` mit `persistentLocalCache({ tabManager: persistentSingleTabManager() })`; schlägt das fehl, `getFirestore`.
  - Anspruch: `setDoc(arenas/{code}/claims/{player}_{uid}, { player, uid, key })`.
  - Lesen über `onSnapshot`.
  - `pending` aus `metadata.hasPendingWrites`.
  - Fehlercodes `unavailable` → `offline`, `permission-denied` → `denied`.
- **`firestore.rules`** setzt diese Tabelle um:

  | Pfad | Lesen | Schreiben |
  |---|---|---|
  | `arenas/{code}` | `get` für Angemeldete | `list` verboten; `create` nur mit genau `start` und `v`; kein update/delete |
  | `keys/{p}` | nie | `create` nur für `p` ∈ {julian, uygar}, nur Feld `key` (String, ≥ 32 Zeichen) |
  | `claims/{p}_{uid}` | nie | `create`/`update`, wenn `uid == request.auth.uid` und `key == get(keys/p).key` |
  | `tasks/{t}` | wer einen Anspruch hat | wer einen Anspruch hat; Felder werden geprüft |
  | `days/{p}_{date}` | wer einen Anspruch hat | nur, wenn ein Anspruch für genau diesen Spieler `p` existiert |

  Kein delete. Alles andere ist verboten.
- **`docs/arena-firebase.md`:**
  - Schritte in der Firebase-Konsole:
    1. Projekt anlegen, Analytics aus.
    2. Web-App registrieren.
    3. Firestore anlegen (Standort `eur3`, Produktionsmodus).
    4. Authentication → Anonym aktivieren.
    5. Regeln aus `firestore.rules` einfügen und veröffentlichen.
    6. Unter „Autorisierte Domains“ `julians4.github.io` prüfen.
  - Danach: wo das `firebaseConfig`-Objekt steht und wohin es in der App kommt.
  - Eine Prüfliste mit 8 Fällen für den Regel-Playground: die Fälle aus Review Focus 4 sowie erlaubtes eigenes Schreiben und Lesen.

- [ ] **Step 1: Write the failing tests** in `tests/arena-net.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { memServer, memNet } from '../js/areas/arena/net.js';
import { TASKS } from '../js/areas/arena/data.js';

const CFG = { apiKey: 'a', authDomain: 'b', projectId: 'c', appId: 'd' };
const KEYS = { julian: 'J'.repeat(32), uygar: 'U'.repeat(32) };
const conn = (player, key = KEYS[player], code = 'C'.repeat(22)) => ({ cfg: CFG, code, player, key });

async function arena() {
  const server = memServer(), j = memNet(server, conn('julian'));
  await j.create({ start: '2026-11-26', tasks: TASKS, keys: KEYS });
  await j.ready;
  return { server, j };
}

test('players write their own days and see each other live', async () => {
  const { server, j } = await arena(), u = memNet(server, conn('uygar'));
  await u.ready;
  let seen = [];
  j.watchDays('2026-11-23', '2026-11-29', d => { seen = d; });
  await u.putDay({ date: '2026-11-26', values: { health: true }, points: { health: 1 }, total: 1 });
  assert.deepEqual(seen.map(d => [d.player, d.total]), [['uygar', 1]]);
  let tasks = [];
  u.watchTasks(t => { tasks = t; });
  assert.equal(tasks.length, 5);
});

test('a wrong key or code gets nowhere', async () => {
  const { server } = await arena();
  await assert.rejects(memNet(server, conn('uygar', 'X'.repeat(32))).ready, /denied/);
  await assert.rejects(memNet(server, conn('uygar', KEYS.uygar, 'D'.repeat(22))).ready, /denied/);
  assert.throws(() => server.putDayAs('julian', { player: 'uygar', date: '2026-11-26', values: {}, points: {}, total: 0 }), /denied/);
});

test('offline first start says so', async () => {
  await assert.rejects(memNet(memServer({ offline: true }), conn('julian')).ready, /offline/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/arena-net.test.js`
Expected: FAIL, `js/areas/arena/net.js` fehlt.

- [ ] **Step 3: Implement `net.js`, write `firestore.rules` and `docs/arena-firebase.md`**

`firebaseNet` ist in Node nicht testbar. Es wird im Browser und nach Julians Einrichtung live geprüft (Task 5).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add js/areas/arena/net.js firestore.rules docs/arena-firebase.md tests/arena-net.test.js
git commit -m "feat: arena network layer, security rules and setup guide"
```

### Task 3: Bereich Arena: Heute, Woche, Verlauf, Aufgaben

**Files:**
- Create: `js/areas/arena/view.js`, `js/areas/arena/index.js`
- Modify: `js/core/routes.js`, `js/app.js`, `styles.css`
- Test: `tests/arena-area.test.js`, `tests/routes.test.js`

**Interfaces:**
- Consumes: Task 1 und Task 2 (`memNet`/`firebaseNet` mit gleicher Schnittstelle).
- **Routen:**

  | Hash | Route |
  |---|---|
  | `#arena` | `{ area: 'arena', view: 'today' }` |
  | `#arena/woche` | `{ area: 'arena', view: 'week' }` |
  | `#arena/verlauf` | `{ area: 'arena', view: 'history' }` |
  | `#arena/einladung?<x>` | `{ area: 'arena', view: 'invite', token: '<x>' }` |

- **`app.js`:** `AREAS.arena`, `TITLES.arena = 'Arena'`.
- **`index.js` exportiert:**
  - Bereichsvertrag: `onNavigate`, `header`, `render`, `mount`, `onClick`, `onInput`, `onChange`
  - für Tests: `setNetFactory(fn)`, Standard `firebaseNet`
  - `conn(ctx)` liest `ki.arena.conn` über `cleanConn`
  - `cacheSummary(ctx) → { day, julian, uygar }|null` aus `ki.arena.cache`
- **Verbindung:** `mount` (bzw. der erste `render` mit Zugang) baut eine Verbindung pro Code und hält sie über Navigationen. Abonniert werden die Aufgaben und alle Tage ab dem Start; bei zwei Dokumenten pro Tag ist das klein, und Woche wie Verlauf brauchen keine eigenen Abos. Jede Änderung aktualisiert das Modell, schreibt `ki.arena.cache` und zeichnet neu.
- **Heute:**
  - Kopf „Julian x : y Uygar“ (`fmt1`).
  - Liste der aktiven Aufgaben für `conn.player` am angezeigten Tag:
    - Ja/Nein: `data-a="yes"` bzw. `data-a="no"`, jeweils mit `data-t="<taskId>"`, der gewählte Knopf mit Klasse `pri`.
    - Wert: `<input … data-a="val" data-t="<taskId>" inputmode="decimal" value="…">`, gespeichert bei `change`, Komma erlaubt.
  - Jede Änderung schreibt den ganzen Tag mit `dayPoints` neu.
  - Umschalten heute/gestern: `data-a="day" data-d="<Tag>"`, Text „Gestern ändern ›“ bzw. „Zurück zu heute ›“.
  - Gesperrte Tage sind nur lesbar.
  - Bei `pending`: „wird gesendet“.
- **Vorschläge** nur für `julian`:
  - Eingaben:
    - `sleepH = hoursInBed(bed, wake)` aus `rec.morning[heute]`, nur wenn der Eintrag existiert.
    - `clean` und `water` aus `food` `summary(ctx)`.
    - `sets` = erledigte Sätze der heutigen Einheit (`totals` aus `js/areas/training/logic.js` mit `train.plan` bzw. `DEF`).
  - Ist ein Vorschlag wahr und die Aufgabe noch offen, erscheint darunter „Vorschlag: Ja“ mit `data-a="take" data-t="<id>"` „Übernehmen“.
- **Woche:**
  - Tabelle Mo–So mit beiden Spielern, Summe und „Julian führt mit 1,3“ bzw. „Gleichstand“.
  - Wochenwechsel: `data-a="wk" data-d="<Montag>"`.
- **Verlauf:**
  - Kopf mit `totalsSince`.
  - Pro Woche: „KW 48 · Julian 12,3 : 10,1 Uygar · Sieger Julian“ bzw. „Unentschieden“.
- **Aufgaben bearbeiten:**
  - Umschalten mit `data-a="tedit"`.
  - Pro Aufgabe Name (`data-a="tn"`), Ziel (`data-a="tg"`) und Archivieren (`data-a="tarch"`).
  - „+ Aufgabe“ (`data-a="tadd"`, neue Ja/Nein-Aufgabe „Neue Aufgabe“).
  - „Auf Notion-Stand zurücksetzen“ (`data-a="treset"`, zwei Tipps).
- **Leere Zustände:**
  - Ohne Zugang: „Noch keine Arena auf diesem Gerät“ mit Link `#einstellungen`.
  - Scheitert `ready` mit `offline` und es gibt kein Modell: „Arena braucht beim ersten Mal Netz“.
  - Mit `denied`: „Kein Zugriff auf diese Arena – Einladung prüfen“.

- [ ] **Step 1: Write the failing tests**

In `tests/routes.test.js`:

```js
test('arena routes', () => {
  assert.deepEqual(parseRoute('#arena'), { area: 'arena', view: 'today' });
  assert.deepEqual(parseRoute('#arena/woche'), { area: 'arena', view: 'week' });
  assert.deepEqual(parseRoute('#arena/verlauf'), { area: 'arena', view: 'history' });
  assert.deepEqual(parseRoute('#arena/einladung?abc_-1'), { area: 'arena', view: 'invite', token: 'abc_-1' });
});
```

`tests/arena-area.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as arena from '../js/areas/arena/index.js';
import { memServer, memNet } from '../js/areas/arena/net.js';
import { TASKS } from '../js/areas/arena/data.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const CFG = { apiKey: 'a', authDomain: 'b', projectId: 'c', appId: 'd' };
const KEYS = { julian: 'J'.repeat(32), uygar: 'U'.repeat(32) };
const CODE = 'C'.repeat(22);
const TODAY = { area: 'arena', view: 'today' }, WEEK = { area: 'arena', view: 'week' }, HIST = { area: 'arena', view: 'history' };
const click = dataset => ({ target: { closest: () => ({ dataset }) } });
const change = (dataset, value) => ({ target: { dataset, value } });

async function setup({ player = 'julian', now = new Date('2026-11-26T09:00:00+01:00'), offline = false } = {}) {
  const server = memServer({ offline });
  if (!offline) await memNet(server, { cfg: CFG, code: CODE, player: 'julian', key: KEYS.julian }).create({ start: '2026-11-26', tasks: TASKS, keys: KEYS });
  arena.setNetFactory(c => memNet(server, c));
  const store = createStore(memBackend());
  store.set('arena.conn', { cfg: CFG, code: CODE, player, key: KEYS[player] });
  const ctx = { store, now: () => now, status: '', setStatus(t) { ctx.status = t; }, toast() {}, rerender() {}, go(h) { ctx.went = h; } };
  arena.onNavigate(TODAY, ctx);
  arena.render(TODAY, ctx);
  await arena.ready(ctx);
  return { server, ctx };
}

test('ticking and entering values writes the day with points', async () => {
  const { server, ctx } = await setup();
  arena.onClick(click({ a: 'yes', t: 'health' }), TODAY, ctx);
  arena.onChange(change({ a: 'val', t: 'work' }, '7,5'), TODAY, ctx);
  const d = server.day('julian', '2026-11-26');
  assert.deepEqual(d.values, { health: true, work: 7.5 });
  assert.ok(Math.abs(d.total - 1.75) < 1e-9);
  assert.match(arena.render(TODAY, ctx), /Julian 1,8 : 0 Uygar/);
});

test("the other player's points come in live", async () => {
  const { server, ctx } = await setup();
  server.putDayAs('uygar', { player: 'uygar', date: '2026-11-26', values: { skills: true, income: 50 }, points: { skills: 1, income: 1 }, total: 2 });
  assert.match(arena.render(TODAY, ctx), /Julian 0 : 2 Uygar/);
  assert.deepEqual(arena.cacheSummary(ctx), { day: '2026-11-26', julian: 0, uygar: 2 });
});

test('yesterday can be changed, older days are locked', async () => {
  const { server, ctx } = await setup({ now: new Date('2026-12-02T09:00:00+01:00') });
  arena.onClick(click({ a: 'day', d: '2026-12-01' }), TODAY, ctx);
  arena.onClick(click({ a: 'yes', t: 'skills' }), TODAY, ctx);
  assert.equal(server.day('julian', '2026-12-01').values.skills, true);
  arena.onClick(click({ a: 'day', d: '2026-11-30' }), TODAY, ctx);
  arena.onClick(click({ a: 'yes', t: 'skills' }), TODAY, ctx);
  assert.equal(server.day('julian', '2026-11-30'), null);
});

test('suggestions for Julian only, with Übernehmen', async () => {
  const { ctx } = await setup();
  ctx.store.set('rec.morning', { '2026-11-26': { bed: '21:30', wake: '06:00' } });
  ctx.store.set('food.days', { '2026-11-26': { clean: true, water: 3000, meals: [], supps: {} } });
  const html = arena.render(TODAY, ctx);
  assert.match(html, /Vorschlag: Ja/);
  assert.match(html, /data-a="take" data-t="health"/);
  assert.doesNotMatch(html, /data-a="take" data-t="training"/);
  const u = await setup({ player: 'uygar' });
  u.ctx.store.set('rec.morning', { '2026-11-26': { bed: '21:30', wake: '06:00' } });
  assert.doesNotMatch(arena.render(TODAY, u.ctx), /Vorschlag/);
});

test('week and history', async () => {
  const { server, ctx } = await setup({ now: new Date('2026-12-02T09:00:00+01:00') });
  server.putDayAs('julian', { player: 'julian', date: '2026-11-26', values: {}, points: {}, total: 3 });
  server.putDayAs('uygar', { player: 'uygar', date: '2026-11-27', values: {}, points: {}, total: 1.7 });
  arena.onClick(click({ a: 'wk', d: '2026-11-23' }), WEEK, ctx);
  assert.match(arena.render(WEEK, ctx), /Julian führt mit 1,3/);
  arena.onNavigate(HIST, ctx);
  arena.render(HIST, ctx);
  assert.match(arena.render(HIST, ctx), /KW 48[^<]*Sieger Julian/);
});

test('shared task list: add, archive, reset', async () => {
  const { ctx } = await setup();
  arena.onClick(click({ a: 'tedit' }), TODAY, ctx);
  arena.onClick(click({ a: 'tadd' }), TODAY, ctx);
  assert.match(arena.render(TODAY, ctx), /value="Neue Aufgabe"/);
  arena.onClick(click({ a: 'tarch', t: 'skills' }), TODAY, ctx);
  arena.onClick(click({ a: 'tedit' }), TODAY, ctx);
  assert.doesNotMatch(arena.render(TODAY, ctx), /data-t="skills"/);
  arena.onClick(click({ a: 'tedit' }), TODAY, ctx);
  arena.onClick(click({ a: 'treset' }), TODAY, ctx);
  assert.match(arena.render(TODAY, ctx), /Sicher\? Nochmal tippen/);
  arena.onClick(click({ a: 'treset' }), TODAY, ctx);
  arena.onClick(click({ a: 'tedit' }), TODAY, ctx);
  const html = arena.render(TODAY, ctx);
  assert.match(html, /data-t="skills"/);
  assert.doesNotMatch(html, /Neue Aufgabe/);
});

test('without access, offline or denied there is a clear message', async () => {
  const store = createStore(memBackend()), ctx = { store, now: () => new Date('2026-11-26T09:00:00+01:00'), setStatus() {}, toast() {}, rerender() {}, go() {} };
  arena.onNavigate(TODAY, ctx);
  assert.match(arena.render(TODAY, ctx), /Noch keine Arena auf diesem Gerät/);
  store.set('arena.conn', 'kaputt');
  assert.doesNotThrow(() => arena.render(TODAY, ctx));
  const off = await setup({ offline: true }).catch(e => e);
  assert.ok(!(off instanceof Error));
  assert.match(arena.render(TODAY, off.ctx), /Arena braucht beim ersten Mal Netz/);
});
```

In `index.js` gibt es dafür `ready(ctx) → Promise`, die auf die laufende Verbindung wartet und Fehler im Modell vermerkt statt zu werfen. `server.day(player, date)` liefert in der Attrappe das gespeicherte Tagesdokument oder `null`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. `js/areas/arena/index.js` fehlt, und die Arena-Routen landen auf `heute`.

- [ ] **Step 3: Implement routes, app wiring, `view.js`, `index.js` and the arena CSS**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add js/areas/arena/view.js js/areas/arena/index.js js/core/routes.js js/app.js styles.css tests/arena-area.test.js tests/routes.test.js
git commit -m "feat: arena area with today, week, history and shared tasks"
```

### Task 4: Einrichtung, Einladung, Uygar-Modus, Heute-Kachel, Cache v7

**Files:**
- Modify:
  - `js/areas/settings.js`, `js/areas/arena/index.js`, `js/areas/arena/view.js`
  - `js/areas/heute.js`, `js/app.js`, `sw.js`, `styles.css`
- Test: `tests/arena-setup.test.js`, `tests/heute.test.js`

**Interfaces:**
- Consumes:
  - Task 1: `parseConfig`, `randomId`, `encodeInvite`, `decodeInvite`, `cleanConn`, `berlinDay`, `TASKS`
  - Task 3: `setNetFactory`, `conn`, `cacheSummary`
- **Einstellungen, Abschnitt „Arena“** (Handler in `settings.js`; die Logik als Exporte aus `arena/index.js`, damit sie testbar ist):
  - **Ohne Zugang:**
    - „Arena einrichten“: Textfeld `data-a="acfg"` (onInput) und Knopf `data-a="acreate"` „Arena anlegen“ → `arena.setupArena(ctx, text) → Promise<{ ok, error? }>`.
      - Erzeugt Code (16 Byte) und Schlüssel (24 Byte), ruft `create` auf.
      - Speichert `ki.arena.conn = { cfg, code, player: 'julian', key: keys.julian, keys }`.
    - „Einladung einfügen“: Textfeld `data-a="ainv"` und Knopf `data-a="ajoin"` → `arena.joinArena(ctx, text) → { ok, player }` (über `decodeInvite`).
  - **Mit Zugang Julian:**
    - „Einladung für Uygar“: Link `<Seite>#arena/einladung?<encodeInvite({ cfg, code, player: 'uygar', key: keys.uygar })>`, mit „Teilen“ (`navigator.share`, falls vorhanden) und „Kopieren“ (`navigator.clipboard`).
    - „Link für mich“: dasselbe für `julian`.
    - „Neue Arena anlegen“: zwei Tipps, gleiche Konfiguration, neuer Code und neue Schlüssel.
  - **Mit Zugang Uygar:** „Weitere Bereiche einblenden“ (`ki.app.full` umschalten).
  - **Immer mit Zugang:** „Arena verlassen“: zwei Tipps, löscht `ki.arena.conn` und `ki.arena.cache`.
  - **Beim Backup:** ein Satz „Das Backup enthält auch deinen Arena-Zugang.“. Nach dem Laden mit geändertem `code` meldet `#impMsg` zusätzlich „Arena-Zugang aus dem Backup übernommen“.
- **Route `invite`:**
  1. Mit gültigem Token: `joinArena`.
  2. Erst danach `history.replaceState(null, '', '#arena')`, dann Anzeige „Du bist Uygar“ bzw. „Du bist Julian“ mit Link zur Arena.
  3. Läuft die Seite nicht als Home-Bildschirm-App (`navigator.standalone !== true` und `matchMedia('(display-mode: standalone)')` passt nicht), zusätzlich der Hinweis aus dem Design (Abschnitt 5.1, Punkt 3) mit „Link kopieren“ (`data-a="acopy"`).
  4. Ungültig: „Diese Einladung ist ungültig oder unvollständig.“
- **Uygar-Modus** (`app.js`):
  - `arenaOnly(store)` ist wahr, wenn `cleanConn(ki.arena.conn).player === 'uygar'` und `ki.app.full !== true`.
  - Dann wird jede Route außer `arena` und `settings` zu `#arena` (`location.replace`).
  - Der Kopf der Arena zeigt statt „‹ Heute“ den Namen „Arena“ und einen Link „Einstellungen“.
- **Heute** (`heute.js`, mit `setArenaSummary` austauschbar):
  - Ohne Zugang: Kachel „Arena · einrichten ›“ → `#einstellungen`.
  - Mit Zugang und `cacheSummary.day === berlinDay(now)`: „Julian x : y Uygar“; sonst „Arena öffnen ›“.
  - Die „Kommt bald“-Zeile entfällt.
- **`sw.js`:**
  - `CACHE = 'ki-apps-v7'`, die fünf Arena-Dateien in `FILES`.
  - `fetch`: Anfragen an fremde Origins werden nur abgefangen, wenn sie mit `https://www.gstatic.com/firebasejs/10.14.1/` beginnen. Diese gehen „network first“ und werden gecacht; alle anderen fremden Anfragen bleiben unberührt (kein `respondWith`).

- [ ] **Step 1: Write the failing tests**

`tests/arena-setup.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as arena from '../js/areas/arena/index.js';
import { memServer, memNet } from '../js/areas/arena/net.js';
import { decodeInvite } from '../js/areas/arena/logic.js';
import { createStore } from '../js/core/store.js';
import { memBackend } from './helpers.js';

const SNIPPET = 'const firebaseConfig = { apiKey: "AIzaTest", authDomain: "x.firebaseapp.com", projectId: "x", appId: "1:2:web:3" };';
const mk = () => {
  const store = createStore(memBackend());
  return { store, now: () => new Date('2026-11-26T09:00:00+01:00'), setStatus() {}, toast() {}, rerender() {}, go() {} };
};

test('Julian sets up an arena and gets both links', async () => {
  const server = memServer();
  arena.setNetFactory(c => memNet(server, c));
  const ctx = mk();
  assert.deepEqual(await arena.setupArena(ctx, 'quatsch'), { ok: false, error: 'Konfiguration nicht erkannt' });
  const r = await arena.setupArena(ctx, SNIPPET);
  assert.equal(r.ok, true);
  const c = ctx.store.get('arena.conn');
  assert.equal(c.player, 'julian');
  assert.match(c.code, /^[A-Za-z0-9_-]{22}$/);
  const inv = decodeInvite(arena.inviteLink(ctx, 'uygar'));
  assert.deepEqual([inv.player, inv.code, inv.key], ['uygar', c.code, c.keys.uygar]);
  const u = mk();
  assert.deepEqual(arena.joinArena(u, arena.inviteLink(ctx, 'uygar')), { ok: true, player: 'uygar' });
  assert.equal('keys' in u.store.get('arena.conn'), false);
  await memNet(server, u.store.get('arena.conn')).ready;
});

test('a broken invite is refused and stores nothing', () => {
  const ctx = mk();
  assert.deepEqual(arena.joinArena(ctx, 'https://julians4.github.io/ki-apps/#arena/einladung?kaputt'), { ok: false });
  assert.equal(ctx.store.get('arena.conn'), null);
});

test('arena-only mode for Uygar until he shows all areas', () => {
  const ctx = mk();
  assert.equal(arena.arenaOnly(ctx.store), false);
  ctx.store.set('arena.conn', { cfg: { apiKey: 'a', authDomain: 'b', projectId: 'c', appId: 'd' }, code: 'C'.repeat(22), player: 'uygar', key: 'U'.repeat(32) });
  assert.equal(arena.arenaOnly(ctx.store), true);
  ctx.store.set('app.full', true);
  assert.equal(arena.arenaOnly(ctx.store), false);
});
```

In `tests/heute.test.js` (Import ergänzen: `setArenaSummary`, `arenaSummary as arenaSummaryDefault`):

```js
test('arena tile: set up, today’s score, or open', () => {
  assert.match(render({ area: 'heute' }, ctx()), /Arena · einrichten/);
  const s = createStore(memBackend());
  s.set('arena.conn', { cfg: { apiKey: 'a', authDomain: 'b', projectId: 'c', appId: 'd' }, code: 'C'.repeat(22), player: 'julian', key: 'J'.repeat(32) });
  s.set('arena.cache', { day: '2026-11-23', julian: 2.4, uygar: 1.8 });
  assert.match(render({ area: 'heute' }, ctx(s)), /Julian 2,4 : 1,8 Uygar/);
  s.set('arena.cache', { day: '2026-11-22', julian: 2.4, uygar: 1.8 });
  assert.match(render({ area: 'heute' }, ctx(s)), /Arena öffnen/);
});
```

Den bestehenden Test `coming-soon line after routines` ersetzen durch `assert.doesNotMatch(render({ area: 'heute' }, ctx()), /Kommt bald/)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. `setupArena`, `joinArena`, `inviteLink` und `arenaOnly` fehlen, die Kachel fehlt, und „Kommt bald“ steht noch da.

- [ ] **Step 3: Implement setup and join, the settings section, the invite view, arena-only mode, the Heute tile and `sw.js` v7**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün. Ein Abgleich von `FILES` in `sw.js` mit allen Dateien unter `js/` zeigt nichts Fehlendes.

- [ ] **Step 5: Commit**

```bash
git add js/areas/settings.js js/areas/arena/index.js js/areas/arena/view.js js/areas/heute.js js/app.js sw.js styles.css tests/arena-setup.test.js tests/heute.test.js
git commit -m "feat: arena setup and invite, Uygar mode, Heute tile, cache v7"
```

### Task 5: Prüfen, Review, Push, Einrichtung mit Julian

**Files:** keine neuen. Fixes aus dem Review gehen in die jeweiligen Dateien.

- [ ] **Step 1: Check in the browser preview at 375×812 with the in-memory server**

In der Vorschau wird `setNetFactory(c => memNet(server, c))` per Konsole gesetzt. Ohne Firebase-Projekt erreicht das echte SDK nichts.

Zu prüfen:
- Arena einrichten mit Beispiel-Konfiguration; Einladungslink; Einladung im zweiten Tab einfügen.
- Heute: Ja/Nein, Wert mit Komma, gestern, Vorschlag übernehmen.
- Woche, Verlauf, Aufgaben bearbeiten.
- Uygar-Modus: Route-Umleitung; „Weitere Bereiche einblenden“.
- Heute-Kachel.
- Der Einladungs-Hinweis außerhalb des Home-Bildschirms.

Expected: `scrollWidth` 375, keine Konsolenfehler, das SDK wird außerhalb der Arena nie angefragt (Netzwerk-Liste). Danach die Testdaten der Vorschau zurücksetzen; die Sicherung liegt in `sessionStorage`.

- [ ] **Step 2: Load the real SDK once without a project**

Mit einer ungültigen Beispiel-Konfiguration zeigt die Arena eine verständliche Meldung, und es gibt keinen ungefangenen Fehler. Damit ist das Laden der festen SDK-URL im Browser geprüft.

- [ ] **Step 3: Final review, fix pass, then push (freigegeben mit diesem Plan)**

`git push origin main`, dann prüfen, bis `sw.js` live `ki-apps-v7` enthält. Live kurz prüfen: Arena ohne Zugang zeigt die Einrichtung, keine Konsolenfehler.

- [ ] **Step 4: Hand over the Firebase setup to Julian**

Julian folgt `docs/arena-firebase.md` in seinem Google-Konto. Diese Schritte macht er selbst; der Builder legt keine Konten an.

Danach fügt er die Konfiguration in der App ein, legt die Arena an und geht die Prüfliste im Regel-Playground durch. Gemeinsam prüfen: ein Eintrag auf seinem iPhone erscheint in einem zweiten Browser-Tab mit „Link für mich“. Erst dann schickt Julian Uygars Einladung, und nur an Uygar.
