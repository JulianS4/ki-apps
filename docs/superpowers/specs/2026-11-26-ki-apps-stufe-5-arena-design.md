# KI-Apps · Stufe 5 · Arena – Design

Stand 26.11.2026. Vertieft `2026-11-25-ki-apps-design.md` §6.6, §9 und §11. Wo dieses Dokument nichts sagt, gilt die Haupt-Spec.

## 1 Worum es geht

Die Arena ist der tägliche Punktewettkampf zwischen Julian und seinem Freund Uygar, bisher in Notion („Arena“: Daily Performance, Weekly Performance, Total).

- Jeder trägt für sich ein, was er heute geschafft hat.
- Beide sehen die Punkte des anderen live.
- Pro Woche gibt es einen Sieger.

Das ist der einzige Teil von KI-Apps, der online läuft. Alles andere bleibt auf dem Gerät.

## 2 Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Ansicht **Heute**: eigene Aufgaben abhaken (Ja/Nein) bzw. Wert eingeben, Punkte beider live.
- Ansicht **Woche**: Mo–So pro Spieler, Wochensumme, wer führt.
- Ansicht **Verlauf**: Kalenderwochen mit Sieger und Gesamtpunkte seit Start.
- Aufgaben (Startstand aus Notion, für beide gleich):

  | Aufgabe | Art | Ziel |
  |---|---|---|
  | Health | Ja/Nein | – |
  | Income | Wert | 50 € |
  | Skills | Ja/Nein | – |
  | Training | Ja/Nein | – |
  | Work Hours | Wert | 10 h |

- Punkte: Ja = 1, Nein = 0, Wert ÷ Ziel ohne Obergrenze. Angezeigt mit einer Nachkommastelle, intern ungerundet summiert.
- Die Aufgabenliste ist gemeinsam: Beide können Aufgaben hinzufügen, ändern und archivieren. Archivierte zählen in alten Wochen weiter. „Auf Notion-Stand zurücksetzen“ stellt die fünf Startaufgaben wieder her.
- Vorschläge nur für Julian, nur mit Bestätigung:
  - Health = Ja, wenn alle drei gelten: Schlaf ≥ 8 h laut Morgen-Check, Ernährung „sauber“, Wasser ≥ 3 L.
    - Schlaf zählt als Zeit im Bett aus dem heute gespeicherten Morgen-Check: `hoursInBed(bed, wake)` aus `rec.morning[heute]`.
    - Ohne Morgen-Check heute gibt es keinen Health-Vorschlag.
    - Die 1–5-Bewertung `schlaf` spielt dafür keine Rolle. *(Designer)*
  - Training = Ja, wenn heute eine Trainingseinheit eingetragen ist: mindestens ein erledigter Satz in der heutigen Einheit (`train.sess`), wie die Heute-Kachel zählt. *(Designer)*
- Auf Heute eine Kachel „Arena · Julian 2,4 : 1,8 Uygar“.
- Uygar nutzt dieselbe App über einen Einladungslink und landet direkt in der Arena.

**Nicht-Ziele**
- Mehr als zwei Spieler, mehrere Arenen pro Gerät, Chat, Benachrichtigungen.
- Konten mit E-Mail oder Passwort.
- Sync anderer Bereiche.

**Anti-Ziele**
- Irgendetwas aus Training, Ernährung, Recovery, Routinen oder Körper geht online. Die Vorschläge rechnen lokal; online geht nur das bestätigte Ja.
- Die Firebase-Konfiguration oder der Arena-Code steht im öffentlichen Repo. **(Julian: Zugang über den Link)**
- Ein Spieler kann die Tage des anderen schreiben.
- Ohne Netz geht ein Eintrag verloren.
- Der Rest der App wird langsamer oder braucht Netz, weil die Arena dazukommt.

## 3 Rahmen

- Firebase im kostenlosen Spark-Tarif: Firestore und anonyme Anmeldung.
  - Julian legt das Projekt mit seinem Google-Konto selbst an.
  - Der Builder liefert eine Schritt-für-Schritt-Anleitung und die Sicherheitsregeln (`firestore.rules` im Repo, zum Einfügen in der Konsole).
- Das Repo ist öffentlich (GitHub Pages). Deshalb steht keine Firebase-Konfiguration und kein Arena-Code im Code.
- Bestehende Technik: Vanilla-JS-ES-Module ohne Build, localStorage mit Präfix `ki.`, Bereichsvertrag, `node --test`, Service-Worker „network first“.
- Das Firebase-SDK lädt erst beim Öffnen der Arena, mit fester Version von `https://www.gstatic.com/firebasejs/<Version>/…` (Module).
- Tagesgrenze ist Mitternacht in deutscher Zeit (`Europe/Berlin`), unabhängig von der Zeitzone des Geräts.
- Sicherheitsregeln lassen sich ohne Installation nicht automatisch testen (der Emulator braucht Java und firebase-tools). Geprüft wird im Regel-Playground der Firebase-Konsole anhand einer Prüfliste, die der Builder mitliefert.

## 4 Ansätze

- **A · Firebase-SDK, beim Öffnen der Arena geladen, mit Offline-Puffer und Live-Updates (gewählt):** So steht es in der Spec. Firestore puffert Einträge ohne Netz und schickt sie später. Die Punkte des anderen kommen live.
- **B · Firestore-Webschnittstelle ohne SDK:** kleiner und ohne fremdes Skript, aber ohne Live-Punkte. Den Offline-Puffer müsste die App selbst bauen. Verworfen.
- **Zugang (Julian):**
  - **Im Code:** einfacher, aber jeder kennt das Projekt. Verworfen.
  - **Über den Link (gewählt):** Julian fügt die Konfiguration einmal ein. Der Einladungslink trägt Konfiguration, Arena-Code und Uygars Schlüssel.

## 5 Entscheidungen

### 5.1 Einrichtung und Zugang

1. **Julian, einmalig** (am iPhone in der App oder an einem Rechner im Browser; vom Rechner kommt der Zugang über „Link für mich“ oder ein Backup aufs iPhone):
   - Er legt das Firebase-Projekt nach der Anleitung an: Web-App, Firestore, anonyme Anmeldung, Regeln einfügen.
   - Dann öffnet er in den Einstellungen „Arena einrichten“, fügt die Konfiguration ein (das `firebaseConfig`-Objekt aus der Konsole) und tippt „Arena anlegen“.
   - Die App erzeugt einen langen Zufallscode (≥ 128 Bit) und je einen Spieler-Schlüssel für Julian und Uygar. Sie legt die Arena mit den fünf Startaufgaben an; Julian ist „Julian“.
2. **Einladung:**
   - Die App zeigt den Link für Uygar mit „Teilen“ (iPhone-Teilen-Menü) und „Kopieren“.
   - Der Link ist `…/ki-apps/#arena/einladung?<Daten>`; die Daten (Konfiguration, Code, Spieler `uygar`, Schlüssel) stehen base64url-kodiert hinter dem `#`. Was hinter dem `#` steht, bekommt der Server nicht zu sehen.
3. **Uygar:**
   - Er öffnet den Link. Die App speichert den Zugang, zeigt „Du bist Uygar“ und entfernt die Daten erst danach aus der Adresse (`history.replaceState` auf `#arena`).
   - **iPhone-Eigenheit:** Safari und die installierte Home-Bildschirm-App haben getrennten Speicher.
     - Ein Link aus WhatsApp oder Nachrichten öffnet in Safari, und das App-Icon startet ohne den Link-Inhalt (`start_url: "./"`).
     - Deshalb gibt es in den Einstellungen und auf der leeren Arena-Seite „Einladung einfügen“: ein Feld, in das man den ganzen Link (oder nur den Teil hinter `#`) einfügt.
     - Öffnet sich der Link in Safari, während die App nicht als Home-Bildschirm-App läuft (`navigator.standalone` bzw. `display-mode: standalone` ist falsch), zeigt die Seite zusätzlich: „Läuft KI-Apps bei dir als App auf dem Home-Bildschirm? Dann öffne sie und füge diesen Link unter Einstellungen → Einladung einfügen ein.“ Dazu gibt es einen Knopf „Link kopieren“. *(Designer)*
   - Ab dann startet die App bei ihm in der Arena. Die anderen Bereiche sind bei ihm ausgeblendet; „Weitere Bereiche einblenden“ in den Einstellungen zeigt sie, mit eigenen, leeren lokalen Daten.
4. **Lokal** liegt der Zugang in `ki.arena.conn` = `{ cfg, code, player, key, keys? }`.
   - Nur auf Julians Gerät gibt es zusätzlich `keys` mit beiden Schlüsseln. *(Designer)*
     - Damit kann er unter Einstellungen jederzeit „Einladung für Uygar zeigen“ (falls Uygar Handy oder Link verliert) und „Link für mich“ abrufen.
     - So bringt er den Zugang auf ein anderes eigenes Gerät oder vom Rechner, auf dem er eingerichtet hat, in die iPhone-App.
     - Uygars Gerät kennt nur seinen eigenen Schlüssel.
   - Der Zugang kommt mit ins Backup. Julian bekommt die Arena auf einem neuen Handy also über sein Backup oder seinen Link zurück, Uygar über seinen Link.
   - `ki.arena.conn` wird beim Laden eines Backups als Ganzes ersetzt, wie alle Nicht-Datums-Schlüssel („Backup gewinnt“). Weicht der Code ab, nennt die Meldung „Arena-Zugang aus dem Backup übernommen“. *(Designer)*
   - Einstellungen → „Arena verlassen“ löscht den Zugang auf diesem Gerät (zwei Tipps).
   - **Wenn ein Link in falsche Hände gerät:** Schlüssel einzeln sperren gibt es in v1 nicht. Der Ausweg ist „Neue Arena anlegen“: neuer Code, neue Schlüssel, neuer Start; die alte Arena bleibt unbenutzt liegen. Bei zwei Spielern, die den Link nur untereinander teilen, ist das ein bewusst hingenommenes Risiko. *(Designer)*
5. **Identität:**
   - Die anonyme Anmeldung liefert pro Gerät eine Firebase-ID.
   - Mit seinem Schlüssel meldet ein Gerät beim Öffnen der Arena an, für welchen Spieler es schreibt.
   - Die Regeln prüfen den Schlüssel gegen ein Dokument, das kein Gerät lesen kann. Danach darf genau diese ID die Tage dieses Spielers schreiben.
   - Ein neues Gerät mit gleichem Schlüssel meldet sich einfach neu an.

### 5.2 Daten online

Alles liegt unter `arenas/{code}/…`. Andere Pfade sind gesperrt, Auflisten von `arenas` ist verboten.

| Pfad | Inhalt | Lesen | Schreiben |
|---|---|---|---|
| `arenas/{code}` | `{ start: 'JJJJ-MM-TT', v: 1 }` | jeder Angemeldete mit Code | nur anlegen, wenn es den Code noch nicht gibt |
| `…/keys/{player}` | Schlüssel des Spielers | niemand | nur anlegen (beim Einrichten) |
| `…/claims/{player}_{uid}` | Nachweis „diese ID ist dieser Spieler“ | niemand | anlegen, wenn der mitgeschickte Schlüssel zu `keys/{player}` passt und `uid` die eigene ID ist |
| `…/tasks/{id}` | `{ name, kind: 'yes'\|'value', unit?, goal?, order, archived }` | Angemeldete mit Code | beide Spieler (mit Nachweis) |
| `…/days/{player}_{JJJJ-MM-TT}` | `{ player, date, values: { taskId: true\|false\|Zahl }, points: { taskId: Zahl }, total }` | Angemeldete mit Code | nur der eigene Spieler (Nachweis über `claims`) |

- `player` ist `julian` oder `uygar`.
- Punkte werden beim Schreiben berechnet und mitgespeichert. Ändert sich später das Ziel einer Aufgabe, bleiben alte Tage, wie sie waren. Archivierte Aufgaben bleiben in alten Tagen sichtbar.
- Datums-Fenster (heute/gestern, Startwoche) prüft nur die App, nicht die Regeln. Die Regeln schützen Identität und Pfade.

### 5.3 Ansichten

Routen `#arena`, `#arena/woche`, `#arena/verlauf`, dazu `#arena/einladung?…` (nur zum Übernehmen).

- **Heute:**
  - Oben „Julian x,x : y,y Uygar“, live.
  - Darunter die eigenen aktiven Aufgaben:
    - Ja/Nein als zwei Knöpfe.
    - Werte als Zahlenfeld mit Einheit und Punkten daneben. Gespeichert wird beim Verlassen des Felds bzw. bei „Fertig“; Komma ist erlaubt.
  - „Gestern ändern ›“ schaltet auf gestern um.
  - Bei Julian stehen unter Health und Training die Vorschläge mit „Übernehmen“. Ein Vorschlag erscheint nur, solange die Aufgabe noch nicht beantwortet ist.
- **Woche:**
  - Mo–So als Tabelle mit zwei Spalten (Julian, Uygar) und den Tagespunkten, darunter die Wochensumme und „Julian führt mit 1,3“.
  - Pfeile für die vorige Woche.
- **Verlauf:**
  - Pro Kalenderwoche seit Start: KW, beide Summen, Sieger.
  - Oben die Gesamtpunkte seit Start und die Zahl der gewonnenen Wochen.
- **Aufgaben bearbeiten** (in Heute über „Bearbeiten“):
  - Name, Art, Einheit und Ziel ändern; hinzufügen; archivieren.
  - „Auf Notion-Stand zurücksetzen“ mit zwei Tipps. Das stellt die fünf Startaufgaben aktiv wieder her; andere werden archiviert.
- **Ohne Zugang:** Die Arena zeigt „Noch keine Arena auf diesem Gerät“ mit Link zu den Einstellungen.
- **Ohne Netz beim ersten Öffnen:** „Arena braucht beim ersten Mal Netz“.

### 5.4 Ändern und Zeiträume

- Änderbar sind heute und gestern (deutsche Zeit).
- **Startwoche (Designer):** Solange die Kalenderwoche des Arena-Starts läuft, sind alle Tage dieser Woche bis heute änderbar. So lassen sich Werte aus Notion nachtragen.
- Ältere Tage sind gesperrt und nur lesbar.

### 5.5 Offline und Laden

- Firestore läuft mit dauerhaftem lokalem Puffer. Einträge ohne Netz werden gesendet, sobald Netz da ist. Die Arena zeigt dann „wird gesendet“.
- Live-Updates über Abonnements auf die Aufgaben und die Tage der angezeigten Woche bzw. des Verlaufs.
- Das SDK lädt beim ersten Öffnen der Arena. Danach hält der Service-Worker die SDK-Dateien vor, damit die Arena offline startet.
- Die übrigen Bereiche laden das SDK nie.
- **Heute-Kachel:** liest den letzten bekannten Stand aus `ki.arena.cache` (beim Öffnen der Arena aktualisiert) und lädt kein SDK. Ist der Stand älter als heute, steht da „Arena öffnen ›“ statt Punkten.

### 5.6 Backup und Datenschutz

- `ki.arena.conn` und `ki.arena.cache` kommen ins normale Backup. Damit enthält das Backup auch den Arena-Zugang. Die Einstellungen sagen das beim Backup in einem Satz.
- Online liegen nur Spielernamen, Aufgaben, Ja/Nein, Werte und Punkte, wie Spec §9.

Mit *(Designer)* markierte Punkte hat der Designer nach dem Builder-Check entschieden; Julian kann sie korrigieren.

## 6 Dem Builder überlassen

- Dateistruktur. Vorschlag:
  - `js/areas/arena/` mit `data.js` (Startaufgaben), `logic.js` (Punkte, Wochen, Zeitfenster, Vorschläge; rein, getestet), `view.js`, `index.js`
  - `js/areas/arena/net.js` (SDK laden, Anmelden, Lesen/Schreiben hinter einer Schnittstelle mit Attrappe für Tests)
- Die genaue SDK-Version (fest, nicht „latest“) und wie der Service-Worker die SDK-Dateien vorhält.
- Die genauen Sicherheitsregeln samt Prüfliste für den Regel-Playground.
- Format und Prüfung der eingefügten Konfiguration (JSON oder das JS-Objekt aus der Konsole).
- Layout der Ansichten bei 375 px, Formulierungen der Hinweise.
- Wie Uygars ausgeblendete Bereiche technisch gesteuert werden (`ki.app.areas` o. ä.).
