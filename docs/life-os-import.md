# Life-OS-Import: Notion und Obsidian als Quellen

Life OS liest Notion und Obsidian nicht selbst. Claude baut aus beiden eine **Life-OS-Import-Datei**,
die du in der App unter **Import** einspielst. Die App zeigt eine Vorschau und schreibt erst danach.

## Ablauf

1. Claude sagen: „Life OS aktualisieren“.
2. Claude liest über seine Notion-Verbindung die Finanz-, Business- und Check-in-Datenbanken sowie die
   Textseiten und stellt daraus einen Notion-Schnappschuss zusammen (außerhalb dieses Repos).
3. Der Generator baut daraus zusammen mit dem Obsidian-Vault die Datei:

   ```
   node tools/life-os-import/build.mjs --snapshot <notion.json> --vault <Vault-Ordner> \
        --name "<Vault-Name>" --exclude "<Ordner, der draußen bleibt>" --out <Ausgabe-Ordner>
   ```

4. In Life OS: **Import → Datei wählen** (oder Inhalt einfügen) → Vorschau prüfen → **Importieren**.

## Was wohin geht

| Life OS | Quelle |
|---|---|
| Finanzen: Konten, Vermögensverlauf | Notion „Konten & Vermögen“ + „Vermögensverlauf“ |
| Finanzen: Buchungen | Notion „Transactions“ mit Status „Tatsächlich“ (Übertrag bleibt draußen) |
| Finanzen: Budget | Notion „Transactions“ mit Status „Geplant“ |
| Projekte | Notion „Bereiche“ (Status, nächster Meilenstein, Gewinnziel) |
| Business Log | Notion „Business Log“ |
| Übersicht: 5 Säulen | Notion „Säulen-Check-in“ |
| Wissen / 3D-Gehirn | Obsidian-Vault (Notion-Textseiten nur, wenn sie nicht schon im Vault stehen – dann unter „Notion/…“) |

## Regeln

- Jeder Import ersetzt, was dieselbe Quelle zuletzt gebracht hat. Was in der App angelegt wurde, bleibt.
- Training, Recovery, Ernährung, Routinen, Körper, Arena und KI-Agents werden nie überschrieben.
- Einträge aus Notion sind in der App nur zum Ansehen – geändert wird in Notion.
- Obsidian-Notizen, die in der App geändert wurden, werden nicht still überschrieben (wie beim Vault-Import).
- Gleiche Namen (Projekt, Konto, Kategorie) werden übernommen statt verdoppelt; Verknüpfungen bleiben.
- Die Datei enthält persönliche Daten. Sie gehört **nie** in dieses öffentliche Repository.
