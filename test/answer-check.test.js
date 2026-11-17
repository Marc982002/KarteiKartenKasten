// Checking typed answers: short answers by spelling, long answers by key terms.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./load-app.js";

let run, get;
before(async () => { ({ run, get } = await loadApp()); });
const check = (given, correct) => get(`checkAnswer(${JSON.stringify(given)}, ${JSON.stringify(correct)})`);
const keywords = (given, answer) => get(`checkKeywords(${JSON.stringify(given)}, ${JSON.stringify(answer)})`);
const labels = list => list.map(k => k.label);

test("kurze Antwort: exakt richtig, auch mit anderer Groß-/Kleinschreibung und Satzzeichen", () => {
  assert.equal(check("Paris", "Paris").verdict, "right");
  assert.equal(check("  paris. ", "Paris").verdict, "right");
  assert.equal(check("Paris", "Paris").suggest, 3);
});

test("kurze Antwort: eine von mehreren Lösungen reicht", () => {
  assert.equal(check("Gebäude", "Haus, Gebäude").verdict, "right");
  assert.equal(check("house", "home oder house").verdict, "right");
});

test("kurze Antwort: kleine Fehler gelten als fast richtig und schlagen „Schwer“ vor", () => {
  const typo = check("Pairs", "Paris");
  assert.equal(typo.verdict, "close");
  assert.equal(typo.suggest, 2);
  assert.match(typo.note, /Tippfehler/);

  const accent = check("Malaga", "Málaga");
  assert.equal(accent.verdict, "close");
  assert.match(accent.note, /Akzente/);

  const article = check("Haus", "das Haus");
  assert.equal(article.verdict, "close");
  assert.match(article.note, /kleine Wort/);
});

test("kurze Antwort: bei sehr kurzen Wörtern zählt jeder Buchstabe", () => {
  assert.equal(check("Rim", "Rom").verdict, "wrong");
});

test("kurze Antwort: falsch und leer", () => {
  assert.deepEqual(check("Rom", "Paris"), { verdict: "wrong", suggest: 1 });
  assert.deepEqual(check("   ", "Paris"), { verdict: "empty", suggest: 1 });
});

test("markierte Begriffe: nur die markierten zählen, Endungen und Zusammenschreibung sind egal", () => {
  const answer = "Umwandlung von *Lichtenergie* in **chemische Energie**";
  const r = keywords("Licht Energie wird zu chemischer Energie", answer);
  assert.equal(r.marked, true);
  assert.deepEqual(labels(r.found), ["Lichtenergie", "chemische Energie"]);
  assert.equal(r.verdict, "right");
});

test("markierte Begriffe: 80 % für „Gut“, 50 % für „Schwer“", () => {
  const answer = "*Alpha* und *Beta*";
  assert.equal(keywords("Alpha", answer).verdict, "close");     // 1 von 2 = 50 %
  assert.equal(keywords("Alpha Beta", answer).verdict, "right");
  assert.equal(keywords("Gamma", answer).verdict, "wrong");
  assert.equal(keywords("", answer).verdict, "empty");
});

test("markierte Begriffe: Übersetzung in Klammern zählt als Alternative, Quellenangaben nicht", () => {
  const r = keywords("Die Reichweite", "*Scope* (Reichweite) ist wichtig");
  assert.deepEqual(labels(r.found), ["Scope / Reichweite"]);

  const src = keywords("Porter", "*Porter* (vgl. Lehrbuch S. 12)");
  assert.deepEqual(labels(src.found), ["Porter"]);
});

test("Zahlen müssen genau stimmen", () => {
  const r = keywords("Das war 1995", "Porters Buch erschien *1996*");
  assert.equal(r.found.length, 0);
});

test("automatische Begriffe: höchstens 7, Fachbegriffe bevorzugt, 60 % für „Gut“", () => {
  const answer = "Die Photosynthese wandelt Lichtenergie mithilfe von Chlorophyll in chemische Energie um, dabei entsteht Sauerstoff aus Wasser und Kohlendioxid";
  const all = keywords("", answer);
  assert.equal(all.marked, false);
  assert.ok(all.found.length + all.missing.length <= 7);
  assert.ok(labels(all.missing).includes("Photosynthese"));

  const good = keywords("Photosynthese Lichtenergie Chlorophyll Sauerstoff Kohlendioxid", answer);
  assert.ok(good.ratio >= 0.6, `Anteil ${good.ratio}`);
  assert.equal(good.verdict, "right");
});

test("Wortendungen und kleine Tippfehler in langen Antworten werden toleriert", () => {
  assert.equal(run(`wordHit("chemisch", ["chemischen"])`), true);
  assert.equal(run(`wordHit("strategie", ["stratgie"])`), true);
  assert.equal(run(`wordHit("rom", ["rim"])`), false);
});

test("andere Wortformen zählen: Verbformen, Partizip mit ge-, Ableitungen, unregelmäßige Verben", () => {
  const hit = (kw, w) => run(`wordHit(${JSON.stringify(kw)}, [${JSON.stringify(w)}])`);
  assert.equal(hit("combined", "combining"), true);
  assert.equal(hit("handeln", "gehandelt"), true);
  assert.equal(hit("organisation", "organisatorisch"), true);
  assert.equal(hit("buy", "bought"), true);
  assert.equal(hit("skalieren", "skaliert"), true);
  // Different words stay different.
  assert.equal(hit("position", "positiv"), false);
  assert.equal(hit("strategie", "strategisch"), false);
  assert.equal(hit("buy", "bug"), false);
});

test("zusammengesetzte Begriffe zählen auch, wenn beide Teile getrennt vorkommen", () => {
  const r = keywords("Es gibt keinen Vorteil im Wettbewerb", "IT bietet keinen nachhaltigen *Wettbewerbsvorteil*");
  assert.deepEqual(labels(r.found), ["Wettbewerbsvorteil"]);
  assert.equal(keywords("ein Wettbewerbsnachteil", "*Wettbewerbsvorteil*").found.length, 0);
});

test("Synonyme mit |: zählen beim Prüfen, werden aber nicht angezeigt", () => {
  assert.equal(run(`plain("besser als **Konkurrenten|Mitbewerber** und Kunden|Abnehmer")`), "besser als Konkurrenten und Kunden");
  assert.equal(run(`richText("**where to play|where do we play**")`), '<mark class="kw">where to play</mark>');
  // marked term
  const m = keywords("Die Mitbewerber machen es schlechter", "Tätigkeiten besser als *Konkurrenten|Mitbewerber* ausführen");
  assert.deepEqual(labels(m.found), ["Konkurrenten / Mitbewerber"]);
  // phrase as synonym inside a marked term
  assert.equal(keywords("the markets we compete in", "**where to play|where to compete** and **how to win**").found.length, 1);
  // automatic terms
  const long = "Operative Effizienz bedeutet, ähnliche Tätigkeiten besser als Konkurrenten|Mitbewerber auszuführen, Best Practices führen zu Konvergenz.";
  const a = keywords("Tätigkeiten besser als die Mitbewerber", long);
  assert.ok(labels(a.found).includes("Konkurrenten / Mitbewerber"));
  // short answers
  assert.equal(check("Gebäude", run(`withAlts("Haus|Gebäude")`)).verdict, "right");
});

test("„Zählt doch“: ein Wort aus der Antwort wird als Synonym auf der Karte gespeichert", async () => {
  const card = { i: "s1", f: "Was ist operative Effizienz?", b: "Ähnliche Tätigkeiten besser als *Konkurrenten* ausführen, *Best Practices* kopieren.", c: 0, x: false, sf: null, sr: null };
  run(`state.decks = [{ id: "syn", name: "S", dir: "f", mode: "type", newPerDay: 5, retention: 0.9, newDay: "", newCount: 0, revDay: "", revCount: 0, chunks: 1, cardCount: 1 }];
    state.cards = { syn: [${JSON.stringify(card)}] }; state.session = null;`);
  await run(`startStudy("syn")`);
  run(`submitTyped("Dinge besser machen als die Mitbewerber, Best Practices nachmachen")`);
  assert.deepEqual(get(`state.session.answer.missing.map(k => k.label)`), ["Konkurrenten"]);
  run(`state.session.kwPick = 0`);
  const html = get(`studyHTML()`);
  assert.match(html, /data-act="kw-accept" data-w="Mitbewerber"/);
  assert.doesNotMatch(html, /data-w="Best"/, "Wörter, die schon zählen, stehen nicht zur Wahl");
  run(`acceptSynonym("Mitbewerber")`);
  assert.equal(get(`state.cards.syn[0].b`), "Ähnliche Tätigkeiten besser als *Konkurrenten|Mitbewerber* ausführen, *Best Practices* kopieren.");
  assert.equal(get(`state.session.answer.verdict`), "right");
  assert.equal(get(`state.session.answer.suggest`), 3);
  assert.equal(get(`state.session.kwPick`), null);
  run(`exitStudy()`);
});

test("„Zählt doch“ bei automatisch gewählten Begriffen: Synonym direkt hinter dem Wort", async () => {
  const back = "Operative Effizienz bedeutet, ähnliche Tätigkeiten besser als Konkurrenten auszuführen (Best Practices kopieren, führt zu Konvergenz).";
  run(`state.cards = { syn: [${JSON.stringify({ i: "s2", f: "Operative Effizienz?", b: back, c: 0, x: false, sf: null, sr: null })}] }; state.session = null;`);
  await run(`startStudy("syn")`);
  run(`submitTyped("Tätigkeiten besser machen als die Mitbewerber")`);
  const i = get(`state.session.answer.missing.findIndex(k => k.label === "Konkurrenten")`);
  assert.ok(i >= 0);
  run(`state.session.kwPick = ${i}; acceptSynonym("Mitbewerber")`);
  assert.match(get(`state.cards.syn[0].b`), /besser als Konkurrenten\|Mitbewerber auszuführen/);
  assert.ok(get(`state.session.answer.found.map(k => k.label)`).includes("Konkurrenten / Mitbewerber"));
  assert.equal(get(`plain(state.cards.syn[0].b)`), back);
  run(`exitStudy()`);
});
