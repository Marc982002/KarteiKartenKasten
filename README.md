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
