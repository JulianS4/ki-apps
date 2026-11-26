# Routinen bearbeiten – kurzes Design

Stand 26.11.2026 · Ergänzung zu `2026-11-25-ki-apps-design.md` §6.4 und §8 · von Julian freigegeben

## Warum

Die Spec sagt in §8: „Bearbeitbar in v1 sind die Listen: … Routinen-Schritte …“ und „Pro Bereich gibt es ‚Auf Notion-Stand zurücksetzen‘“. Stufe 4a hat die Routinen fest aus Notion übernommen. Julian soll Schritte, Zeiten und die Packliste in der App ändern können, ohne Code.

## Ziele

- Morgen- und Abendroutine: Schritte umbenennen, Zeiten „von“/„bis“ ändern, Schritte hinzufügen und löschen.
- Packliste: Gegenstände umbenennen, löschen und pro Gruppe (Tasche, Essentials) hinzufügen.
- Ein „Auf Notion-Stand zurücksetzen“ für den ganzen Bereich, mit zweitem Tipp zur Bestätigung.

## Nicht-Ziele

- Chinese-Grandpa-Übungen und Mobility-Routinen bleiben fest (wie in §8 für v1).
- Die Wochenend-Regel (+1 h morgens Sa/So, abends Fr/Sa) bleibt fest.
- Kein Verlauf der Listen: Ändert Julian heute etwas, zählt auch „Gestern Abend“ mit der neuen Liste.
- Keine eigenen Gruppen in der Packliste.

## Anti-Ziele

- Ein Häkchen geht verloren, weil ein Titel geändert wurde.
- Kaputte gespeicherte Daten lassen den Bereich abstürzen.
- Daten verlassen das Gerät.

## Ansätze

- **A · Bearbeiten-Modus direkt in der Routine (gewählt):** wie der Supplement-Editor in Ernährung. Ein Knopf pro Routine schaltet die Zeilen auf Eingabefelder um. Bedienung ist überall gleich, und man bearbeitet dort, wo man abhakt.
- **B · Eigener Reiter „Bearbeiten“:** trennt Abhaken und Bearbeiten sauber, ist aber ein weiterer Reiter neben „Tag · Halterung“ und weg von der Liste, um die es geht.
- **C · Liste als Text bearbeiten:** am wenigsten Code, auf dem iPhone aber fehleranfällig (Zeitformat, Zeilen).

## Entscheidungen

- Die bearbeiteten Listen liegen in `ki.rout.steps` (`{ morgen: [...], abend: [...] }`) und `ki.rout.pack` (Gruppen mit Gegenständen). Ohne Eintrag gilt der Notion-Stand aus `data.js`. Zurücksetzen setzt beide Schlüssel auf `null`.
- Ein Schritt ist `{ id, from, to?, title, link? }`. Häkchen hängen an der `id`, nicht am Titel. Neue Schritte bekommen eine neue `id` ohne Verknüpfung.
- Die Schritte sortieren sich immer nach „von“. Verschieben gibt es deshalb nicht; man ändert die Zeit.
- Im Bearbeiten-Modus stehen die Grundzeiten (Mo–Fr morgens, So–Do abends). Der Hinweis sagt, dass die Wochenend-Verschiebung automatisch dazukommt.
- Verknüpfte Schritte (500 ml, Grandpa, Packliste, Mobility, Supplements, Box-Breathing) behalten ihre Verknüpfung beim Umbenennen und Verschieben. Wird einer gelöscht, zählt er nicht mehr mit, und z. B. „Alles erledigt“ setzt dann keine Mobility mehr.
- Absicherung: Eine leere oder kaputte Liste fällt auf den Notion-Stand zurück. Den letzten Schritt einer Routine kann man nicht löschen. Ein „bis“, das nicht nach „von“ liegt, wird ignoriert, eine ungültige Zeit ebenso.
- Titel werden beim Tippen gespeichert, ohne die Seite neu zu zeichnen. Zeiten werden bei der Änderung gespeichert; neu sortiert wird, sobald das Feld verlassen wird (bestehende Regel der App).
- Das Backup nimmt beide Schlüssel als Ganzes mit, wie die Listen in Ernährung.

## Dem Builder überlassen

Markup und CSS der Eingabezeilen (Vorgabe: passt bei 375 px ohne seitliches Scrollen, Tippziele ≥ 44 px), Wortlaut des Verknüpfungs-Hinweises.
