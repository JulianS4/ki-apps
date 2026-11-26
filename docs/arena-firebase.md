# Arena einrichten: Firebase (einmalig, ca. 10 Minuten)

Die Arena ist der einzige Teil von KI-Apps, der online läuft. Sie nutzt Firebase im kostenlosen Spark-Tarif: keine Kreditkarte, kein Pausieren. Online liegen nur Spielernamen, Aufgaben, Ja/Nein, Werte und Punkte, nichts aus den anderen Bereichen.

Die Konfiguration, die du am Ende bekommst, kommt **nicht** ins Repo. Du fügst sie nur in der App ein.

## 1 Projekt anlegen

1. <https://console.firebase.google.com> mit deinem Google-Konto öffnen.
2. **Projekt hinzufügen**, Name z. B. `ki-apps-arena`. **Google Analytics: aus.** Projekt erstellen.

## 2 Web-App registrieren

1. In der Projektübersicht auf das Web-Symbol **`</>`** tippen.
2. Spitzname `KI-Apps`. Firebase Hosting **nicht** anhaken. **App registrieren**.
3. Firebase zeigt ein Code-Stück mit `const firebaseConfig = { apiKey: …, authDomain: …, projectId: …, appId: … };`.
   - Dieses Objekt brauchst du in Schritt 6.
   - Du findest es später wieder unter **Projekteinstellungen (Zahnrad) → Allgemein → Meine Apps → SDK-Einrichtung und -Konfiguration → Konfiguration**.

## 3 Firestore anlegen

1. **Erstellen → Firestore Database → Datenbank erstellen**.
2. Standort **eur3 (Europa)**, dann **im Produktionsmodus starten**.

## 4 Anonyme Anmeldung einschalten

1. **Erstellen → Authentication → Jetzt starten**.
2. Reiter **Anmeldemethode → Anonym → Aktivieren → Speichern**.
3. Reiter **Einstellungen → Autorisierte Domains**: `julians4.github.io` hinzufügen (falls nicht schon da).

## 5 Sicherheitsregeln einfügen

1. **Firestore Database → Regeln**.
2. Den gesamten Inhalt von [`firestore.rules`](../firestore.rules) einfügen (das Vorhandene ersetzen) und **Veröffentlichen**.

## 6 In der App

1. KI-Apps öffnen, am besten auf dem iPhone als Home-Bildschirm-App. Dann **Einstellungen → Arena einrichten**.
2. Das ganze `firebaseConfig`-Stück aus Schritt 2 einfügen (mit oder ohne `const firebaseConfig =`) und **Arena anlegen** tippen.
3. Die App erzeugt die Arena, du bist „Julian“.
   - Unter **Link für mich** holst du den Zugang auf ein anderes eigenes Gerät.
   - Unter **Einladung für Uygar** liegt Uygars Link. Schick ihn erst, wenn die Prüfliste unten stimmt, und **nur an Uygar**: Wer den Link hat, spielt als Uygar.
4. Öffnet Uygar den Link in Safari, aber KI-Apps läuft bei ihm als Home-Bildschirm-App: Link kopieren, App öffnen, **Einstellungen → Einladung einfügen**. Safari und die Home-Bildschirm-App haben getrennten Speicher.

## 7 Prüfliste im Regel-Playground

**Firestore Database → Regeln → Playground**. „Authentifiziert“ anhaken und die UID eintragen; die UIDs stehen unter **Authentication → Benutzer**.

Vorab nachsehen:
- `CODE` ist der Dokumentname unter `arenas` im Reiter **Daten**.
- `JULIAN_UID` steht im Namen des Dokuments `claims/julian_<UID>`.
- Als `FREMDE_UID` irgendeine erfundene UID nehmen, z. B. `abc123`.

| # | Vorgang | Pfad | Angemeldet als | Erwartet |
|---|---|---|---|---|
| 1 | get | `arenas/CODE` | FREMDE_UID | erlaubt (nur Startdatum) |
| 2 | list | `arenas` | FREMDE_UID | **abgelehnt** |
| 3 | get | `arenas/CODE/keys/julian` | JULIAN_UID | **abgelehnt** |
| 4 | get | `arenas/CODE/days/julian_2026-11-26` | FREMDE_UID | **abgelehnt** |
| 5 | create | `arenas/CODE/claims/uygar_FREMDE_UID`, Daten `{ "player": "uygar", "uid": "FREMDE_UID", "key": "falsch-falsch-falsch-falsch-falsch-1" }` | FREMDE_UID | **abgelehnt** |
| 6 | create | `arenas/CODE/days/uygar_2026-11-26`, Daten `{ "player": "uygar", "date": "2026-11-26", "values": {}, "points": {}, "total": 0 }` | JULIAN_UID | **abgelehnt** |
| 7 | create | `arenas/CODE/days/julian_2026-11-26`, gleiche Daten mit `"player": "julian"` | JULIAN_UID | erlaubt |
| 8 | get | `arenas/CODE/days/julian_2026-11-26` | JULIAN_UID | erlaubt |

Weicht eine Zeile ab: nichts an Uygar schicken und Bescheid geben.
