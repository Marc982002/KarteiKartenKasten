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
- **Lange Antworten** über Schlüsselbegriffe. Gefundene Begriffe werden grün markiert, fehlende rot.

Die Begriffe sucht die App automatisch heraus (bis zu 7, Fachbegriffe und Substantive bevorzugt). Dann schlägt sie ab 60 % Treffern „Gut“ vor, ab 30 % „Schwer“, sonst „Nochmal“.

Du kannst die Begriffe auch selbst festlegen, mit Sternchen oder Fettschrift auf der Rückseite. Dann zählen nur diese, und es braucht 80 % für „Gut“ und 50 % für „Schwer“:

```
Photosynthese;Umwandlung von *Lichtenergie* in **chemische Energie**
```

Steht hinter einem Begriff eine Übersetzung in Klammern, reicht eins von beiden: Bei `Scope (Reichweite)` zählt „Scope“ genauso wie „Reichweite“. Klammern mit Quellen oder Beispielen („vgl. …“, „z. B. …“, „wie …“) werden ignoriert.

Geprüft wird nur, ob die Begriffe vorkommen, nicht der Sinn. Synonyme erkennt die App nicht. Die Bewertung ist deshalb immer nur ein Vorschlag.

## Themen

Mehrere Kartensets zu einem Fach lassen sich zu einem **Thema** bündeln, z. B. alle Sets einer Vorlesung. Auf der Übersicht steht das Thema mit Summen und Gesamtfortschritt über seinen Sets. **„Thema lernen“** startet eine Runde über alle Sets. Neue Karten kommen abwechselnd aus den Sets, und jedes Set behält sein eigenes Tageslimit und seine Einstellungen.

**Themenbaum:** Unter „Bearbeiten“ kannst du einem Thema eine Gliederung geben. Du baust sie direkt im Editor auf (Enter: nächster Zweig, Tab: einrücken, Shift+Tab: ausrücken, Knöpfe zum Verschieben und Löschen) oder fügst sie über „Als Text einfügen“ ein, als Baum (`├──`, `└──`) oder als eingerückte Liste. `[cite: …]`-Reste werden ignoriert. Jeder Zweig hat eine feste ID, Umbenennen und Verschieben ändern daran nichts. Unter dem Editor schlägt die App neue Zweige vor: Namen und Fachbegriffe, die in mehreren Karten ohne Zweig vorkommen, z. B. „Brown & Hagel“. Ein Klick fügt den Zweig hinzu. Die App ordnet jede Karte automatisch dem Zweig zu, dessen Begriffe sie am stärksten erwähnt. Der Teil vor einem Doppelpunkt („Porter: …“) zählt doppelt, und Begriffe, die in sehr vielen Karten vorkommen, zählen weniger. Unter „Themenbaum“ siehst du pro Zweig Karten, fällige Karten, Fortschritt und Fächer. Der schwächste Zweig ist markiert. Karten, die zu keinem Zweig passen, stehen gesammelt darunter. Oft fehlt dafür ein Zweig im Baum.

Ein Thema legst du über **„Neues Thema“** an. Die Zuordnung änderst du unter „Bearbeiten“ am Thema, in den Einstellungen eines Sets oder schon beim Import. Wird ein Thema gelöscht, bleiben seine Sets erhalten.

## Fortschritt und Abzeichen

- **Karteikasten mit Fächern** (Statistik eines Stapels): Jede Karte liegt in einem von fünf Fächern, je nachdem, wie lange sie laut Algorithmus sicher sitzt (unter 1 Tag bis über 3 Monate). Gewusste Karten rücken weiter, vergessene fallen zurück.
- **Fortschritt pro Stapel** mit den Stufen Bronze (25 %), Silber (50 %) und Gold (75 %).
- **16 Abzeichen** für Regelmäßigkeit und Meilensteine, z. B. Serien, Antworten insgesamt, „Alles erledigt“ oder die erste Karte in Fach 5.

Belohnt wird nur, was wirklich zählt: regelmäßiges Lernen und langfristiges Behalten. Es gibt keine Punkte für „richtige“ Bewertungen, weil das dazu verleiten würde, Karten besser zu bewerten, als sie liefen. Der Algorithmus würde dann zu lange Abstände planen.

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
