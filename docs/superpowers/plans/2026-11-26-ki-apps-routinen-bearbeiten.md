# KI-Apps · Routinen bearbeiten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Routinen-Schritte (Titel, Zeiten, hinzufügen, löschen) und die Packliste in der App bearbeitbar machen, mit einem „Auf Notion-Stand zurücksetzen“ für den Bereich.

**Architecture:**
- `logic.js` bekommt die reinen Prüfer `cleanSteps` und `cleanPack`. `routineFor` und `activeStep` nehmen die Listen als Parameter (Standard: Notion-Stand).
- `index.js` liest die Listen über `steps(ctx)` und `packList(ctx)` aus `ki.rout.steps` und `ki.rout.pack` und reicht sie überall durch: Tag-Ansicht, „Gestern Abend“, Häkchen, Zusammenfassung für „Heute“ und Halterung.
- Ein Bearbeiten-Modus pro Routine nach dem Muster des Supplement-Editors in Ernährung.

**Tech Stack:** Vanilla-JS-ES-Module, localStorage, `node --test`, keine Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-11-26-routinen-bearbeiten-design.md` (Ergänzung zu `docs/superpowers/specs/2026-11-25-ki-apps-design.md` §6.4 und §8)

## Global Constraints

- Keine Build-Schritte, keine Abhängigkeiten. Tests mit `npm test` (`node --test "tests/*.test.js"`, Node 22).
- Daten bleiben auf dem Gerät, unter localStorage-Schlüsseln mit Präfix `ki.`. Kein Netzwerkzugriff.
- Texte auf Deutsch, wörtlich:
  - „Bearbeiten“, „Fertig mit Bearbeiten“
  - „+ Schritt“, „+ Gegenstand“
  - „Auf Notion-Stand zurücksetzen“, „Sicher? Nochmal tippen“
- 375 px Breite ohne seitliches Scrollen; Tippziele ≥ 44 px.
- Kaputte gespeicherte Daten werfen nie und fallen auf den Notion-Stand zurück.
- Häkchen hängen an der Schritt-`id` und bleiben beim Umbenennen erhalten.
- Service-Worker-Cache wird `ki-apps-v5`. Es kommen keine neuen Dateien dazu.

## Review Focus

1. **iPhone-Zeitfelder:** `change` kommt, solange das Feld fokussiert ist, und die Shell zeichnet erst beim Verlassen neu. Erwartet: Der Wert ist sofort gespeichert, die Liste sortiert sich beim Verlassen neu, und beim Wechsel zwischen Feldern geht keine Eingabe verloren.
2. **Gelöschter verknüpfter Schritt** (z. B. Mobility): Erwartet:
   - Der Abend zählt 6 Schritte.
   - „Alles erledigt“ setzt keine `rec.mobility` mehr.
   - Recovery selbst funktioniert unverändert.
   - Die Halterung springt nie auf einen fehlenden Schritt.
3. **Zwei Schritte mit gleicher Zeit oder überlappende Zeiten:** Erwartet: Beide stehen in der Liste, nichts wirft. Die Halterung zeigt den Schritt, der Dauer hat, wie heute bei „PC Shutdown“ und „Duschroutine“ um 20:30.
4. **Abendschritte nach 23:00, Fr/Sa um +1 h über Mitternacht verschoben:** Erwartet: nichts wirft. Der Schritt steht mit der verschobenen Zeit am Ende, und die Halterung überspringt ihn.
5. **Backup:**
   - Ein altes Backup ohne `rout.steps` lässt die bearbeiteten Listen in Ruhe.
   - Ein Backup mit Listen ersetzt sie als Ganzes.
   - Kaputte Listen im Backup fallen beim Lesen auf Notion zurück.

---

### Task 1: Listen prüfen und durchreichen (logic.js)

**Files:**
- Modify: `js/areas/routines/logic.js`
- Test: `tests/routines-logic.test.js`

**Interfaces:**
- Produces:
  - `cleanSteps(raw: any, def: Step[]) → Step[]`
    - Behält nur Objekte mit nicht-leerer String-`id`, `from` im Format `HH:MM` (00–23:00–59) und String-`title`.
    - `to` bleibt nur, wenn es gültig ist und nach `from` liegt.
    - `link` bleibt nur, wenn es eines von `water`, `grandpa`, `pack`, `mobility`, `supps`, `breath` ist.
    - Doppelte `id`s: die erste gewinnt.
    - Gibt neue Objekte zurück, stabil sortiert nach `from`. Ist das Ergebnis leer, kommt `def` zurück.
  - `cleanPack(raw: any, def: Group[]) → Group[]`
    - Eine Gruppe ist `{ cat: string, items: [{ id, name }] }`.
    - Behält Gruppen mit String-`cat` und Array-`items`; von den Items nur die mit nicht-leerer String-`id` und String-`name`.
    - Ohne gültige Gruppe kommt `def` zurück.
  - `routineFor(kind, day, base = kind === 'morgen' ? MORNING : EVENING)`
  - `activeStep(day, hhmm, lists = { morgen: MORNING, abend: EVENING })`
  - Die bisherigen Aufrufe ohne Listen verhalten sich unverändert.

- [ ] **Step 1: Write the failing tests** in `tests/routines-logic.test.js`:

```js
import { cleanSteps, cleanPack } from '../js/areas/routines/logic.js'; // zum bestehenden Import ergänzen

test('cleanSteps keeps valid steps sorted and drops the rest', () => {
  const raw = [
    { id: 'b', from: '06:10', to: '06:05', title: 'B', link: 'nope' },
    { id: 'a', from: '06:00', to: '06:05', title: 'A', link: 'water' },
    { id: 'a', from: '07:00', title: 'Doppelt' },
    { id: '', from: '06:00', title: 'x' }, { id: 'c', from: '6:00', title: 'x' }, { id: 'd', from: '24:00', title: 'x' },
    { id: 'e', from: '06:00' }, 'x', null,
  ];
  assert.deepEqual(cleanSteps(raw, EVENING), [
    { id: 'a', from: '06:00', to: '06:05', title: 'A', link: 'water' },
    { id: 'b', from: '06:10', title: 'B' },
  ]);
  for (const bad of [undefined, 'x', {}, [], [{ id: 1 }]]) assert.equal(cleanSteps(bad, EVENING), EVENING);
});

test('cleanPack keeps valid groups and items', () => {
  assert.deepEqual(cleanPack([{ cat: 'Tasche', items: [{ id: 'a', name: 'A' }, { id: '', name: 'x' }, 'x'] }, { cat: 5, items: [] }], PACK),
    [{ cat: 'Tasche', items: [{ id: 'a', name: 'A' }] }]);
  for (const bad of [null, 'x', [], [{ cat: 'T' }]]) assert.equal(cleanPack(bad, PACK), PACK);
});

test('routineFor and activeStep use edited lists', () => {
  const morgen = [{ id: 'x', from: '05:30', to: '05:45', title: 'Früh' }], abend = [{ id: 'y', from: '22:00', title: 'Spät' }];
  assert.deepEqual(routineFor('morgen', SAT, morgen).map(s => [s.from, s.until]), [['06:30', '06:45']]);
  assert.equal(activeStep(THU, '05:40', { morgen, abend }).step.title, 'Früh');
  assert.deepEqual(activeStep(THU, '05:00', { morgen, abend }).upcoming, { kind: 'morgen', day: THU, from: '05:30' });
  assert.equal(activeStep(FRI, '23:00', { morgen, abend }).step.title, 'Spät');
  // Review Focus 3: same start time, both stay; the holder shows the one that lasts
  const twin = cleanSteps([{ id: 'p', from: '06:00', title: 'P' }, { id: 'q', from: '06:00', to: '06:10', title: 'Q' }], EVENING);
  assert.deepEqual(twin.map(s => s.id), ['p', 'q']);
  assert.equal(activeStep(THU, '06:00', { morgen: twin, abend }).step.id, 'q');
  // Review Focus 4: Fr +1 h pushes 23:30 past midnight, nothing throws
  const late = { morgen, abend: [{ id: 'z', from: '23:30', title: 'Sehr spät' }] };
  assert.equal(routineFor('abend', FRI, late.abend)[0].from, '00:30');
  assert.doesNotThrow(() => activeStep(FRI, '00:10', late));
  assert.doesNotThrow(() => activeStep(FRI, '23:59', late));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/routines-logic.test.js`
Expected: FAIL. `cleanSteps` und `cleanPack` sind nicht exportiert (SyntaxError beim Import).

- [ ] **Step 3: Implement `cleanSteps`, `cleanPack` and the list parameters in `js/areas/routines/logic.js`**

`routineFor` nimmt `base` statt der festen Konstante. `activeStep` reicht `lists[kind]` an jeden `routineFor`-Aufruf weiter (auch für den nächsten Tag).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add js/areas/routines/logic.js tests/routines-logic.test.js
git commit -m "feat: routine lists can come from storage (cleanSteps, cleanPack)"
```

### Task 2: Gespeicherte Listen überall lesen (index.js, view.js)

**Files:**
- Modify: `js/areas/routines/index.js`, `js/areas/routines/view.js`
- Test: `tests/routines-area.test.js`

**Interfaces:**
- Consumes: `cleanSteps`, `cleanPack`, `routineFor(kind, day, base)`, `activeStep(day, hhmm, lists)` aus Task 1.
- Produces:
  - `export const steps = ctx => ({ morgen, abend })`, aus `ki.rout.steps` über `cleanSteps` mit `MORNING`/`EVENING` als Standard. Ein Nicht-Objekt zählt als leer.
  - `export const packList = ctx => cleanPack(ctx.store.get('rout.pack'), PACK)`
  - Jeder `routineFor`-Aufruf in `index.js` übergibt `steps(ctx)[kind]`. `activeStep` bekommt `steps(ctx)`.
  - Das View-Model bekommt `packList`. `view.js` importiert `PACK` nicht mehr, sondern nutzt `v.packList`.

- [ ] **Step 1: Write the failing tests** in `tests/routines-area.test.js`:

```js
test('edited lists drive today, summary and holder', () => {
  const ctx = mk(at(6, 7));
  ctx.store.set('rout.steps', { morgen: [
    { id: 'wecker', from: '06:00', title: 'Aufstehen' },
    { id: 'grandpa', from: '06:05', to: '06:10', title: 'Grandpa draußen', link: 'grandpa' },
  ] });
  ctx.store.set('rout.pack', [{ cat: 'Tasche', items: [{ id: 'buch', name: 'Buch' }] }]);
  const html = rout.render(TODAY, ctx);
  assert.match(html, /Aufstehen/);
  assert.match(html, /Packliste 0\/1/);
  assert.deepEqual(rout.summary(ctx).morgen, { done: 0, total: 2 });
  assert.deepEqual(rout.summary(ctx).abend, { done: 0, total: 7 });
  assert.match(rout.render(HOLD, ctx), /Grandpa draußen/);
  rout.onClick(click({ a: 'all', k: 'morgen' }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).morgen, { done: 2, total: 2 });
});

test('malformed stored lists fall back to Notion', () => {
  for (const bad of ['x', [], { morgen: [] }, { morgen: [{ id: 1 }], abend: 'x' }]) {
    const ctx = mk();
    ctx.store.set('rout.steps', bad);
    ctx.store.set('rout.pack', bad);
    assert.doesNotThrow(() => rout.render(TODAY, ctx));
    assert.doesNotThrow(() => rout.render(HOLD, ctx));
    assert.deepEqual(rout.summary(ctx), { morgen: { done: 0, total: 10 }, abend: { done: 0, total: 7 } });
    assert.match(rout.render(TODAY, ctx), /Packliste 0\/15/);
  }
});

test('a deleted mobility step is no longer set by everything done', () => {
  const ctx = mk();
  ctx.store.set('rout.steps', { abend: EVENING.filter(s => s.id !== 'mobility') });
  rout.onClick(click({ a: 'all', k: 'abend' }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).abend, { done: 6, total: 6 });
  assert.equal(ctx.store.get('rec.mobility'), null);
});
```

`EVENING` wird in den Test importiert, aus `../js/areas/routines/data.js`. `HOLD` ist im Test schon definiert; die neuen Tests kommen ans Ende der Datei. `store.get` liefert für fehlende Schlüssel `null`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/routines-area.test.js`
Expected: FAIL. „Aufstehen“ fehlt, `total` ist 10, und die Packliste zeigt 0/15.

- [ ] **Step 3: Implement `steps(ctx)` and `packList(ctx)`, and pass them through `index.js` and `view.js`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add js/areas/routines/index.js js/areas/routines/view.js tests/routines-area.test.js
git commit -m "feat: routines read edited step and pack lists"
```

### Task 3: Bearbeiten-Modus, Zurücksetzen, CSS, Cache v5

**Files:**
- Modify:
  - `js/areas/routines/index.js`, `js/areas/routines/view.js`
  - `styles.css`, `sw.js`
- Test: `tests/routines-area.test.js`, `tests/backup.test.js`

**Interfaces:**
- Consumes: `steps(ctx)` und `packList(ctx)` aus Task 2.
- Bildschirm-Zustand in `index.js`: `editing` (`null` | `'morgen'` | `'abend'`) und `confirm` (bool). `onNavigate` setzt beide zurück.
- `onClick`:
  - `redit` (`data-k`) schaltet `editing` für diese Routine um.
  - `radd` (`data-k`) hängt `{ id: 'r' + uid(), from: <to oder from des letzten Schritts>, title: 'Neuer Schritt' }` an.
  - `rdel` (`data-k`, `data-id`) löscht, solange die Routine danach noch mindestens einen Schritt hat.
  - `rreset` arbeitet mit zwei Tipps. Der erste setzt nur `confirm`, der zweite setzt `rout.steps` und `rout.pack` auf `null` und beendet den Modus.
  - `padd` (`data-cat`) hängt `{ id: 'p' + uid(), name: 'Neuer Gegenstand' }` an die Gruppe an.
  - `pdel` (`data-cat`, `data-id`) entfernt den Gegenstand.
- `onInput` (ohne Neuzeichnen): `rt` (`data-k`, `data-id`) setzt `title`, `pn` (`data-cat`, `data-id`) setzt `name`.
- `onChange`: `rfrom` und `rto` (`data-k`, `data-id`) setzen die Zeit und zeichnen neu.
  - Ein `from` mit falschem Format wird ignoriert.
  - Ein leeres `to` entfernt `to`; ein ungültiges oder nicht späteres `to` wird ignoriert.
- Geschrieben wird immer die ganze Liste: `rout.steps = { ...steps(ctx), [kind]: neu }` und `rout.pack = neue Gruppen`. Danach liest `cleanSteps` beim nächsten Lesen sortiert.
- Markup im Bearbeiten-Modus (Reihenfolge der Attribute wie hier, die Tests prüfen sie):
  - `<input type="time" … data-a="rfrom" data-k="morgen" data-id="toilette" value="06:10" …>`, dasselbe mit `rto`
  - `<input class="tx" data-a="rt" data-k="morgen" data-id="toilette" value="Toilette" …>`
  - `<button … data-a="rdel" data-k="morgen" data-id="toilette" …>×</button>`. Dieser Knopf fehlt, wenn die Routine nur einen Schritt hat.
  - Für die Packliste, nur im Bearbeiten-Modus der Morgenroutine:
    - `<input class="tx" data-a="pn" data-cat="Essentials" data-id="handy" value="Handy" …>`
    - `<button … data-a="pdel" data-cat="Essentials" data-id="handy" …>×</button>`
    - `<button class="add" … data-a="padd" data-cat="Essentials">+ Gegenstand</button>`
  - Darunter „+ Schritt“ (`data-a="radd" data-k`), „Fertig mit Bearbeiten“ (`data-a="redit" data-k`, Klasse `pri`) und „Auf Notion-Stand zurücksetzen“ bzw. „Sicher? Nochmal tippen“ (`data-a="rreset"`, Klasse `red`). „Alles erledigt“ ist im Modus ausgeblendet.
  - Hinweis unter dem Titel: morgens „Zeiten für Mo–Fr · Sa/So automatisch +1 h“, abends „Zeiten für So–Do · Fr/Sa automatisch +1 h“.
  - Verknüpfte Schritte zeigen eine kurze Notiz, womit sie verknüpft sind.
- Außerhalb des Modus steht neben „Alles erledigt“ ein „Bearbeiten“ (`data-a="redit" data-k`).

- [ ] **Step 1: Write the failing tests** in `tests/routines-area.test.js`:

```js
const edit = (ctx, k = 'morgen') => rout.onClick(click({ a: 'redit', k }), TODAY, ctx);
const base = (ctx, k = 'morgen') => rout.steps(ctx)[k];

test('edit mode shows base times, titles and the tools', () => {
  const ctx = mk(at(8, 0, 28)); // Samstag: Anzeige 07:10, bearbeitet wird die Grundzeit
  assert.match(rout.render(TODAY, ctx), /data-a="redit" data-k="morgen"/);
  edit(ctx);
  const html = rout.render(TODAY, ctx);
  assert.match(html, /data-a="rfrom" data-k="morgen" data-id="toilette" value="06:10"/);
  assert.match(html, /data-a="rto" data-k="morgen" data-id="toilette" value="06:20"/);
  assert.match(html, /data-a="rt" data-k="morgen" data-id="toilette" value="Toilette"/);
  assert.match(html, /data-a="pn" data-cat="Essentials" data-id="handy" value="Handy"/);
  assert.match(html, /\+ Schritt/);
  assert.match(html, /Fertig mit Bearbeiten/);
  assert.match(html, /Auf Notion-Stand zurücksetzen/);
  assert.match(html, /Sa\/So automatisch \+1 h/);
  assert.doesNotMatch(html, /data-a="rt" data-k="abend"/);
  rout.onNavigate({ area: 'food', view: 'today' }, ctx);
  assert.doesNotMatch(rout.render(TODAY, ctx), /data-a="rt"/);
});

test('renaming a step keeps its tick and its link', () => {
  const ctx = mk();
  step(ctx, 'morgen', 'toilette');
  edit(ctx);
  rout.onInput(change({ a: 'rt', k: 'morgen', id: 'toilette' }, { value: 'Klo' }), TODAY, ctx);
  rout.onInput(change({ a: 'rt', k: 'abend', id: 'mobility' }, { value: 'Dehnen' }), TODAY, ctx);
  assert.equal(base(ctx).find(s => s.id === 'toilette').title, 'Klo');
  assert.deepEqual(rout.summary(ctx).morgen, { done: 1, total: 10 });
  step(ctx, 'abend', 'mobility');
  assert.deepEqual(ctx.store.get('rec.mobility')['2026-11-26'], { done: true });
});

test('changing a time re-sorts and still shifts on weekends', () => {
  const ctx = mk();
  let now = at(6, 7);
  ctx.now = () => now;
  edit(ctx);
  rout.onChange(change({ a: 'rfrom', k: 'morgen', id: 'toilette' }, { value: '05:50' }), TODAY, ctx);
  assert.equal(base(ctx)[0].id, 'toilette');
  rout.onChange(change({ a: 'rto', k: 'morgen', id: 'toilette' }, { value: '05:40' }), TODAY, ctx);
  assert.equal(base(ctx)[0].to, '06:20');
  rout.onChange(change({ a: 'rto', k: 'morgen', id: 'toilette' }, { value: '' }), TODAY, ctx);
  assert.equal('to' in base(ctx)[0], false);
  rout.onChange(change({ a: 'rfrom', k: 'morgen', id: 'toilette' }, { value: 'quatsch' }), TODAY, ctx);
  assert.equal(base(ctx)[0].from, '05:50');
  now = at(8, 0, 28);
  edit(ctx);
  assert.match(rout.render(TODAY, ctx), /ab 06:50/);
});
```

**Hinweis zu `rto`:** „05:40“ liegt vor „05:50“ und wird ignoriert, also bleibt das alte `to` („06:20“).

```js
test('adding and deleting steps', () => {
  const ctx = mk();
  edit(ctx);
  rout.onClick(click({ a: 'radd', k: 'morgen' }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).morgen, { done: 0, total: 11 });
  const added = base(ctx).find(s => s.title === 'Neuer Schritt');
  assert.equal(added.from, '07:00');
  rout.onClick(click({ a: 'rdel', k: 'morgen', id: added.id }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx).morgen, { done: 0, total: 10 });
  ctx.store.set('rout.steps', { morgen: [{ id: 'x', from: '06:00', title: 'Nur einer' }] });
  rout.onClick(click({ a: 'rdel', k: 'morgen', id: 'x' }), TODAY, ctx);
  assert.equal(base(ctx).length, 1);
  assert.doesNotMatch(rout.render(TODAY, ctx), /data-a="rdel" data-k="morgen"/);
});

test('pack items can be renamed, removed and added', () => {
  const ctx = mk();
  edit(ctx);
  rout.onInput(change({ a: 'pn', cat: 'Essentials', id: 'handy' }, { value: 'iPhone' }), TODAY, ctx);
  rout.onClick(click({ a: 'pdel', cat: 'Essentials', id: 'airpods' }), TODAY, ctx);
  rout.onClick(click({ a: 'padd', cat: 'Tasche' }), TODAY, ctx);
  edit(ctx);
  const html = rout.render(TODAY, ctx);
  assert.match(html, /iPhone/);
  assert.match(html, /Neuer Gegenstand/);
  assert.match(html, /Packliste 0\/15/);
  assert.doesNotMatch(html, /data-id="airpods"/);
});

test('reset restores Notion after two taps', () => {
  const ctx = mk();
  edit(ctx);
  rout.onClick(click({ a: 'radd', k: 'abend' }), TODAY, ctx);
  rout.onClick(click({ a: 'pdel', cat: 'Essentials', id: 'handy' }), TODAY, ctx);
  rout.onClick(click({ a: 'rreset' }), TODAY, ctx);
  assert.match(rout.render(TODAY, ctx), /Sicher\? Nochmal tippen/);
  assert.equal(rout.summary(ctx).abend.total, 8);
  rout.onClick(click({ a: 'rreset' }), TODAY, ctx);
  assert.deepEqual(rout.summary(ctx), { morgen: { done: 0, total: 10 }, abend: { done: 0, total: 7 } });
  assert.match(rout.render(TODAY, ctx), /Packliste 0\/15/);
  assert.doesNotMatch(rout.render(TODAY, ctx), /data-a="rt"/);
});
```

In `tests/backup.test.js`, im Stil der Datei:

```js
test('edited routine lists travel as a whole', () => {
  const lists = { morgen: [{ id: 'x', from: '06:00', title: 'Nur einer' }] }, pack = [{ cat: 'Tasche', items: [] }];
  const a = fresh();
  a.set('rout.steps', lists);
  a.set('rout.pack', pack);
  const b = fresh();
  importBackup(buildBackup(a, '2026-11-26T10:00:00Z'), b);
  assert.deepEqual(b.get('rout.steps'), lists);
  assert.deepEqual(b.get('rout.pack'), pack);
  importBackup({ app: 'ki-apps', v: 1, data: { 'rout.days': {} } }, b);
  assert.deepEqual(b.get('rout.steps'), lists);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL in den neuen Routinen-Tests. Es fehlen `redit`, `rt`, `rfrom` usw.; `rout.onInput` ist nicht definiert. Der Backup-Test kann schon grün sein, weil `backup.js` unbekannte Schlüssel als Ganzes übernimmt. Er sichert dieses Verhalten nur ab, und das wird im Ledger vermerkt.

- [ ] **Step 3: Implement edit mode in `index.js` and `view.js`**

Das Muster ist der Supplement-Editor in `js/areas/food/index.js` (`editList`, `twice`, `onInput`).

- [ ] **Step 4: Add CSS for the edit rows in `styles.css`, and set `CACHE = 'ki-apps-v5'` in `sw.js`**

Zwei Zeitfelder, ein Strich und × in einer Zeile, darunter das Titelfeld. Die Zeile passt bei 375 px.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, alle Tests grün.

- [ ] **Step 6: Check in the browser preview at 375×812**

Bearbeiten-Modus morgens und abends öffnen. Die Klicks gehen per `el.click()` ohne Fokus, wie ein Tipp auf dem iPhone.
- Eine Zeit ändern, dann das Feld verlassen: Die Liste ist neu sortiert.
- Einen Titel tippen: Die Tastatur bzw. das Feld bleibt erhalten.
- „+ Schritt“, × und die Packliste bedienen.
- Zurücksetzen mit zwei Tipps.

Expected: `document.documentElement.scrollWidth` ist 375, keine Konsolenfehler, die Halterung zeigt einen geänderten Titel. Danach die Testdaten im Vorschau-Browser zurücksetzen.

- [ ] **Step 7: Commit**

```bash
git add js/areas/routines/index.js js/areas/routines/view.js styles.css sw.js tests/routines-area.test.js tests/backup.test.js
git commit -m "feat: edit routine steps and the pack list (cache v5)"
```

- [ ] **Step 8: Final review, then push (freigegeben mit diesem Plan)**

Nach dem Abschluss-Review und dem Fix-Pass: `git push origin main` ausführen. Dann prüfen, bis `https://julians4.github.io/ki-apps/sw.js` `ki-apps-v5` enthält. Live kurz prüfen: Routinen öffnen, Bearbeiten-Modus öffnen, keine Konsolenfehler.
