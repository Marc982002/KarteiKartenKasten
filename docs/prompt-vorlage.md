# Prompt-Vorlage: Karten aus Vorlesungsfolien

[English](prompt-template.md) · **Deutsch**

Mit dieser Vorlage macht ein KI-Chat (z. B. Claude oder ChatGPT) aus deinen Folien eine CSV-Datei, die Karteikasten direkt importiert. Dazu bekommst du eine Gliederung für den Themenbaum.

Die Vorlage ist auf die Antwortprüfung der App abgestimmt: Fachbegriffe sind markiert, Übersetzungen stehen in Klammern, und Aufzählungen werden in kleine Karten zerlegt. Dadurch prüft die App deine getippten Antworten genauer.

## So gehst du vor

1. Neuen Chat öffnen und die Folien als PDF anhängen. Bei sehr langen Foliensätzen lieber ein Kapitel pro Chat.
2. Den Prompt unten kopieren, in den Chat einfügen und abschicken.
3. Den CSV-Block aus der Antwort kopieren. In Karteikasten auf **„Text einfügen“** klicken, einfügen, prüfen, importieren. Alternativ als `.csv` speichern und in die App ziehen.
4. Den Gliederungs-Block kopieren. Am Thema **„Bearbeiten“** → **„Als Text einfügen“** wählen und einfügen.
5. Die Karten einmal durchsehen. Du kennst die Vorlesung, die KI nicht. Unter **„Karten“** am Stapel kannst du alles korrigieren, auch später beim Lernen mit der Taste `E`.

Die KI kann Inhalte falsch wiedergeben oder Dinge ergänzen, die nicht auf den Folien stehen. Die Vorlage verbietet das, sicher ist es trotzdem nicht. Prüf besonders Zahlen, Jahreszahlen und Autorennamen.

## Der Prompt

Den Teil in eckigen Klammern kannst du anpassen.

```text
Du erstellst Lernkarten aus den angehängten Vorlesungsfolien für eine Karteikarten-App.
Fach: [Name der Vorlesung]. Die Karten sollen auf die Klausur vorbereiten.

INHALT
- Nur Inhalte aus den Folien. Erfinde nichts dazu. Wenn eine Folie unklar ist, lass sie weg.
- Pro Karte genau ein Gedanke: eine Definition, ein Modell, eine Unterscheidung, ein Zusammenhang.
- Aufzählungen mit mehr als 4 Punkten teilst du auf: eine Karte fragt nach der Anzahl und den Namen,
  weitere Karten fragen nach einzelnen Punkten.
- Keine Karten zu Organisatorischem (Termine, Literaturliste, Gliederungsfolien).
- Etwa eine Karte pro inhaltlicher Folie, höchstens 40 Karten.

VORDERSEITE
- Eine klare Frage, die man ohne die Folie versteht.
- Gehört die Frage zu einem Modell, Autor oder Konzept, steht dessen Name vorne mit Doppelpunkt,
  z. B. "Porter: Welche fünf Kräfte bestimmen die Attraktivität einer Branche?"
- Benutze für Modelle und Konzepte immer denselben Namen wie in der Gliederung unten.

RÜCKSEITE
- Kurz und vollständig, höchstens 3 Sätze, in eigenen Worten statt Folientext.
- Markiere in jeder längeren Antwort 2 bis 5 Fachbegriffe mit **doppelten Sternchen**.
  Markiert werden nur Begriffe, die in einer guten Antwort unbedingt vorkommen müssen.
- Steht ein Fachbegriff auf Englisch, schreib die deutsche Übersetzung direkt dahinter in Klammern:
  **Scope** (Reichweite). Beides gilt dann als richtig.
- Sonst keine Klammern. Beispiele leitest du mit "z. B." ein, Quellen mit "vgl.".
- Ist die Antwort nur ein Begriff oder eine Zahl (bis etwa 60 Zeichen), dann ohne Sternchen.
  Kommas nur, wenn mehrere Antworten gleich richtig sind ("Haus, Gebäude").

FORMAT
Antworte mit genau zwei Codeblöcken und sonst nichts.

Block 1: CSV
- Erste Zeile: Vorderseite;Rückseite
- Trennzeichen ist das Semikolon.
- Jedes Feld steht in doppelten Anführungszeichen. Anführungszeichen im Text werden verdoppelt ("").
- Eine Karte pro Zeile, keine Zeilenumbrüche innerhalb eines Feldes.

Block 2: Gliederung
- Erste Zeile: Name der Vorlesung, ohne Spiegelstrich.
- Darunter die Kapitel als Liste mit "- ", Unterpunkte mit 2 Leerzeichen eingerückt, höchstens 3 Ebenen.
- Kurze Namen, die auch in den Karten vorkommen (z. B. "Porters Five Forces", nicht "Wettbewerb verstehen").

Beispiel für eine Zeile in Block 1:
"Porter: Was beschreibt das Modell der Five Forces?";"Es erklärt die **Attraktivität** einer Branche über fünf **Wettbewerbskräfte**, z. B. die **Verhandlungsmacht** der Lieferanten."
```

## Warum die Regeln so sind

- **Name mit Doppelpunkt vorne:** Die App ordnet jede Karte dem Zweig im Themenbaum zu, dessen Begriffe sie am stärksten erwähnt. Der Teil vor dem Doppelpunkt zählt dabei doppelt.
- **Markierte Fachbegriffe:** Sind Begriffe markiert, zählt die App nur diese. Ohne Markierung sucht sie bis zu 7 Begriffe selbst heraus, und das trifft nicht immer die richtigen.
- **Übersetzung in Klammern:** Steht hinter einem markierten Begriff eine Klammer, gilt ihr Inhalt als gleichwertige Antwort. Deshalb sollen andere Klammern fehlen.
- **Kommas in kurzen Antworten:** Bei kurzen Antworten liest die App Komma, Semikolon, Schrägstrich und „oder“ als „eins davon reicht“.
- **Ein Gedanke pro Karte:** Lange Karten werden schnell zu Problemkarten, die man immer wieder vergisst.
- **Anführungszeichen in der CSV:** So bleibt ein Semikolon in einer Antwort Teil des Textes.
