// Language: every text in the app has an English version, and switching works.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadApp, json } from "./load-app.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
// The app script without comments, so examples in comments don't count as texts.
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1]
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const STR = String.raw`"((?:[^"\\]|\\.)*)"`;
const unq = s => JSON.parse(`"${s}"`);
const keysInCode = () => {
  const keys = new Set();
  for (const m of code.matchAll(new RegExp(String.raw`\bT\(\s*` + STR, "g"))) keys.add(unq(m[1]));
  for (const m of code.matchAll(new RegExp(String.raw`\bTn\([^"]*?` + STR + String.raw`,\s*` + STR, "g"))) { keys.add(unq(m[1])); keys.add(unq(m[2])); }
  return keys;
};
const placeholders = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

let app;
before(async () => { app = await loadApp(); });
after(() => app.run(`setLang("de")`));

test("jeder Text in T() und Tn() hat eine englische Fassung", () => {
  const en = app.get("EN"), missing = [...keysInCode()].filter(k => en[k] == null);
  assert.deepEqual(missing, []);
  // Every T( call starts with a plain "…" text, otherwise the check above would miss it.
  // Texts from the lists (grades, boxes, badges …) are checked in the next test.
  const LISTS = /^T\((s, vars|n === 1 \? one|GRADE\[|FAECHER\[|p\.tier\.name|next\.name|b\.name|b\.hint|d\.delimName|ENGINE|label$)/;
  const dynamic = [...code.matchAll(/\bT\(\s*[^"\s)][^)]{0,20}/g)].map(m => m[0]).filter(c => !LISTS.test(c));
  assert.deepEqual(dynamic, [], "T() bitte immer mit \"Text\" aufrufen");
  assert.equal([...code.matchAll(/\bTn\(/g)].length, [...code.matchAll(new RegExp(String.raw`\bTn\([^"]*?` + STR + String.raw`,\s*` + STR, "g"))].length, "Tn() mit zwei Texten aufrufen");
});

test("Listen mit Texten (Bewertungen, Fächer, Abzeichen …) sind übersetzt", () => {
  const en = app.get("EN");
  const texts = app.get(`[...GRADE.filter(Boolean), ...FAECHER.flatMap(f => [f.name, f.sub]), ...TIERS.map(t => t.name),
    ...BADGES.flatMap(b => [b.name, b.hint]), ...DELIMS.map(d => d[1]), ...DIRS.map(d => d[1]), ...MODES.map(m => m[1]), ENGINE]`);
  assert.deepEqual(texts.filter(k => en[k] == null), []);
});

test("englische Texte haben dieselben Platzhalter und keine übrigen Einträge", () => {
  const en = app.get("EN"), used = keysInCode();
  for (const k of app.get(`[...GRADE.filter(Boolean), ...FAECHER.flatMap(f => [f.name, f.sub]), ...TIERS.map(t => t.name), ...BADGES.flatMap(b => [b.name, b.hint]), ...DELIMS.map(d => d[1]), ...DIRS.map(d => d[1]), ...MODES.map(m => m[1]), "FSRS-6 über die offizielle Bibliothek ts-fsrs", "FSRS-5 (eingebaute Version, ts-fsrs fehlt: einmal npm install ausführen)"]`)) used.add(k);
  for (const [k, v] of Object.entries(en)) assert.deepEqual(placeholders(v), placeholders(k), `Platzhalter in „${k}“`);
  assert.deepEqual(Object.keys(en).filter(k => !used.has(k)), [], "Einträge, die nirgends mehr gebraucht werden");
});

test("Umschalten: Texte, Mehrzahl, Zeiten und Prozent", () => {
  app.run(`setLang("en")`);
  assert.equal(app.run(`T("Abbrechen")`), "Cancel");
  assert.equal(app.run(`Tn(1, "{n} Karte", "{n} Karten")`), "1 card");
  assert.equal(app.run(`Tn(3, "{n} Karte", "{n} Karten")`), "3 cards");
  assert.equal(app.run(`fmtDur(3 * 86400000)`), "3 days");
  assert.equal(app.run(`fmtDur(45 * 86400000)`), "1.5 mo");
  assert.equal(app.run(`pct(0.9)`), "90%");
  app.run(`setLang("de")`);
  assert.equal(app.run(`T("Abbrechen")`), "Abbrechen");
  assert.equal(app.run(`fmtDur(45 * 86400000)`), "1,5 Mon.");
  assert.equal(app.run(`pct(0.9)`), "90 %");
  app.run(`setLang("xx")`);
  assert.equal(app.run("LANG"), "de", "unbekannte Sprache wird ignoriert");
});

test("Einstellungsrädchen: Theme und Sprache wählbar", () => {
  app.run(`state.uiOpen = true; state.decks = []; state.topics = []; state.cards = {};`);
  const page = app.run("homeHTML()");
  assert.match(page, /data-act="ui-settings"/);
  assert.match(page, /name="ui-theme" value="dark"/);
  assert.match(page, /name="ui-lang" value="en"/);
  app.run(`setTheme("dark")`);
  assert.equal(app.run("THEME"), "dark");
  app.run(`setTheme("system"); state.uiOpen = false;`);
});

test("auf Englisch bleibt kein deutscher Text auf den wichtigsten Seiten", async () => {
  const now = Date.now(), DAY = 86400000;
  const st = { q: 2, s: 5, d: 5, due: now - DAY, last: now - 6 * DAY, reps: 3, lapses: 5, step: 0 };
  app.run(`state.topics = normTopics(${json([{ id: "t1", name: "Strategy", created: 1, color: 0 }])});
    state.decks = ${json([{ id: "a", name: "Porter", dir: "f", mode: "type", newPerDay: 5, retention: 0.9, newDay: "", newCount: 0, revDay: "", revCount: 0, chunks: 1, cardCount: 2, topic: "t1" }])};
    state.cards = { a: ${json([{ i: "c1", f: "What is X?", b: "A *strategy* tool", c: 0, x: false, sf: st, sr: null }, { i: "c2", f: "Y?", b: "Z", c: 0, x: false, sf: null, sr: null }])} };
    state.session = null; state.home = "today"; state.uiOpen = true; setLang("en");`);
  const pages = [
    app.run("homeHTML()"),
    app.run(`state.home = "t1"; homeHTML()`),
    app.run(`statsHTML(deckById("a"))`),
    app.run(`settingsHTML(deckById("a"))`),
    app.run(`openCardList("a"); cardsHTML(deckById("a"))`),
    app.run(`howHTML()`)
  ];
  await app.run(`startStudy("a")`);
  pages.push(app.run(`studyHTML()`));
  app.run(`submitTyped("a strategy"); state.session.revealed = true;`);
  pages.push(app.run(`studyHTML()`));
  app.run(`exitStudy(); setLang("de")`);
  const text = pages.join(" ").replace(/<[^>]+>/g, " ");
  const german = text.match(/\b(fällig|Karten?|Stapel|Thema|Themen|Lernen|lernen|Einstellungen|Abbrechen|heute|Heute|neu|Antwort|Fortschritt|Bearbeiten|Löschen|Speichern)\b/g);
  assert.equal(german, null, "deutsche Wörter in der englischen Ansicht: " + (german || []).join(", "));
});
