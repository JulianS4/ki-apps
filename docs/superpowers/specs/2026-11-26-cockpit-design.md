# Cockpit – Umsetzungsübersicht und Datenmodell

Stand 26.11.2026 · Grundlage: Julians Auftrag „persönliche All-in-One-Web-App“ (Dashboard, Finanzen, Abos, Ausbildung, Projekte + Business Log, KI-Agents, Wissen, Integrationen) · Ergänzung zu `2026-11-25-ki-apps-design.md`

## Warum

Julian will Business, Ausbildung und Finanzen an einem Ort sehen und Daten veranschaulicht bekommen, neben Training und Erholung, die KI-Apps schon abdeckt. Das Cockpit ist sein Überblick und Second Brain: wenige, priorisierte Zahlen, jede mit Quelle und Stand.

## Entscheidung: in KI-Apps statt eigener App

Das Cockpit wird ein Teil von KI-Apps (gleiche PWA, gleicher Code-Aufbau, ein Backup).

- **Gleicher Ursprung:** Training und Recovery stehen schon im Gerätespeicher von KI-Apps. Das Cockpit liest sie direkt, ohne Kopie.
- **Ein Icon, ein Backup:** keine zweite App, die man pflegen und sichern muss.
- **Gleiche Regeln:** Vanilla JS ohne Build, Tests mit `node --test`, Daten nur auf dem Gerät.

Verworfen: eine eigene App mit Server und Login (Next.js o. ä.). Sie wäre nötig für echte Live-Synchronisation, bringt aber Konto, Hosting und Geheimnisverwaltung, bevor überhaupt Daten da sind. Der Server kommt erst, wenn Notion oder eine Bank wirklich angebunden wird (siehe Integrationen).

## Ziele (erste Version)

- Gemeinsame Navigation: Cockpit · Finanzen · Ausbildung · Projekte · KI-Agents · Wissen · Training & Erholung · Einstellungen.
- Cockpit-Startseite mit Gesamtvermögen, Konten mit Stand, nächsten drei Klassenarbeiten, aktueller Abteilung, aktiven Projekten, fälligen Aufgaben, Monatszahlen (Einnahmen, Ausgaben, Stunden), Training/Erholung und Agent-Status. Jede Zahl nennt Quelle und Stand.
- Finanzen: Konten, Gesamtvermögen mit Verlauf, Buchungen mit Filtern (Konto, Kategorie, Zeitraum), Kosten nach Kategorie, Budget gegen Ist, Abos mit Monats- und Jahressumme, CSV-Import.
- Ausbildung: aktuelle Abteilung, Abteilungswechsel, Klassenarbeiten (Fach, Datum, Uhrzeit, Ort, Vorbereitung, Note), die nächsten drei hervorgehoben, Aufgaben und Lernnotizen pro Fach.
- Projekte: Reselling, Personal Brand und Sensito als aktive Projekte; Status, nächstes Ziel, Fortschritt, Aufgaben, Notizen, Links, Zahlen aus dem Business Log.
- Business Log: Datum, Projekt, Beschreibung, Dauer, Einnahmen, Ausgaben; Auswertung pro Projekt und Zeitraum (Umsatz, Kosten, Gewinn, Stunden).
- KI-Agents: manuell gepflegte Liste, ehrlich als „nicht verbunden“ markiert.
- Wissen: Notizen mit Titel, Inhalt, Tags, Bereich, Datum, Verknüpfungen (`[[Titel]]` und Projekte), Rückverweise, schnelle Suche, Export als Markdown (Obsidian-tauglich).
- Einstellungen & Integrationen: Status von Notion, Bank, Agents mit letztem Import; Beispielmodus; Export und Löschen.

## Nicht-Ziele (diese Version)

- Keine Live-Anbindung an Notion, Bank oder Agents. Es gibt Importwege und eine klare Schnittstelle.
- Keine Fremdwährungs-Umrechnung: Gesamtvermögen summiert Euro-Konten und nennt ausgelassene.
- Keine Kalender-Synchronisation der Klassenarbeiten.

## Anti-Ziele

- Erfundene oder geschätzte persönliche Zahlen, oder Beispiele, die wie echte aussehen.
- Eine Integration, die verbunden wirkt, obwohl sie es nicht ist.
- Bank-Zugangsdaten, Notion-Token oder Schlüssel im Code oder im Browser.
- Finanzwerte gut sichtbar auf der Startseite, wenn jemand aufs Handy schaut.
- Echte Daten im öffentlichen Repo.

## Datenschutz und Sicherheit

- Alles liegt im Gerätespeicher (`localStorage`, Schlüssel `ki.cx.*`), ohne Konto und ohne Cloud. Das App-Backup enthält es.
- Beträge im Cockpit sind verdeckt (`•••• €`), bis man „Beträge zeigen“ tippt (nur bis zum Neuladen). In den Finanzen selbst stehen sie offen.
- Beispieldaten leben in einem eigenen Bereich (`ki.demo.cx.*`). Echte Einträge werden im Beispielmodus weder gezeigt noch verändert. Beenden löscht nur die Beispiele. Ein Banner auf jeder Seite sagt „Beispieldaten“.
- Export (JSON, Notizen als Markdown-ZIP) und „Cockpit-Daten löschen“ (zweiter Tipp zur Bestätigung).

## Datenmodell

Beträge sind ganze Cent (`int`), Tage `YYYY-MM-DD`, Uhrzeiten `HH:MM`. Jeder Eintrag hat eine `id`. `src` nennt die Quelle: `manuell`, `csv`, `import`, `beispiel`.

| Schlüssel | Inhalt |
|---|---|
| `cx.accounts` | `{id, name, type: giro/tagesgeld/depot/bar/sonstiges, cur, bal, asOf, src, hist:[{d, c}]}`. Jede Saldo-Änderung legt einen Punkt in `hist` ab → Vermögensverlauf. |
| `cx.tx` | `{id, d, amt, payee, cat, acc, note, src}`. `amt` < 0 = Abfluss. Die Kategorie entscheidet die Art: Ausgabe, Einnahme oder Zurückgelegt (Sparen/Übertrag zählt nicht als Ausgabe). |
| `cx.cats` | `{id, name, kind: ausgabe/einnahme/sparen}`. Vorgaben: Wohnen, Essen, Mobilität, Abos, Freizeit, Bildung, Gesundheit, Business, Sonstiges · Gehalt, Business-Einnahmen, Sonstige Einnahmen · Sparen & Investieren. |
| `cx.budgets` | `{catId: Cent pro Monat}` |
| `cx.subs` | `{id, name, amt, cur, every: woche/monat/quartal/halbjahr/jahr, next, pay, cat, status: aktiv/pausiert/gekuendigt, src}`. Nächster Termin wird ab `next` im Intervall weitergerechnet. Summen nur aus aktiven Euro-Abos. |
| `cx.school` | `{depts:[{id, name, from, to}], exams:[{id, subj, d, time, place, prep: offen/begonnen/fast/fertig, grade}], tasks:[{id, subj, text, due, done}]}` |
| `cx.projects` | `{id, name, status: aktiv/pausiert/idee/abgeschlossen, goal, prog 0–100, notes, links:[{label, url}], tasks:[{id, text, due, done}], upd}`. Ohne gespeicherte Liste gelten die drei aktiven Projekte. |
| `cx.log` | `{id, d, proj, text, min, inc, exp}` |
| `cx.agents` | `{id, name, job, status: unbekannt/bereit/beschaeftigt/fehlgeschlagen/pausiert, last, next, result, issues, cost, asOf}`. Verbindung immer „nicht verbunden · manuell“. |
| `cx.notes` | `{id, title, body, tags:[], topic: business/ki/ausbildung/finanzen/training/privat, projects:[ids], created, upd}`. `[[Titel]]` im Text verknüpft Notizen; Lernnotizen eines Fachs tragen das Fach als Tag. |
| `cx.imports` | `[{kind: csv/json, file, at, n}]` → „zuletzt importiert“ in Einstellungen und an den Daten |

Gelesen wird alles über Aufräum-Funktionen: kaputte Einträge fallen weg, statt die Seite abstürzen zu lassen.

## Integrationen

**Notion.** Die offizielle API geht über eine Integration mit Token. Sie sieht nur Seiten, die man ihr in Notion ausdrücklich freigibt. Der Token darf nicht in die öffentliche App, und Notion erlaubt keine Browser-Aufrufe (CORS). Deshalb braucht eine Live-Anbindung einen kleinen eigenen Server (z. B. Cloudflare Worker mit dem Token als Secret, nur Lesen, Zugang per Gerätecode). Diese Version: Status „nicht eingerichtet“ und der Importweg `ki-cockpit`-JSON (dasselbe Format, das der Worker später liefert). Synchronisiert würden: Konten und Nettovermögen (→ Finanzen), Business Log (→ Projekte), Ausbildung (→ Ausbildung).

**Bank.** Nur über einen regulierten PSD2-Kontoinformationsdienst, nur lesend, mit Freigabe direkt bei der Bank, widerrufbar und zeitlich begrenzt. Abgerufen würden Kontoname, Saldo und Umsätze (Datum, Betrag, Empfänger, Verwendungszweck). Anbieter wie Enable Banking oder GoCardless brauchen ebenfalls einen Server für ihre Schlüssel. Ob und zu welchen Bedingungen Privatpersonen dort Zugang bekommen, ist zu prüfen, wenn die Einrichtung ansteht. Kein FinTS mit gespeicherter PIN, kein Auslesen von Bankseiten. Diese Version: manuelle Eingabe und CSV-Import (Spalten werden erkannt und bestätigt, Duplikate übersprungen, Hinweis „möglicherweise nicht aktuell“).

**KI-Agents.** Keine Schnittstelle vorhanden → manuelle Pflege, Status mit „Stand“ und „nicht verbunden“.

## Seiten und Routen

`#cockpit` · `#finanzen` (`/konten`, `/buchungen`, `/kosten`, `/budget`, `/abos`) · `#ausbildung` (`/fach?…`) · `#projekte` (`/p-<id>`, `/log`) · `#agents` · `#wissen` (`/n-<id>`, `/neu`) · `#integrationen`. „Training & Erholung“ führt zu `#heute`. Heute bekommt einen Cockpit-Link und eine Kachel mit der nächsten Klassenarbeit (ohne Beträge).

Auf dem Handy eine waagrecht scrollbare Navigationsleiste, auf dem Desktop dieselbe Leiste mit breiterem Inhalt (bis 1120 px, Karten in mehreren Spalten).

## Dem Bauenden überlassen

Gestaltung im Stil von KI-Apps (Archivo, Karten, ruhige Flächen). Ein gemeinsamer Formular- und Listenbaustein für alle Bereiche. Verläufe mit dem vorhandenen Linien-Diagramm, Kosten und Budget als beschriftete Balken.
