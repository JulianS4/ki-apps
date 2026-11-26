# Life OS – Redesign

Stand 26.11.2026 · Grundlage: Julians Auftrag „UI umfassend überarbeiten, Life OS“ · baut auf `2026-11-26-cockpit-design.md` auf

## Ziel

Aus KI-Apps und Cockpit wird eine ruhige, einheitliche App mit dem Namen **Life OS**. Jede Seite beantwortet auf den ersten Blick: Was ist wichtig, was kann ich als Nächstes tun? Funktionen und Datenflüsse bleiben erhalten. Keine Dummys, keine erfundenen Daten.

## Entscheidungen

- **Name:** überall „Life OS“ (Titel, Home-Bildschirm, Manifest, Texte). Technische Kennungen bleiben (`ki.`-Speicher, Backup-Format `ki-apps`, Exportformat `ki-cockpit`), damit alte Backups weiter laden.
- **Startseite = Übersicht** (`#uebersicht`, leerer Hash). Sie vereint die Tagespunkte der bisherigen „Heute“-Seite (Morgen-Check, Jetzt/als Nächstes, Backup, Quartals-Check) mit der Lebensübersicht.
- **Training & Erholung** ist die bisherige „Heute“-Seite (`#heute`) als Einstieg zu Training, Recovery, Ernährung, Routinen, Körper und Arena.
- **Navigation:** Übersicht · Finanzen · Ausbildung · Projekte · Business Log · KI-Agents · Wissen · Training & Erholung, dazu Einstellungen.
  - Desktop/Tablet ab 900 px: dunkle Seitenleiste.
  - Handy: untere Leiste mit Übersicht, Finanzen, Ausbildung, Training & Erholung und „Mehr“. „Mehr“ öffnet eine Liste mit allen Bereichen.
  - Die Leiste verschwindet, solange der Pausen-Timer läuft.
- **Eine Ebene weniger:**
  - Finanzen hat 4 statt 6 Reiter (Übersicht mit Konten, Buchungen, Ausgaben & Budget, Abos).
  - Business Log ist ein eigener Bereich.
  - Die beiden Einstellungsseiten werden zu einer.
- **Farben:** nur die Palette `#051F20 #0B2B26 #163832 #235347 #8EB69B #DAF1DE`, dazu Weiß als Kartenfläche.
  - Hell: Inhalte auf hellen Flächen, dunkle Grüntöne für Navigation, Text und Aktionen.
  - Dunkel: dieselbe Palette umgekehrt.
  - Ausnahmen, nur für Zustände: ein zurückhaltendes Fehlerrot mit ⚠-Symbol und die Ampelpunkte des Morgen-Checks. Bei beiden steht die Bedeutung zusätzlich als Text daneben.
- **Typografie:** Archivo in normaler Breite, Überschriften 700, ruhigere Größen.
- **Diagramme:** nur wo sie eine Frage beantworten.
  - Finanzen: Wie entwickeln sich Einnahmen, Ausgaben und Zurückgelegtes? Wie entwickelt sich das Vermögen?
  - Business Log: Welches Projekt bringt Umsatz oder Gewinn, wohin gehen die Stunden?
  - Bedienung:
    - Zeitraum Woche / Monat / Jahr / frei;
    - Tooltip bei Maus und Antippen;
    - Legende schaltet Reihen ein und aus;
    - Tabelle zum Aufklappen;
    - leere Zeiträume und importierte Daten werden gekennzeichnet.
  - Reihen unterscheiden sich durch Helligkeit (die Palette hat nur einen Farbton). Die hellste Reihe bekommt eine Kontur, Werte gibt es immer auch als Text.
- **Formulare:**
  - Buchungen über „Ausgabe hinzufügen“ / „Einnahme hinzufügen“ mit positivem Betrag statt Minuszeichen.
  - Alle Aktionen sind ausgeschrieben („Konto hinzufügen“ statt „＋“).
  - Fehler stehen am Feld.

## Nicht-Ziele

Keine neuen Datenquellen, keine Live-Anbindungen (Notion, Bank, Agents bleiben „nicht eingerichtet“), keine Änderungen an Rechenlogik oder Speicherformat.
