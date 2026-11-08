# Karteikasten

Karteikarten aus CSV-Dateien lernen, auf dem eigenen Rechner. Die App zeigt jede Karte kurz bevor du sie vergessen würdest (FSRS-6 über die Bibliothek [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)).

## Starten

Voraussetzung: Node.js 22.13 oder neuer (`node -v`).

Einmalig die Abhängigkeit installieren:

```bash
npm install
```

Server starten:

```bash
npm start
```

Dann im Browser öffnen: <http://localhost:4321>

Beenden mit `Ctrl+C` im Terminal.

## Karten und Abfrage

CSV mit Spalte 1 = Vorderseite, Spalte 2 = Rückseite. Komma, Semikolon und Tab werden erkannt.

Abfragearten pro Stapel (Einstellungen → Abfrageart):

- **Automatisch** (Standard): neue Karten als Multiple Choice, danach Antwort eintippen.
- **Immer eintippen**, **Immer Multiple Choice**, **Nur aufdecken**.
- **Eintippen, selbst vergleichen**: Du schreibst deine Antwort, die App zeigt die Lösung daneben, du bewertest selbst.

Beim Eintippen prüft die App:

- **Kurze Antworten** (bis 60 Zeichen) auf Übereinstimmung, mit Toleranz für Tippfehler, Akzente und Artikel.
- **Lange Antworten** über Schlüsselbegriffe. Ab 80 % getroffener Begriffe schlägt sie „Gut“ vor, ab 50 % „Schwer“, sonst „Nochmal“. Gefundene Begriffe werden grün markiert, fehlende rot.

Die Begriffe sucht die App automatisch heraus. Du kannst sie auch selbst festlegen, mit Sternchen auf der Rückseite:

```
Photosynthese;Umwandlung von *Lichtenergie* in *chemische Energie*
```

Geprüft wird nur, ob die Begriffe vorkommen, nicht der Sinn. Synonyme erkennt die App nicht. Die Bewertung ist deshalb immer nur ein Vorschlag.

## Wo die Daten liegen

Alle Stapel, der Lernstand und der Antwortverlauf liegen in `data/karteikasten.db` (SQLite). Zum Sichern den ganzen Ordner `data/` kopieren, am besten bei beendetem Server.

## Optionen

| Variable | Standard | Wirkung |
|---|---|---|
| `PORT` | `4321` | Anderer Port, falls 4321 belegt ist: `PORT=4322 npm start` |
| `HOST` | `127.0.0.1` | `HOST=0.0.0.0 npm start` macht die App im WLAN erreichbar, z. B. vom Handy. Es gibt kein Passwort, also nur in einem vertrauenswürdigen Netz nutzen. |
| `DATA_DIR` | `./data` | Anderer Speicherort für die Datenbank. Nicht in iCloud-Ordner legen. |

## Aufbau

- `server.js`: liefert die App aus und speichert JSON-Dokumente in SQLite (`/api/docs`). Ohne Framework, nur Node-Bordmittel.
- `public/index.html`: die komplette App (Import, Lernen, Statistik, Einstellungen).
- `node_modules/ts-fsrs`: der Lernalgorithmus, wird vom Server unter `/vendor/ts-fsrs.js` ausgeliefert. Fehlt er, nutzt die App eine eingebaute FSRS-5-Version.
- `artifact/karteikasten.html`: die frühere Version als Claude-Artefakt. Sie speichert im Claude-Konto statt lokal und wird vom Server nicht genutzt.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
