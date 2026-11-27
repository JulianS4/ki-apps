# Life OS: neue Bereiche, Neon-Look, Muskelfigur – Implementation Plan

> For agentic workers: executed inline (native) in the session that wrote it. Steps use checkbox syntax; the ledger is the checkbox state plus `git log` on branch `bereiche`.

**Goal:** Life OS in twelve areas (plus Arena, Import, Einstellungen), the black/neon look of the user's reference recording on every page with an accent-colour picker, and an own muscle figure that lights up what was trained this week.

**Architecture:** Vanilla ES modules, hash routes (`js/core/routes.js`), one module per area with `render/mount/onClick/onInput/onChange/onNavigate`. New areas live in `js/areas/cockpit/` (calendar.js, goals.js) or as views of existing areas (tasks in projects.js, investments in finance.js). The look is a final CSS layer driven by tokens; the accent is `html[data-accent]` stored under `ui.accent`.

**Tech Stack:** plain JS, node:test, GitHub Pages PWA (`sw.js`, bump cache).

**Spec:** the design approved in chat on 2026-11-27 ("Ja, so bauen"), summarised here:

| Bereich | Inhalt | Route |
|---|---|---|
| Übersicht | dashboard; now also tiles for Ernährung, Recovery, Gesundheit; food hints and deload week in "Jetzt wichtig" | `#uebersicht` (`#heute` lands here) |
| Aufgaben & Projekte | all open tasks (project, school, free) by due date; tabs Aufgaben · Projekte · Business Log | `#aufgaben`, `#projekte`, `#business-log` |
| Kalender & Routinen | week view: week routine, training day, exams, due tasks, subscription charges; Jetzt/Als Nächstes; tabs Kalender · Routinen | `#kalender`, `#routinen` |
| Ziele & Rückblicke | goal notes from vault folder "02 Ziele"; pillar check-ins over time; automatic week review | `#ziele` |
| Finanzen & Investments | as before + tab Investments (depot/tagesgeld accounts, savings plan, their history) | `#finanzen/investments` |
| Arbeit & Lernen | former Ausbildung | `#ausbildung` (`#arbeit`) |
| Ernährung, Training, Recovery | as before (Training gets the muscle figure) | unchanged |
| Gesundheit | former Körper + resting pulse history | `#koerper` (`#gesundheit`) |
| Wissen, KI-Agents | as before | unchanged |
| Arena, Import, Einstellungen | kept; accent picker in Einstellungen | unchanged |

## Global Constraints
- Repo is public: no real personal data in code, tests or docs; demo values only.
- Old addresses keep working (bookmarks, home-screen links).
- Uygar's arena-only mode stays (`arenaOnly`).
- Every figure names its source; nothing invented (no calories/heart-rate series the app does not record).
- German UI copy; data.js stays CRLF.
- Bump `sw.js` cache and list new files in `FILES`.

## Review Focus
1. Phone navigation: four bottom items + "Mehr" must reach every area; "Mehr" marks the open area.
2. Arena-only mode must still hide everything but Arena/Einstellungen.
3. Week view around month/year boundaries and Sundays (week starts Monday).
4. Accent picker survives reload and private mode (store may be memory-only).
5. Muscle figure with no training data, a rest day, and a deload week.

---

### Task 1: Navigation, routes, titles
**Files:** `js/areas/cockpit/nav.js`, `js/core/routes.js`, `js/app.js`, `js/areas/cockpit/school.js`, `js/areas/body/view.js`; tests `tests/lifeos-areas.test.js` (new), adapt `tests/lifeos-shell.test.js`, `tests/routes.test.js`.
- [x] Tests: NAV lists the 12 areas in groups (Planen · Geld & Arbeit · Körper · Kopf & KI) + Arena; end group Import, Einstellungen; phone bar Übersicht, Aufgaben, Kalender, Training + Mehr; `parseRoute('#heute')` → cockpit; `#aufgaben` → projects/tasks; `#kalender` → calendar; `#ziele` → goals; `#finanzen/investments` → finance/invest; `#arbeit` → school; `#gesundheit` → body; navKey marks the right item; titles "Arbeit & Lernen", "Gesundheit".
- [x] Implement; app.js header: health areas are top-level now (no "‹ Training & Erholung" back link).
- [x] Commit.

### Task 2: Aufgaben
**Files:** `schema.js` (new `task`: text, due, done, note), `projects.js` (view `tasks`, tabs), `logic.js` (`allTasks(ctx-free lists, t)`); tests in `tests/lifeos-areas.test.js`.
- [x] Tests: free + project + school tasks in one list grouped Überfällig/Heute/Diese Woche/Später/Ohne Datum; tick marks done; done ones collapsed; "Aufgabe hinzufügen" creates a free task; tabs on all three views.
- [x] Implement, commit.

### Task 3: Kalender
**Files:** `js/areas/cockpit/calendar.js` (new area `calendar`), `routines/index.js` header tabs; tests.
- [x] Tests: week Mon–Sun with routine blocks per day, training day name, exams, due tasks, subscription charges in that week; prev/next week; today marked; Jetzt/Als Nächstes; tabs Kalender · Routinen on both.
- [x] Implement, commit.

### Task 4: Ziele & Rückblicke
**Files:** `js/areas/cockpit/goals.js` (new area `goals`), tests.
- [x] Tests: goal cards from notes under `02 Ziele/` (title, first lines, link to note), empty state pointing to import; pillar history (one row per week, average); week review this vs last week: training sessions, Ø morning check, Ø protein, spent, work hours, notes changed – each with its source.
- [x] Implement, commit.

### Task 5: Investments tab, Gesundheit pulse
**Files:** `finance.js`, `body/index.js`/`view.js`; tests.
- [x] Tests: tab Investments lists depot+tagesgeld accounts with sum and history, the savings categories (kind `sparen`) with plan vs actual this month; body overview shows resting pulse of the last 30 days when present.
- [x] Implement, commit.

### Task 6: Übersicht absorbs Training & Erholung
**Files:** `home.js`, `heute.js` (render removed, summaries stay), `app.js`; port `tests/heute.test.js` to Übersicht tests.
- [x] Tests: tiles Ernährung (protein/water rings), Recovery (morning check, sleep h, mobility), Gesundheit (weight → goal); agenda gets snack/dinner/mealprep hints and the deload week; one broken area never blanks the overview.
- [x] Implement, commit.

### Task 7: Neon look + accent picker
**Files:** `styles.css` (final token layer), `js/core/theme.js` (new: ACCENTS, applyAccent), `settings.js` (picker), `app.js` (apply on boot), `brain.js`/`graph.js` (colours from CSS vars); tests.
- [x] Tests: ACCENTS has lime (default), rot, orange, türkis, lila, pink; picking stores `ui.accent` and sets `data-accent`; unknown value falls back to lime.
- [x] Implement, browser check desktop + phone, commit.

### Task 8: Muskelfigur
**Files:** `js/areas/training/muscles.js` (new: `weekLoad(plan, sess, monday)`, `muscleSvg(load, side)`), Training page top, Übersicht training tile; tests.
- [x] Tests: categories map to muscle groups; load = done sets / planned sets this week per group (0–1); rest day / no data → all dim; figure has front and back with labelled groups (aria); flip button.
- [x] Implement, browser check, commit.
