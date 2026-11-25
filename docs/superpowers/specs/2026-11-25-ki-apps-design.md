# KI-Apps · Design

Stand 25.11.2026 · Entwurf zur Freigabe

## 1 Worum es geht

Julian plant sein Leben in Notion: Trainingsplan, Ernährungsplan, Supplementplan, Recovery, Week Routine, Morgen- und Abendroutine, Kalender Routine (Quartals-Checks) und die Arena, einen täglichen Punktewettkampf mit seinem Freund Uygar. Notion ist der **Plan**. Was fehlt, ist ein schneller Ort, an dem er im Alltag auf dem iPhone **festhält, was er tatsächlich gemacht hat**, und an dem die Bereiche voneinander wissen.

Die bestehende App „Hybrid Training“ (julians4.github.io/hybrid-training) macht das bereits für das Training. KI-Apps erweitert das zu **einer** App mit mehreren Bereichen: Training, Recovery, Ernährung, Routinen, Körper, Arena und eine Startseite „Heute“.

„KI“ im Namen heißt: mit KI gebaut. Die App selbst enthält **keine KI-Funktionen**. Alles wird von Hand getrackt. KI kann später dazukommen.

**Erfolg heißt:** Julian öffnet die App mehrmals am Tag, und jeder Eintrag dauert nur Sekunden. Sie ersetzt das Notizbuch (Morgen-Check) und die Häkchen in Notion. Die Startseite sagt ihm auf einen Blick, was jetzt dran ist und wie er steht.

## 2 Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Eine installierbare Web-App (ein Icon), offline nutzbar, alle persönlichen Daten nur auf dem Gerät.
- Bereiche teilen Daten direkt: Morgen-Ampel → Training, Gewicht → Proteinziel, Deload-Woche → Training, App-Daten → Arena-Vorschläge.
- Arena läuft online zwischen Julian und Uygar, kostenlos.
- Bisherige Trainingsdaten ziehen verlustfrei um.
- Gleiches Look & Feel wie Hybrid Training.

**Nicht-Ziele (jetzt)**
- KI-Funktionen, Kalorien- oder Makro-Datenbank, Barcode-Scan.
- Apple Health oder Fitbit auslesen. Das bestehende Senden von Krafttrainings an Apple Health per Kurzbefehl bleibt.
- Sync mit Notion. Notion bleibt die Quelle für den Startstand, die App pflegt danach ihren eigenen Stand.
- Sync der persönlichen Daten über mehrere Geräte, Konten oder Login für persönliche Daten.
- Push-Benachrichtigungen (bräuchten einen Server).

**Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)**
- Eintragen dauert länger als Notizbuch oder Notion.
- Tägliche Nutzung braucht Login oder Netz (Ausnahme: Arena).
- Gesundheitsdaten verlassen das Gerät. Online geht nur, was in der Arena steht.
- Laufende Kosten.
- Bestehende Trainingshistorie geht verloren oder wird verfälscht.

## 3 Rahmenbedingungen

- **Hosting:** GitHub Pages, statisch, kein eigener Server. Neues Repo `ki-apps` → `julians4.github.io/ki-apps/`.
- **iPhone-Web-App:** Jede Web-App auf dem Home-Bildschirm hat ihren eigenen, isolierten Speicher. Darum ist alles **eine** App. Die neue App sieht die Daten der alten Hybrid-Training-App nicht, deshalb erfolgt der Umzug per Backup-Datei.
- **Speicher:** localStorage (~5 MB) für alle Einträge, IndexedDB für Körperfotos.
- **Arena-Datenbank:** Firebase (Firestore) im kostenlosen Spark-Tarif. Keine Kreditkarte, kein Pausieren bei Inaktivität. Julian legt das Firebase-Projekt mit seinem Google-Konto selbst an, der Builder liefert Anleitung und Sicherheitsregeln.
- **Sprache der App:** Deutsch, Begriffe wie bisher (Sätze, Wdh, Supersatz …).

## 4 Ansätze

| | Weg | Abwägung | Entscheidung |
|---|---|---|---|
| **A** | **Eine App mit allen Bereichen**, Daten lokal geteilt, nur Arena online | Ein Icon, aber offline, ohne Login, Datenaustausch sofort, am wenigsten zu bauen | **Gewählt von Julian** |
| B | Getrennte Apps mit eigenen Icons, Sync über Firebase | Eigene Icons und Backup in der Cloud, aber Login, Netzabhängigkeit, Gesundheitsdaten bei Google, etwa doppelter Aufwand | verworfen |
| C | Getrennte Apps, Daten per Link oder Kurzbefehl weiterreichen | Umständlich, fehleranfällig | früh verworfen |

## 5 Aufbau

**Startseite „Heute“** (Einstieg beim Öffnen):
- Datum und Zyklus-Status („Woche 6 · Peak · RIR 1“ bzw. „Deload-Woche“).
- **Morgen-Check:** Ist er noch nicht ausgefüllt, ist er die große erste Karte. Danach zeigt die Karte die Ampel mit Empfehlung.
- **Jetzt / Als Nächstes** laut Week Routine, z. B. „16:15 Lower A Training“.
- Eine Karte pro Bereich mit dem heutigen Stand, antippen öffnet den Bereich:
  - Training: heutige Einheit, Sätze x/y
  - Ernährung: Protein x/Ziel g, Wasser x/3,5 L, fällige Supplements
  - Recovery: Mobility A/B erledigt?
  - Routinen: Morgen x/y, Abend x/y
  - Körper: letztes Gewicht, „Quartals-Check in N Tagen“
  - Arena: heutige Punkte, Julian : Uygar
- Hinweis „Letztes Backup vor N Tagen“, sobald es länger als 14 Tage her ist.

**Week Routine** (Startstand für „Jetzt / Als Nächstes“, aus Notion):

| Tag | Ablauf |
|---|---|
| Mo, Di, Do | 6:00 Morgenroutine · 7:00 Fahrt · 7:15–16:00 Arbeit (+ Frühstück, Supps, Mittag) · 16:00 Heimfahrt · 16:15–17:45 Training (Mo Lower A, Di Upper A, Do Lower B) · 17:45–20:30 Deep Work + Abendessen & Supps · 20:30 Abendroutine · 21:30–6:00 Schlafen |
| Mi | wie Mo bis 16:15 · 16:15–17:00 Joggen · 17:00–20:30 Recovery + Abendessen, Mealprep & Supps · 20:30 Abendroutine · 21:30 Schlafen |
| Fr | wie Mo bis 16:15 · 16:15–17:45 Upper B · 17:45–21:30 Deep Work + Abendessen & Supps · 21:30 Abendroutine · 22:30–7:00 Schlafen |
| Sa | 7:00 Morgenroutine · 8:00–14:30 Deep Work + Frühstück & Supps · 14:30 Fahrt · 15:00–16:30 Athlete Day · 16:30–21:00 Recovery + Freizeit · 21:00 Heimfahrt · 21:30 Abendroutine · 22:30–7:00 Schlafen |
| So | 7:00 Morgenroutine · 8:00–9:30 Recovery + Frühstück & Supps · 9:30–11:30 Kirche · 12:00–14:00 Sonntag Routine · 14:00–20:00 Freizeit · 20:00 Mealprep & Supplement-Prep · 20:30 Abendroutine · 21:30–6:00 Schlafen |

Zeitzone ist Europe/Berlin. Der Quartals-Check wird am 1.1., 1.4., 1.7. und 1.10. fällig. Die Samstags-Mobility (20 min) nutzt Routine B und hält die letzte Übung 5 min länger.

**Bereiche** fühlen sich wie eigene Apps an: eigene Kopfzeile mit „‹ Heute“, darunter die Ansichten des Bereichs (wie heute „Woche · Verlauf · Mehr“ im Training).

**Einstellungen** (eigene Ansicht): Backup speichern/laden, Gewicht/Ziele, Apple-Health-Anleitung, Arena-Verbindung.

## 6 Die Bereiche

### 6.1 Training

Die bestehende Hybrid-Training-App wird mit **allem**, was sie heute kann, zum Bereich Training: Wochenplan, Supersätze, Pausentimer, Rekorde, Fortschritt pro Übung, Nachtragen mit Datumsauswahl, Plan bearbeiten, Apple Health per Kurzbefehl.

Änderungen:
- **Mobility** und **Sonntags-Wochen-Check** ziehen nach Recovery. Im Trainingstag ersetzt ein Verweis „Mobility Lower · 15 min → Recovery“ die bisherige Checkbox.
- **Ampel-Banner** oben im Trainingstag, wenn der Morgen-Check Gelb oder Rot ist, mit der Regel aus 6.2.
- **Zyklus** im Kopf: „Woche 3 · RIR 2 · Steigern“. In der Deload-Woche gibt es ein Banner mit den Deload-Regeln und keine Rekord-Meldungen („Keine PR-Versuche“).

### 6.2 Recovery

Quelle: Notion „Recovery“.

**Morgen-Check** (täglich): Schlaf, Energie, Muskeln & Gelenke, je 1–5. Dazu die Bettzeit, vorbelegt aus der Week Routine (Mo–Do und So 21:30–6:00, Fr–Sa 22:30–7:00) und nur bei Abweichung zu ändern, sowie optional der Ruhepuls. Die Summe ergibt die Ampel:

| Summe | Ampel | Empfehlung |
|---|---|---|
| 12–15 | Grün | Training wie geplant |
| 9–11 | Gelb | Gewichte halten, 1 Wdh mehr im Tank, pro Übung 1 Isolationssatz weniger |
| 3–8 | Rot | Halbe Sätze oder Pause. 2× Rot pro Woche → Deload vorziehen |

**Deload vorziehen?** Die App zeigt den Hinweis, sobald zwei dieser Punkte zutreffen. Automatisch erkannt werden 2× Rot in 7 Tagen, mindestens 3 Nächte mit Schlaf ≤ 2 in 7 Tagen und ein Ruhepuls, der an 3 Tagen ≥ 5 über dem 14-Tage-Schnitt liegt. Von Hand abhaken lassen sich: Leistung 2 Einheiten in Folge gesunken, Gelenk-/Sehnenschmerz > 3 Tage, Stimmung mehrere Tage im Keller.

**Mobility** (täglich 15 min, Sa 20 min): Upper an Di, Fr, So, Lower an Mo, Mi, Do, Sa. Geführter Timer: Er zeigt die aktuelle Übung groß, zählt bis zur nächsten herunter, piept beim Wechsel, und der Bildschirm bleibt an. Die Routinen kommen aus Notion:
- **A · Upper:**
  - 0:00 Cat-Cow · 8–10 langsame Wdh
  - 1:30 Thread the Needle · 45 s/Seite
  - 3:00 Wall Slides · 10–15 Wdh
  - 4:30 Doorway Chest Stretch · 45 s/Seite
  - 6:00 Lat Stretch · 45 s/Seite
  - 7:30 Cross-Body Shoulder Stretch · 45 s/Seite
  - 9:00 Upper Trap / Neck Stretch · 45 s/Seite
  - 10:30 Thoracic Extension · 8–10 Wdh
  - 12:30 Child's Pose mit Seit-Reach · 75 s/Seite
  - Ende 15:00
- **B · Lower:**
  - 0:00 Deep Squat Hold
  - 1:30 Couch Stretch · 45 s/Seite
  - 3:00 90/90 Hip Stretch · 45 s/Seite
  - 4:30 Seated Forward Fold
  - 6:00 Calf Stretch · 45 s/Seite
  - 7:30 Adductor Rockbacks · 10–15/Seite
  - 9:30 Pigeon Stretch · 60 s/Seite
  - 11:30 Ankle Dorsiflexion · 45 s/Seite
  - 13:00 Child's Pose → Deep Squat · je 1 min
  - Ende 15:00

**Atmung:**
- Box-Breathing-Timer mit 4 s ein, 4 s halten, 4 s aus, 4 s halten. Dauer wählbar, 2 min abends, 5 min samstags.
- Kurzanleitung für den Physiological Sigh.

**Recovery-Blöcke** als Checkliste an ihren Tagen:
- **Mi:** Joggen ohne Musik · Abendessen + Mealprep 60 min · Personal Time 60 min
- **Sa:** Mobility 20 min · warme Dusche/Sauna 15 min (optional) · Personal Time inkl. 5 min Box-Breathing 25 min
- **So:** Spaziergang ohne Kopfhörer 30 min · Mobility Upper 15 min · Wochen-Check 15 min · Frühstück in Ruhe, Kirche · Personal Time, kaum Bildschirm

**Wochen-Check** (So): Schlaf, Energie, Gelenke und Fortschritt zum Ziel je 1–5, dazu „Was lief gut?“ und „Ziel nächste Woche“. Das ist der heutige Wochen-Check aus dem Training, erweitert um zwei Textfelder.

**Deload-Zyklus:** 6 Wochen Aufbau, dann 1 Woche Deload. Anker ist der 19.10.2026, die Zyklen laufen danach endlos weiter. Die ersten Termine laut Notion:
- Deload 30.11.–06.12.2026
- Deload 18.–24.01.2027
- Deload 08.–14.03.2027
- Deload 26.04.–02.05.2027

Zielwerte pro Woche (RIR = Wiederholungen, die man noch im Tank hat):

| Woche | RIR Haupt | RIR Iso | Ziel |
|---|---|---|---|
| 1 | 3 | 2–3 | Technik, Gewichte aus Woche 4 |
| 2 | 2–3 | 2 | Steigern |
| 3 | 2 | 1–2 | Steigern |
| 4 | 1–2 | 1 | Steigern |
| 5 | 1–2 | 0–1 | Hart |
| 6 | 1 | 0–1 | Peak |
| 7 | 3–4 | 4 | Deload |

„Deload jetzt starten“ verschiebt den Zyklus: Ab der nächsten Woche beginnt ein neuer Aufbau. Die Deload-Regeln aus Notion werden in der Deload-Woche im Training und auf „Heute“ angezeigt:
- Sätze halbieren, ~90 % Gewicht von Woche 6, 3–4 RIR
- Sprints und Sprünge mit halbem Volumen, ~90 % Tempo
- Joggen locker, Athlete Day nur Technik + Mobility
- 30 min früher ins Bett, Kalorien und Protein nicht kürzen
- Keine PR-Versuche, keine neuen Übungen

**Beschwerden:** einfaches Log mit Körperstelle, Stärke 1–5, Datum und Notiz. Speist den Deload-Hinweis und den Quartals-Check in Körper.

### 6.3 Ernährung

Quelle: Notion „Ernährungsplan“, „Supplementplan“, „Einkaufsliste“. **Kein Kalorienzählen.**

**Protein:** Ziel ist 2 g × aktuelles Gewicht aus „Körper“. Ohne Gewicht fragt die App einmal danach. Eingetragen wird durch Antippen eines Gerichts aus dem Plan, jedes mit hinterlegtem Proteinwert. Die Werte sind Schätzungen des Builders und in der App änderbar. Dazu kommen eine freie Eingabe („+ 20 g“) und das nachträgliche Ändern eines Eintrags.

| Mahlzeit | Gerichte (Schätzung Protein) |
|---|---|
| Frühstück Mo–Fr | Joghurt Bowl (~45 g) · Overnight Oats (~45 g) · High Protein Wrap (~35 g) |
| Frühstück Sa–So | Rührei mit Hüttenkäse Toast (~40 g) · Lachs Salat (~45 g) |
| Mittag Mo–Fr | Aldi (frei, Vorschlag 30 g) |
| Mittag Sa–So | Ofen Platte (~55 g) · Quinoa Power Bowl (~30 g) |
| Abend Mo–Fr | Lachspfanne mit Süßkartoffeln (~35 g) · Hähnchen mit Linsen-Dahl (~50 g) · Bolognese (~45 g) |
| Abend Sa–So | Gegrilltes Steak mit Gemüse (~50 g) · Gebackener Kabeljau mit Quinoa (~45 g) |
| Snacks | Früchte/Beeren · Datteln · dunkle Schokolade > 80 % · Nüsse · Sonnenblumenkerne · geröstete Kichererbsen · Linsen-/Kichererbsenchips (je ~2–8 g) |
| Drinks | Tee · Matcha · Smoothie · Protein Shake (~25 g) |

Die App schlägt die Gerichte passend zu Tageszeit und Wochentag zuerst vor. Die Zutaten aus Notion stehen beim Antippen und Halten.

**Wasser:** Ziel 3,5 L, 4 L als volles Ziel. Ein Tipp sind +0,5 L (Flaschengröße einstellbar). Der Morgenroutine-Schritt „500 ml trinken“ zählt automatisch mit.

**Regeln:**
- **Letzte Mahlzeit 19:00.** Ein später eingetragenes Gericht wird markiert.
- **Tagesregel „sauber“:** keine Softdrinks, kein Fast Food, keine Süßigkeiten/Snacks, kein Alkohol, kein Kaffee, keine stark verarbeiteten Lebensmittel. Ein Tipp hakt „alles eingehalten“ ab. Wurde eine Regel gebrochen, wählt man welche. Dazu kommt eine Serie, wie viele Tage am Stück sauber waren.
- **Hinweise aus „Recovery · Trainingstag“** auf „Heute“:
  - Kohlenhydrat-Snack, wenn das Mittagessen > 3 h vor dem Training liegt
  - Abendessen an Trainingstagen mit 30–40 g Protein + Kohlenhydraten

**Supplements:**
- Morgens: Omega 3 EPA & DHA + Vitamin D3 K2 · Ingwer + Bio-Honig + 1 TL Schwarzkümmelöl · Kreatin + Protein. „Kreatin + Protein“ zählt einen Protein Shake (~25 g) mit.
- Mittags: Flohsamenschalen + Rote-Bete-Saft.
- Abends: Magnesium + Glycin + Zink · Sauerkirschsaft.

Die App zeigt die gerade fällige Gruppe zuerst.

**Einkaufsliste:** Die Kategorien und Artikel kommen aus Notion: Milchprodukte & Eier, Fleisch & Fisch, Obst, Snacks & Getränke, Gemüse, Kohlenhydrate & Hülsenfrüchte, Vorrat, Nüsse/Kerne & Samen, Gewürze & Kräuter. Man hakt ab, was fehlt, und es gibt „Liste zurücksetzen“. Erinnerung an Mealprep am Mi und So.

### 6.4 Routinen

Quelle: Notion „Morgen & Abend Routine“, „Week Routine“.

**Morgen** (Mo–Fr ab 6:00, Sa–So ab 7:00, also +1 h):

| Zeit | Schritt |
|---|---|
| 6:00 | Wecker, 5500K Licht |
| 6:00–6:05 | 500 ml trinken · Bett machen · Rollladen auf & Fenster zu |
| 6:05–6:10 | Anziehen → Chinese Grandpa Routine im Tageslicht |
| 6:10–6:20 | Toilette |
| 6:20–6:25 | Mundroutine |
| 6:25–6:35 | Duschroutine |
| 6:35–6:45 | Abtrocknen · Skincare · Haare |
| 6:45–6:55 | Deo · Anziehen · Parfum |
| 6:55–7:00 | Tasche & Essentials packen (Packliste) |
| 7:00 | Losfahren |

- **Chinese Grandpa Routine:** je 30 s mit Timer: Lymphatic Hops, Deep Squat, Arm Waves/Half Squat, Golf Swings, High Knee, Deep Breathing, Tapping auf Lymphknoten, Sitzen in Seiza.
- **Packliste Tasche:** Metallflasche, Glas-Frühstücksbehälter, Metall-Mittagessenbehälter, zuckerfreier Kaugummi, Mouthwash, Taschentücher, Deo, Laptop oder Tablet, Ladekabel.
- **Packliste Essentials:** Handy, AirPods, Fitbit, Mosolf-Chip, Schlüssel, Geldbeutel.

**Abend** (20:30, Fr–Sa 21:30):

| Zeit | Schritt |
|---|---|
| 20:30 | PC Shutdown |
| 20:30–20:45 | Duschroutine (an Trainingstagen) · Zahnroutine |
| 20:45–20:55 | Abtrocknen · Skincare · Fenster auf |
| 20:55–21:10 | Mobility (→ Recovery, Häkchen wird geteilt) |
| 21:10–21:28 | Lesen · Supplements (→ Ernährung, Abend-Supps werden geteilt) |
| 21:28–21:30 | Box-Breathing (→ Recovery-Timer) |
| 21:30 | Schlafen |

**Wichtig:** In Notion steht „Kein Handy in dieser Zeit, in der Handyhalterung lassen“. Daraus folgt zweierlei:
- Abhaken geht schnell im Nachhinein, entweder einzeln oder mit einem Tipp „Alles erledigt“.
- Optional gibt es einen **Halterungs-Modus**: großer Text mit dem Schritt, der laut Uhrzeit gerade dran ist, Bildschirm bleibt an, keine Bedienung nötig.

### 6.5 Körper

Quelle: Notion „Kalender Routine · Quartal · Körper“ und „Lebensziele · Körper“.

**Werte:**
- **Gewicht**, jederzeit. Das neueste Gewicht bestimmt das Proteinziel.
- Körperfett % (optional).
- **Maße:** Brust, Taille, Hüfte, Oberarm, Oberschenkel, Wade.
- **Fotos:** vorne, seitlich, hinten, gespeichert in IndexedDB. Die App verkleinert sie auf ca. 1080 px.
- 5-km-Zeit und Dead-Hang-Zeit.
- Mobility-Check als Notiz.

**Quartals-Check:** Eine Checkliste aus der Kalender Routine:
- Gewicht messen
- Körperfotos machen
- Körpermaße aktualisieren
- Mobility-Check
- 5-km-Zeit überprüfen
- Trainingsplan kritisch überprüfen
- Verletzungen/Schmerzen dokumentieren (→ Beschwerden-Log)
- Dead-Hang-Check

Fälligkeit zum Quartalsbeginn, Anzeige auf „Heute“.

**Ziele:** 190 cm · 90 kg · Körperfett 12–13 %. Dazu Verläufe als Kurven mit Ziellinie, im selben Chart-Stil wie der Fortschritt im Training.

### 6.6 Arena

Quelle: Notion „Arena“ (Julian/Uygar Daily Performance, Weekly Performance, Total).

**Aufgaben** (für beide gleich, Stand Notion):

| Aufgabe | Bedingung | Art |
|---|---|---|
| Health | 8 h Quality Sleep · Healthy Nutrition · 3 L Water | Ja/Nein |
| Income | How much money did you earn today? | Wert, Ziel 50 € |
| Skills | Did you learn a new skill today? | Ja/Nein |
| Training | Did you train hard today? | Ja/Nein |
| Work Hours | How many hours did you work today? | Wert, Ziel 10 h |

**Punkte:** Ja = 1 Punkt, Nein = 0. Wert-Aufgaben geben Wert ÷ Ziel, z. B. 4 h von 10 h = 0,4. Das deckt sich mit Julians Notion-Eintrag vom 25.11. (2,4 Punkte). **Keine Obergrenze:** 12 h Arbeit = 1,2 Punkte, 100 € = 2 Punkte. Uygars 1,4 bei Health in Notion war ein Tippfehler. Punkte werden auf eine Nachkommastelle angezeigt und intern ungerundet summiert.

**Ansichten:**
- Heute: eigene Aufgaben abhaken bzw. Wert eingeben, Punkte beider live.
- Woche: Mo–So pro Spieler, Wochensumme, wer führt.
- Verlauf: Wochen (KW) mit Sieger und Gesamtpunkte seit Start.

**Vorschläge aus der App** (nur für Julian, mit Bestätigung, nie automatisch):
- Health = Ja vorschlagen, wenn Schlaf ≥ 8 h (Morgen-Check), Ernährung „sauber“ und Wasser ≥ 3 L.
- Training = Ja vorschlagen, wenn heute eine Trainingseinheit eingetragen ist.

**Bearbeiten:**
- Einträge von heute und gestern sind änderbar, ältere gesperrt.
- Tagesgrenze ist Mitternacht in deutscher Zeit.
- Die Aufgabenliste ist gemeinsam: Beide können Aufgaben hinzufügen, ändern und archivieren. Archivierte Aufgaben zählen in alten Wochen weiter.

**Uygar:** Er öffnet dieselbe App über einen Einladungslink und wählt „Uygar“. Bei ihm startet die App direkt in der Arena. Die anderen Bereiche lassen sich in den Einstellungen einblenden, sind dann aber seine eigenen, leeren lokalen Daten.

**Start:** Die Arena beginnt frisch am Tag der Freischaltung. Werte aus Notion können für die laufende Woche von Hand nachgetragen werden.

## 7 Verbindungen zwischen den Bereichen

| Von | Nach | Was |
|---|---|---|
| Recovery · Morgen-Check | Training, Heute | Ampel-Banner mit Empfehlung |
| Recovery · Deload-Zyklus | Training, Heute | Woche, RIR-Ziel, Deload-Regeln, keine Rekord-Meldungen im Deload |
| Recovery · Mobility | Routinen · Abend, Heute | ein gemeinsames Häkchen pro Tag |
| Körper · Gewicht | Ernährung | Proteinziel 2 g/kg |
| Routinen · Morgen „500 ml“ | Ernährung · Wasser | +0,5 L |
| Routinen · Abend „Supplements“ | Ernährung · Supps | gemeinsames Häkchen Abend-Gruppe |
| Training, Ernährung, Recovery | Arena | Vorschläge für Health und Training |
| Week Routine (Startstand) | Heute | Jetzt / Als Nächstes |

## 8 Daten, Backup, Umzug

- **Ablage:** pro Bereich eigene localStorage-Schlüssel mit Präfix `ki.`, z. B. `ki.train.plan`, `ki.train.sess`, `ki.rec.morning`, `ki.food.days`. So gibt es keine Kollision mit der alten App, die im Safari-Browser auf derselben Domain liegt. Fotos liegen in IndexedDB.
- **Einträge** werden wie heute pro Datum (`YYYY-MM-DD`, lokale Zeit) abgelegt.
- **Startstand:** Pläne, Gerichte, Routinen, Supplements, Einkaufsliste, Mobility, Week Routine und Arena-Aufgaben stehen als Startdaten im Code. Bearbeitbar in v1 sind die Listen: Gerichte inkl. Protein, Supplements, Einkaufsliste, Routinen-Schritte, Arena-Aufgaben, dazu wie bisher der Trainingsplan. Mobility-Routinen, Week Routine und Deload-Regeln bleiben in v1 fest. Pro Bereich gibt es „Auf Notion-Stand zurücksetzen“.
- **Backup:** eine JSON-Datei für alle Bereiche. Fotos landen nur auf Wunsch darin, weil die Datei sonst groß wird. „Backup laden“ führt zusammen, statt zu überschreiben.
- **Umzug aus Hybrid Training:**
  - Das Backup-Format der alten App (`app: 'hybrid-training'`) wird beim Laden erkannt.
  - Trainingsplan und Einheiten werden übernommen.
  - Die Sonntags-Wochen-Checks (`s.week` am Tag `so`) und die Mobility-Häkchen (`s.mob`) wandern nach Recovery.
  - Die alte App bekommt oben ein Banner „Umgezogen nach KI-Apps“ mit „Backup speichern“ und Link. Sie bleibt online, bis Julian umgezogen ist.

## 9 Arena online

- **Firebase:** Firestore und Anonymous Auth, Spark-Tarif (kostenlos). Das SDK wird nur beim Öffnen der Arena nachgeladen, damit der Rest der App leicht und offline bleibt.
- **Zugang:** Eine Arena ist ein Dokumentpfad mit einem langen zufälligen Code (`arenas/{code}/…`).
  - Die Sicherheitsregeln erlauben Lesen und Schreiben nur in einem bekannten Code und kein Auflisten aller Arenen. Wer den Einladungslink hat, ist drin, also teilt Julian ihn nur mit Uygar.
  - Jeder Spieler schreibt nur seine eigenen Tagesdokumente.
- **Offline:** Einträge werden lokal gepuffert und gesendet, sobald Netz da ist (Firestore-Offline-Cache). Ohne Netz zeigt die Arena den letzten bekannten Stand.
- **Was online liegt:** Spielernamen, Aufgaben, Ja/Nein, Werte (Stunden, €) und Punkte pro Tag. Nichts aus Training, Ernährung, Recovery, Routinen oder Körper.

## 10 Entscheidungen

**Von Julian entschieden**
- Eine App mit Bereichen (Ansatz A).
- Nur manuelles Tracking, keine KI-Funktionen.
- Mobility und Wochen-Check gehören zu Recovery.
- Arena kommt dazu, über eine kostenlose Online-Datenbank.
- Inhalte kommen aus Notion.
- Arena-Punkte: Ja = 1, Wert-Aufgaben = Wert ÷ Ziel ohne Obergrenze.

**Vom Designer gesetzt (bitte prüfen)**
- Neues Repo und URL `julians4.github.io/ki-apps/`, die alte App bleibt bis zum Umzug.
- Bereiche Routinen, Körper und Startseite „Heute“ als Vorschlag aus Notion abgeleitet.
- Firebase statt Supabase, weil es nicht pausiert.
- Proteinwerte der Gerichte als Schätzung, änderbar.
- „Kreatin + Protein“ zählt als Shake mit ~25 g Protein.
- Arena-Vorschläge nur mit Bestätigung. Gemeinsame Aufgabenliste. Heute und gestern sind änderbar.
- Uygar startet in der Arena, andere Bereiche ausgeblendet.
- Körpermaße: Brust, Taille, Hüfte, Oberarm, Oberschenkel, Wade.
- In v1 fest: Mobility-Routinen, Week Routine, Deload-Regeln.
- Keine automatische Satzreduktion bei Gelb, Rot oder Deload, nur Banner.

**Dem Builder überlassen**
- Dateistruktur. Vorschlag: ES-Module ohne Build-Schritt, je Bereich eine Datei, Startdaten getrennt vom Code.
- Navigation im Detail, Farben pro Bereich, Animationen.
- Service-Worker-Strategie für mehrere Dateien.
- Wake-Lock-Umsetzung, Timer-Töne.
- Wie Diagramme und Verlauf je Bereich aussehen, im Stil des Trainings-Fortschritts.

## 11 Ausbaustufen

Jede Stufe geht live und ist für sich nutzbar.

1. **Grundgerüst + Heute + Training + Umzug.** Alte Daten laufen in der neuen App, das Training ist vollständig.
2. **Recovery:** Morgen-Check, Ampel im Training, Mobility-Timer, Atmung, Deload-Zyklus, Wochen-Check, Beschwerden.
3. **Ernährung:** Protein, Wasser, Regeln, Supplements, Einkaufsliste.
4. **Routinen + Körper**, inklusive Verbindungen.
5. **Arena:** Firebase-Einrichtung gemeinsam mit Julian, Einladung an Uygar.
