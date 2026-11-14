# Roadmap Karteikasten

Stand: 14.11.2026 · Zielgruppe: du und deine Kommilitonen

## Wo die App heute steht

Gebaut ab dem 8.11.2026, bis zum 14.11. 26 Branches gemergt, 105 automatische Tests grün. Seit dem 14.11. laufen die Tests nach jedem Push automatisch auf GitHub, auf Linux, Mac und Windows.

Sie kann schon sehr viel: Karten aus CSV, FSRS-Planung, Antwortprüfung auch für lange Antworten, Themen mit Themenbaum, Fortschritt und Abzeichen, Handy und Computer gleichzeitig, Sicherungen.

Gelernt wurde bisher an **einem** Tag (Verlauf nur vom 8.11.), mit 3 Stapeln. Die App ist also funktional weit, aber kaum im Alltag erprobt. Das ist die wichtigste Erkenntnis für die Roadmap.

## Mehrwert und USP

**Für wen:** Studierende, die Theorie für Klausuren lernen. Also Definitionen, Modelle, Autoren, Zusammenhänge, keine Vokabeln.

**USP in einem Satz:**
> Die Lernkarten-App für Vorlesungsstoff: Sie fragt dich in eigenen Worten ab und zeigt dir pro Kapitel deiner Vorlesung, welche Fachbegriffe noch fehlen. Die Bewertung kannst du nachprüfen, und sie läuft ohne Abo und ohne Cloud auf dem eigenen Rechner.

Vergleich mit der Konkurrenz (Web-Recherche vom 10.11.2026, Anbieterangaben, nicht selbst getestet):

| | Karteikasten | Anki | Quizlet | RemNote |
|---|---|---|---|---|
| Lange Antworten eintippen und prüfen lassen | ✅ Schlüsselbegriffe, grün/rot | ❌ nur selbst bewerten (KI über Zusatzprogramme) | ✅ KI nach Sinn, nur im Abo | ✅ KI nach Sinn, kostet KI-Guthaben |
| Prüfung versteht Synonyme und Sinn | ❌ nur Begriffe | – | ✅ | ✅ |
| Bewertung nachprüfbar (welche Begriffe fehlten) | ✅ | – | ❌ KI-Urteil | ❌ KI-Urteil |
| Prüfung kostenlos und ohne Internet | ✅ | – | ❌ | ❌ |
| Schwächstes Kapitel erkennen | ✅ eigene Vorlesungsgliederung | ⚠️ über Zusatzprogramme | ❌ | ✅ Lernstand pro Thema |
| Planung auf ein Klausurdatum | ❌ geplant | ⚠️ über Zusatzprogramme | ❌ | ✅ |
| Moderne Wiederholungsplanung (FSRS) | ✅ | ✅ | ❌ | ✅ |
| Ehrliche Belohnung (nur Behalten zählt) | ✅ | – | ❌ Punkte, Streaks | – |
| Daten bleiben bei mir, kostenlos | ✅ | ✅ | ❌ Konto, Abo | ❌ Konto, Abo für KI |
| Einfach einzurichten | ❌ Terminal nötig | ⚠️ | ✅ | ✅ |

Was daraus folgt:

- **RemNote ist der wichtigste Vergleich.** Es verbindet schon KI-Bewertung getippter Antworten mit einem Klausurplaner nach Lernstand pro Thema. „Das gibt es nirgends“ stimmt also nicht.
- **Was bleibt:** Die Bewertung ist nachprüfbar, kostet nichts und braucht kein Internet. Die Gliederung ist die eigene Vorlesung. Belohnt wird nur Behalten. Das ist eine kleinere Nische als gedacht.
- **Größte Schwäche:** Die Konkurrenz versteht Sinn, Karteikasten nur Begriffe. Das Lernen von Synonymen wird damit die wichtigste Verbesserung am Kern.
- **Klausurdatum ist Pflicht**, kein Alleinstellungsmerkmal mehr.
- **Der Haken bleibt die letzte Zeile:** Der USP richtet sich an Studierende, aber die meisten Studierenden können `npm start` nicht ausführen. Das entscheidet, wie weit die Roadmap gehen muss.

## Grundsätze

Daran wird jede neue Idee gemessen. Sie stehen so schon im README, hier gesammelt:

1. **Daten gehören mir.** Lokal, keine Pflicht zu Konto oder Cloud.
2. **Belohnt wird nur Behalten.** Keine Punkte für „richtig“ bewertete Karten.
3. **Die App schlägt vor, ich entscheide.** Bewertungen sind Vorschläge, Schwellen sind erklärt.
4. **Forschung statt Bauchgefühl.** Neue Lernregeln brauchen eine Begründung.
5. **Ruhig statt laut.** Keine Werbung, keine Benachrichtigungsflut, kein Social Feed.

## Was heißt „fertig geshipt“?

Drei mögliche Ziele. Jedes baut auf dem vorigen auf.

| Stufe | Ziel | Für wen | Aufwand |
|---|---|---|---|
| **1.0** | Fertig für mich | du selbst | klein |
| **1.5** | Andere können es installieren | Kommilitonen, Lerngruppe | mittel |
| **2.0** | Läuft überall ohne Installation | alle Studierenden | groß, laufende Kosten |

**Entschieden (10.11.2026):** Die App soll auch Kommilitonen dienen. **„Geshipt“ heißt 1.5.** Stufe 1.0 ist der Zwischenschritt dorthin, 2.0 bleibt eine Option für später.

Warum nicht direkt 1.5? Kommilitonen sollen eine App bekommen, die eine Klausurphase überstanden hat. Fehler, die du selbst findest, kosten nichts. Fehler, die andere finden, kosten Vertrauen und Support.

### 1.0 – Fertig für mich (Zwischenschritt)

Ziel: Ich bestehe eine Klausurphase damit. Vorschlag: Ende der Klausurphase im Februar 2027.

Fertig, wenn:

- [ ] Eine ganze Klausurphase damit gelernt, mehrmals pro Woche
- [ ] Kein Datenverlust, eine Sicherung liegt außerhalb des Rechners
- [ ] Handy zu Hause im WLAN läuft zuverlässig
- [ ] Neue Karten aus Vorlesungsfolien sind in 15 Minuten erstellt (Prompt-Vorlage, siehe unten)
- [ ] Keine bekannten Fehler, die das Lernen stören
- [ ] Antwortprüfung an echten Antworten nachgeschärft (aus dem Verlauf)

### 1.5 – Kommilitonen können es nutzen (= geshipt)

Ziel: Kommilitonen installieren die App selbst und lernen damit fürs nächste Semester. Vorschlag: zum Start des Sommersemesters im April 2027.

Voraussetzungen, bevor 1.5 beginnt:

- 1.0 erreicht
- 2–3 Testpersonen aus dem Studium haben zugesagt (siehe „Als Nächstes“)
- Entscheidung „Programm oder Webseite“ getroffen (siehe unten)

Fertig, wenn:

- [ ] **Start ohne Terminal:** fertiges Programm für Mac und Windows, Doppelklick genügt
- [ ] **Auf Windows getestet.** Die meisten Kommilitonen haben vermutlich Windows, entwickelt wird auf dem Mac.
- [ ] **Erster Start erklärt sich selbst:** Beispielstapel, kurze Einführung, Hinweis auf Sicherungen
- [ ] **Karten bekommen ohne Technikwissen:** Prompt-Vorlage in der App, Import aus Anki und Quizlet
- [ ] **Stapel teilen** samt Themenbaum, damit eine Lerngruppe sich die Arbeit aufteilt
- [x] **Oberfläche auf Deutsch und Englisch**, hell/dunkel wählbar, README auf GitHub englisch (10.11.2026)
- [x] **Handy:** Anleitung, wie man das Handy im eigenen WLAN verbindet, mit Warnung für öffentliche Netze (Uni-WLAN). Verbinden per QR-Code und PIN im Rädchen, Anleitung im README (14.11.2026)
- [ ] **Updates:** Neue Versionen lassen sich installieren, ohne dass Lernstand verloren geht
- [ ] **Feedback-Weg:** z. B. ein Formular oder GitHub-Issues mit Vorlage
- [ ] 3 Testpersonen haben je mindestens 2 Wochen damit gelernt und würden es weiterempfehlen

Technische Voraussetzung im Hintergrund: Den Code in mehrere Dateien aufteilen (heute steckt alles in einer 283-KB-Datei, am 10.11. waren es noch 217 KB). Sonst werden Fehlerbehebungen für mehrere Nutzer mühsam.

**Entscheidung: Programm oder Webseite?**

| | Programm zum Installieren | Webseite mit Anmeldung |
|---|---|---|
| Passt zu „Daten gehören mir“ | ✅ | ⚠️ Daten liegen auf deinem Server |
| Laufende Kosten | keine | Server, Domain |
| Datenschutz (DSGVO) | kaum Aufwand, Daten bleiben beim Nutzer | Datenschutzerklärung, Verantwortung für fremde Daten |
| Handy unterwegs | ❌ nur im eigenen WLAN | ✅ |
| Aufwand | mittel | groß |

**Empfehlung:** Programm zum Installieren für 1.5. Die Webseite ist Stufe 2.0 und kommt nur, wenn Handy unterwegs der meistgenannte Wunsch der Testpersonen ist.

### 2.0 – Läuft überall

Voraussetzung: 1.5 wird genutzt, die Testpersonen wünschen sich vor allem Handy unterwegs, und es ist geklärt, wer Betrieb und Kosten trägt. Die Lizenz verbietet kommerzielle Nutzung, Einnahmen fallen also weg.

- Online erreichbar mit Anmeldung (Passwort, Datenschutz nach DSGVO)
- Auf dem Handy als App installierbar, auch offline
- Erinnerungen („12 Karten fällig“)

Achtung: Das berührt Grundsatz 1. Lokal muss weiter möglich sein.

## Ideen-Speicher mit Voraussetzungen

Nach Nutzen sortiert. „Voraussetzung“ heißt: Vorher nicht anfangen.

| Idee | Nutzen | Voraussetzung | Stufe |
|---|---|---|---|
| ~~**Prompt-Vorlage:**~~ Folien rein, fertige CSV mit markierten Fachbegriffen raus | Karten erstellen geht schneller, Antwortprüfung wird genauer | erledigt (14.11.2026): [docs/prompt-vorlage.md](docs/prompt-vorlage.md). Bewährt sich beim eigenen Lernen? | 1.0 |
| **Antwortprüfung lernt Synonyme** aus deinen Korrekturen | Weniger falsche „Nochmal“-Vorschläge. Wichtigste Verbesserung am Kern, weil die Konkurrenz Sinn versteht | Einige hundert getippte Antworten im Verlauf | 1.0 |
| **Klausurdatum:** Pro Thema ein Datum setzen, die App plant so, dass bis dahin alles einmal sitzt, und sagt „15 Min. pro Tag reichen“ | Beantwortet die Frage „schaffe ich das?“. Wird erwartet, RemNote hat es schon | Mehrere Wochen eigener Verlauf, damit die Zeitschätzung stimmt | 1.0 |
| **Persönliche Schwellen** statt 60 %/30 % | Vorschläge passen besser zu dir | wie oben | 1.0 |
| **FSRS auf dich einstellen** (Parameter aus deinem Verlauf berechnen) | Genauere Abstände, weniger Wiederholungen | Einige hundert Bewertungen über mehrere Wochen | 1.0 |
| **Bilder und Formeln** in Karten | Fächer wie Statistik, BWL-Grafiken | Ein Fach, das es braucht. Bilder machen Datenbank und Sicherung größer | 1.5 |
| **Import aus Anki/Quizlet** | Umstieg ohne Abtippen | Zielgruppe 1.5 bestätigt | 1.5 |
| **Stapel teilen** inkl. Themenbaum | Lerngruppe teilt sich die Arbeit | Dateiformat festgelegt | 1.5 |
| **KI-Bewertung** langer Antworten (versteht Sinn statt nur Begriffe) | Löst die größte Schwäche der Prüfung | Entscheidung zu Kosten und Datenschutz, denn Antworten gehen an einen Anbieter. Muss abschaltbar sein (Grundsatz 1) | 1.5 |
| **Karten direkt in der App aus PDF erzeugen** | Kein Umweg über einen Chat | wie KI-Bewertung, dazu Prompt-Vorlage bewährt | 2.0 |
| **Erinnerungen** aufs Handy | Regelmäßigkeit | Installierbare App mit sicherer Verbindung (2.0) | 2.0 |

## Regeln für jede neue Funktion

Bevor etwas Neues gebaut wird:

1. **Echtes Problem:** Beim eigenen Lernen aufgefallen oder im Verlauf sichtbar, nicht nur ausgedacht.
2. **Passt zu den Grundsätzen** oben.
3. **Erfolg ist messbar:** Vorher festlegen, woran man sieht, dass es hilft.

Bevor etwas gemergt wird:

4. Tests für die heiklen Teile, `npm test` grün.
5. Alte Sicherungen lassen sich weiter wiederherstellen.
6. README aktualisiert.
7. Eigener Branch, lokal in `main` mergen, pushen.

## Bewusst nicht

- Ranglisten, Punkte, Vergleich mit anderen
- Werbung, Abo, Bezahlfunktionen
- Social Feed, öffentliche Stapel-Börse
- Vokabeltrainer-Funktionen, die Quizlet und Anki schon gut können

## Als Nächstes

1. **2–4 Wochen bauen pausieren und lernen.** Der Verlauf ist die Grundlage für fast alle 1.0-Punkte, und bisher gibt es einen Tag davon.
2. ~~**Prompt-Vorlage** für Karten aus Folien schreiben und im README ablegen.~~ Erledigt (14.11.2026), siehe [docs/prompt-vorlage.md](docs/prompt-vorlage.md). Jetzt beim nächsten Foliensatz ausprobieren und messen, ob 15 Minuten reichen.
3. **Notizen beim Lernen:** Was nervt, was fehlt? Daraus wird die nächste Runde dieser Roadmap.
4. **2–3 Testpersonen finden**, am besten aus derselben Vorlesung. Zeig ihnen die App auf deinem Rechner und frag: Würdest du das nutzen? Was müsste anders sein? Installieren müssen sie noch nichts. Das prüft früh, ob 1.5 sich lohnt.

## Offene Fragen

- Wann ist deine Klausurphase, damit 1.0 ein festes Datum bekommt?
- Welche Fächer kommen noch, bei dir und bei den Testpersonen? Brauchen sie Bilder oder Formeln?
- Programm oder Webseite? Die Empfehlung steht bei 1.5, entschieden wird nach den Gesprächen mit den Testpersonen.
