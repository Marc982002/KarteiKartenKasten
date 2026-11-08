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
