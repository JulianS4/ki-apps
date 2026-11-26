# KI-Apps · Stufe 4b · Körper – Design

Stand 26.11.2026. Vertieft `2026-11-25-ki-apps-design.md` §6.5, §7, §8 und §11 (Stufe 4). Wo dieses Dokument nichts sagt, gilt die Haupt-Spec.

## 1 Worum es geht

Julian will sehen, wie er seinen Körperzielen näherkommt: 190 cm, 90 kg, Körperfett 12–13 % (Notion „Lebensziele · Körper“). Dazu gibt es einen Bereich **Körper** mit drei Teilen:

- Messwerte mit Verläufen
- Fotos mit Vorher/Nachher-Vergleich
- der Quartals-Check aus der Notion-Seite „Kalender Routine · Quartal · Körper“

Wie überall gilt: Alles wird von Hand eingetragen und bleibt auf dem Gerät.

## 2 Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Werte eintragen, für jedes Datum und jeden Wert einzeln:
  - Gewicht
  - Körperfett %
  - Maße: Brust, Taille, Hüfte, Oberarm, Oberschenkel, Wade
  - 5-km-Zeit, Dead-Hang-Zeit
  - Mobility-Check als Notiz
- Verläufe als Kurven im Stil des Trainings-Fortschritts. Gewicht hat eine Ziellinie bei 90 kg, Körperfett ein Zielband bei 12–13 %.
- Fotos vorne, seitlich und hinten pro Termin, auf ca. 1080 px verkleinert, im Bildspeicher des Geräts (IndexedDB).
- Vorher/Nachher-Vergleich: dieselbe Pose von zwei Terminen nebeneinander. **(Julian)**
- Quartals-Check mit acht Punkten, fällig zum Quartalsbeginn, angezeigt auf „Heute“.
- Die Heute-Kachel zeigt das letzte Gewicht und den Abstand zu 90 kg.
- Backup wahlweise mit Fotos.

**Nicht-Ziele**
- Ziele bearbeiten: 90 kg und 12–13 % sind in v1 fest.
- BMI oder andere berechnete Werte.
- Ziele für Maße, 5 km und Dead-Hang (Notion nennt keine).
- Fotos überlagern, ausrichten oder zuschneiden.
- Werte aus Apple Health oder von einer Waage übernehmen.

**Anti-Ziele**
- Ein Foto verlässt das Gerät, außer Julian speichert ausdrücklich ein Backup mit Fotos.
- Das normale Backup wird durch Fotos unbemerkt groß.
- Ein Foto geht beim Speichern verloren, ohne dass Julian es merkt.
- Kaputte gespeicherte Daten lassen den Bereich abstürzen.
- Das Proteinziel in Ernährung rechnet nach diesem Umbau anders als vorher.

## 3 Rahmen

- Zielgerät: iPhone, Safari bzw. Home-Bildschirm-App, 375 px breit, Tippziele ≥ 44 px.
- Technik wie bisher: Vanilla-JS-ES-Module ohne Build, localStorage mit Präfix `ki.`, Bereichsvertrag (`render`, `header`, `mount`, `onClick`/`onChange`/`onInput`, `onNavigate`, `summary`), `node --test`.
- IndexedDB gibt es in Node nicht. Deshalb steckt der Fotospeicher hinter einer kleinen Schnittstelle, die Tests durch eine Attrappe ersetzen.
- Gewicht liegt schon in `ki.body.weight` (Datum → kg, 30–250). Ernährung schreibt dort und berechnet daraus das Proteinziel (`latestWeight`). Das bleibt so.
- Das Beschwerden-Log liegt in Recovery (`ki.rec.complaints`, angezeigt unter `#recovery`).

## 4 Ansätze

- **A · Werte im normalen Speicher, Fotos in IndexedDB, eigene Kurve im Trainings-Look (gewählt):**
  - Körper bekommt ein eigenes Kurven-Modul. Es nutzt dieselben CSS-Klassen und die Tipp-Anzeige (`bindChart`) des Trainings.
  - Das Training bleibt unberührt.
  - Kosten: etwa 40 Zeilen, die dem Trainings-Chart ähneln.
- **B · Erst das Trainings-Chart in den Kern verallgemeinern, dann nutzen es beide:** Das ist auf Dauer sauberer, greift aber in den Fortschritt des Trainings ein, das Julian täglich nutzt.
- **C · Fotos als Text im normalen Speicher:** Am wenigsten Code, aber localStorage fasst nur rund 5 MB und wäre nach wenigen Quartalen voll. Verworfen.

Ansatz A ist die Wahl des Designers, weil er das Training nicht anfasst und für die Fotos keine Speichergrenze erreicht.

## 5 Entscheidungen

### 5.1 Daten

- `ki.body.weight` bleibt: Datum → kg. Körper schreibt in denselben Schlüssel.
- `ki.body.log`: Datum → `{ fat?, brust?, taille?, huefte?, arm?, bein?, wade?, run5k?, hang?, mob? }`. Jeder Wert ist freiwillig. Gültige Bereiche:
  - `fat`: 3–60 %
  - Maße in cm mit einer Nachkommastelle, 10–250
  - `run5k`: Sekunden, Eingabe als mm:ss, 10:00–60:00
  - `hang`: Sekunden, Eingabe als Sekunden oder m:ss, 1–600
  - `mob`: Text
  - Ungültiges wird beim Lesen ignoriert.
- `ki.body.quarter`: Quartal (`2026-Q4`) → `{ plan?: true, pain?: true }`. Das sind die von Hand gesetzten Häkchen.
- `ki.body.photos`: Datum → `{ vorne?: true, seitlich?: true, hinten?: true }`. Dieser Index wird synchron gelesen, damit die Seite sofort zeichnen kann.
- Die Bilder selbst liegen in IndexedDB unter `Datum:Pose` als JPEG-Blob.
- Im Backup werden `body.log`, `body.quarter` und `body.photos` pro Datum bzw. Quartal zusammengeführt, wie `body.weight` (in `PER_KEY` aufnehmen).
- Das Formular „Messung eintragen“ speichert für ein Datum. Ein leer gelassenes Feld löscht den Wert dieses Datums, die anderen Werte bleiben. *(Designer)*
  - Das gilt auch fürs Gewicht. Das Proteinziel folgt danach dem neuesten verbliebenen Gewicht, so wie es heute schon rechnet. Die Rechnung selbst ändert sich nicht.
- Liegt ein Feld außerhalb seines Bereichs, speichert das Formular nichts. Es nennt das Feld und den erlaubten Bereich, z. B. „Gewicht: 30–250 kg“. Halbe Speicherungen gibt es nicht. *(Designer)*
- Ein Messtag ist jedes Datum, das in `body.weight` oder `body.log` vorkommt. Löscht man einen Messtag, verschwinden Gewicht und Werte dieses Datums aus beiden Schlüsseln. *(Designer)*

### 5.2 Ansichten

Reiter **Übersicht · Verlauf · Fotos**, Routen `#koerper`, `#koerper/verlauf`, `#koerper/fotos`. Erreichbar wie die anderen Bereiche über die Kachel auf „Heute“; oben „‹ Heute“ und die Reiter (Bereichsvertrag `header`). Die Messung hat eine eigene Ansicht `#koerper/messung` (mit `?Datum` für einen bestehenden Tag).

- **Übersicht:**
  - Quartals-Check, solange nicht alles erledigt ist; danach als „erledigt“ eingeklappt.
  - Letztes Gewicht mit Abstand zu 90 kg.
  - Letzte Werte von Körperfett, 5 km und Dead-Hang.
  - Knopf „Messung eintragen“.
- **Messung eintragen:**
  - Ein Formular mit Datum (Standard heute, änderbar, nicht in der Zukunft).
  - Felder: Gewicht, Körperfett, sechs Maße, 5 km, Dead-Hang, Mobility-Notiz.
  - Für ein Datum mit schon vorhandenen Werten ist das Formular vorausgefüllt.
- **Verlauf:**
  - Eine Kurve pro Wert, nur für Werte mit mindestens zwei Einträgen. Ein einzelner Eintrag erscheint als Zahl.
  - Gewicht mit Ziellinie 90 kg, Körperfett mit Zielband 12–13 %.
  - Die 5-km-Achse zeigt mm:ss; ein niedrigerer Wert ist besser, die Kurve wird trotzdem nicht umgedreht.
  - Darunter die Liste der Messtage. Ein Tipp öffnet das Formular dieses Tages, Löschen geht mit zwei Tipps.
- **Fotos:**
  - „Neue Fotos“: Datum (Standard heute), drei Felder vorne, seitlich und hinten. Jedes öffnet die Kamera oder die Mediathek (`<input type="file" accept="image/*">`).
  - Ein Bild wird auf 1080 px an der langen Seite verkleinert und als JPEG gespeichert. Erst wenn das Speichern gelungen ist, wird der Index gesetzt.
  - Schlägt das Speichern fehl, zeigt die Seite eine Meldung; nichts geht still verloren.
  - **Vergleich:**
    - Zwei Auswahlfelder für Termine; Standard ist der älteste neben dem neuesten.
    - Darüber ein Umschalter für die Pose.
    - Die Bilder stehen nebeneinander, jedes mit Datum.
    - Fehlt eine Pose an einem Termin, erscheint ein Platzhalter.
    - Mit nur einem Termin wird dieser allein gezeigt, mit dem Hinweis, dass der Vergleich ab zwei Terminen kommt.
  - Darunter die Liste der Termine. Ein Termin lässt sich mit zwei Tipps löschen (Index und Bilder).
  - Fehlt ein Bild im Speicher, obwohl der Index es kennt (z. B. nach einem Backup ohne Fotos auf einem neuen Gerät), erscheint „Foto nicht auf diesem Gerät“.

### 5.3 Quartals-Check

- Quartale: Jan–Mär, Apr–Jun, Jul–Sep, Okt–Dez. Der Check ist ab dem ersten Tag des Quartals fällig.
- Die acht Punkte, mit Wortlaut aus Notion:
  1. Gewicht messen
  2. Körperfotos machen
  3. Körpermaße aktualisieren
  4. Mobility-Check
  5. 5-km-Zeit überprüfen
  6. Trainingsplan kritisch überprüfen
  7. Verletzungen/Schmerzen dokumentieren
  8. Dead-Hang-Check
- **Automatisch erledigt** ist ein Punkt, sobald ein passender Eintrag existiert, dessen **Datum** im laufenden Quartal liegt (nachgetragene Werte zählen also für ihr Quartal):
  - Gewicht in `body.weight`
  - mindestens ein Foto
  - mindestens ein Maß
  - `mob`
  - `run5k`
  - `hang`
- **Von Hand** werden „Trainingsplan kritisch überprüfen“ und „Verletzungen/Schmerzen dokumentieren“ abgehakt (`body.quarter`). Der zweite Punkt hat einen Link zum Beschwerden-Log in Recovery.
- Automatische Punkte kann man zusätzlich von Hand abhaken, z. B. wenn die 5 km gelaufen, aber nicht eingetragen sind. Ein Punkt zählt als erledigt, wenn er automatisch oder von Hand erledigt ist.
  - Alle acht Punkte haben deshalb einen Schlüssel in `body.quarter`: `weight`, `photos`, `measures`, `mob`, `run5k`, `plan`, `pain`, `hang`.
  - Ein Häkchen von Hand lässt sich wieder entfernen. Ein automatisch erledigter Punkt bleibt trotzdem erledigt. *(Designer)*
- **Heute** zeigt ab Quartalsbeginn eine Karte „Quartals-Check fällig · x/8“ mit Link zu `#koerper`, bis alle acht erledigt sind. Sie bleibt bewusst sichtbar, bis der Check durch ist; ein Wegklicken gibt es nicht. *(Designer)*

### 5.4 Verbindungen

- **Ernährung:** liest weiter `body.weight` für das Proteinziel. Das kleine Gewichtsformular in Ernährung bleibt.
- **Heute:**
  - Kachel „Körper“ mit letztem Gewicht und „noch x kg bis 90“, bzw. „Gewicht fehlt“.
  - Die Karte zum Quartals-Check (siehe 5.3).
  - „Kommt bald“ nennt nur noch Arena.
- **Recovery:** Link aus dem Quartals-Check zum Beschwerden-Log.

### 5.5 Backup

- Die Einstellungen bekommen beim Backup ein Häkchen **„mit Fotos“** (Standard aus) und einen Hinweis zur Dateigröße.
- **Ohne Fotos:** Das Backup enthält die Werte, aber nicht `body.photos`. Ein Gerät, das so ein Backup lädt, kennt also keine Foto-Termine ohne Bilder.
- **Mit Fotos:** Das Backup enthält zusätzlich `body.photos` und die Bilder als `data:`-URLs unter `photos`.
- Beim Laden werden Bilder in IndexedDB geschrieben und der Index pro Datum zusammengeführt. Erst nach erfolgreichem Schreiben eines Bildes kommt es in den Index.
- Ein altes Backup ohne diese Schlüssel lässt die Körper-Daten unverändert.
- Details *(Designer)*:
  - Das Speichern wird asynchron, weil die Bilder aus IndexedDB gelesen werden. `buildBackup` bekommt eine Option, die `body.photos` weglässt.
  - Ein Bild, das der Index kennt, IndexedDB aber nicht hat, wird beim Export übersprungen und auch aus dem exportierten Index genommen. Die Meldung nennt das: „Backup gespeichert · 12 Fotos (1 fehlte auf diesem Gerät)“.
  - Ein Bild, das sich beim Laden nicht schreiben lässt, bricht das Laden nicht ab. Werte und die übrigen Bilder bleiben, und die Meldung nennt die Zahl der fehlgeschlagenen Bilder.
  - Größe: Ein Foto mit 1080 px kostet als JPEG etwa 150–250 KB, im Backup etwa ein Drittel mehr. Bei drei Fotos pro Quartal sind das rund 1 MB im Jahr. Deshalb gibt es keine Aufteilung in mehrere Dateien. Der Hinweis neben dem Häkchen zeigt die tatsächliche Größe der gespeicherten Fotos (Summe der Blob-Größen).

Mit *(Designer)* markierte Punkte hat der Designer nach dem Builder-Check entschieden; Julian kann sie korrigieren.

## 6 Dem Builder überlassen

- Dateistruktur. Vorschlag: `js/areas/body/` mit `data.js`, `logic.js` (rein, getestet), `view.js`, `index.js`, `chart.js`, `photos.js` (IndexedDB hinter einer Schnittstelle).
- Name und Version der IndexedDB, Bildqualität (Vorschlag 0,85), ob `navigator.storage.persist()` angefragt wird.
- Achsenbeschriftung und Tipp-Texte der Kurven, Layout der Formulare und des Vergleichs bei 375 px.
- Die genaue Optik der Quartals-Karte auf Heute.
- Service-Worker-Cache: neue Dateien in die Liste, Version hochzählen.
