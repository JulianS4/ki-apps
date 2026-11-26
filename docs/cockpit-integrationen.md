# Cockpit: Notion und Bank anbinden

Stand 26.11.2026. **Beide Verbindungen sind nicht eingerichtet.** Das Cockpit zeigt das in „Einstellungen“ auch so an. Diese Seite beschreibt, was eine echte Anbindung bräuchte und was bis dahin funktioniert.

## Warum nicht direkt aus der App

KI-Apps ist eine öffentliche Seite auf GitHub Pages ohne eigenen Server. Daraus folgt:

- Ein Notion-Token oder Bank-Schlüssel im Code wäre für jeden lesbar (das Repo ist öffentlich).
- Notion beantwortet keine Anfragen direkt aus dem Browser (kein CORS).
- Open-Banking-Anbieter verlangen geheime Schlüssel auf einem Server.

Deshalb braucht jede Live-Anbindung einen kleinen eigenen Server dazwischen, zum Beispiel einen Cloudflare Worker (kostenlose Stufe). Er hält die Geheimnisse, liest nur und gibt die Daten im Format `ki-cockpit` an die App weiter.

## Notion

**Was synchronisiert würde:**

| Notion | erscheint in |
|---|---|
| Finance Dashboard → Konten, Entwicklung Nettovermögen | Finanzen → Konten und Verlauf |
| Business Dashboard → Business Log | Projekte → Business Log |
| Ausbildung (Klassenarbeiten, Abteilungen, falls in Notion gepflegt) | Ausbildung |

**So würde es eingerichtet (nur von dir selbst):**

1. In Notion unter *Einstellungen → Verbindungen → Integrationen entwickeln* eine interne Integration anlegen. Nur die Berechtigung „Inhalte lesen“ anhaken.
2. Die Integration nur den Seiten hinzufügen, die das Cockpit sehen darf (Seite → ••• → Verbindungen). Alles andere bleibt für sie unsichtbar.
3. Den Token als Secret im Worker hinterlegen, nie in der App, nie im Repo.
4. Der Worker liest die freigegebenen Datenbanken und liefert eine `ki-cockpit`-Datei. Zugang nur mit einem Gerätecode, den du in der App einträgst.
5. Widerrufen: Integration in Notion entfernen. Danach liest der Worker nichts mehr.

**Bis dahin:** *Einstellungen → Cockpit-Datei importieren* nimmt eine `ki-cockpit`-JSON-Datei an (dasselbe Format wie „Alles als JSON“). Einträge werden nach `id` zusammengeführt und als „Datei-Import“ mit Datum gekennzeichnet.

## Bank

**Was abgerufen würde:** Kontoname, Kontostand, Umsätze (Datum, Betrag, Empfänger, Verwendungszweck). Nur lesend, nichts überweisen.

**Bedingungen:**

- Nur über einen nach PSD2 zugelassenen Kontoinformationsdienst.
- Du gibst den Zugriff direkt bei deiner Bank frei. Die Freigabe ist zeitlich begrenzt (meist 90 bis 180 Tage) und jederzeit widerrufbar.
- Kein Speichern von Bank-Passwörtern oder PINs. Kein FinTS mit gespeicherter PIN. Kein automatisches Auslesen von Bankseiten.

**Anbieter:** Enable Banking und GoCardless (früher Nordigen) haben Privatpersonen früher kostenlose Zugänge für eigene Konten angeboten. Bei beiden haben sich die Bedingungen zuletzt geändert. Vor einer Einrichtung prüfen, ob und zu welchen Kosten es für dich geht:

- <https://enablebanking.com/docs/faq>
- <https://gocardless.com/bank-account-data/>

**Bis dahin:** Kontostände von Hand eintragen, Umsätze per CSV-Import (*Finanzen → Buchungen → CSV-Import*). Spalten werden erkannt und vor dem Import bestätigt. Doppelte Buchungen werden übersprungen. Jeder Import steht mit Datei, Datum und Anzahl in den Einstellungen. Importierte Daten sind so aktuell wie die Datei.

## KI-Agents

Kein Agent-System bietet bisher eine Schnittstelle an. Agents werden von Hand gepflegt, jeder Status mit Datum. Die Karte zeigt immer „nicht verbunden“.
