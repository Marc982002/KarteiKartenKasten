// Which cards come up today, plus card upkeep (suspend, problem cards) and CSV export.
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loadApp, json } from "./load-app.js";

const MIN = 60000, DAY = 86400000;
let app;
before(async () => { app = await loadApp(); });

const deck = (extra = {}) => ({ id: "d1", name: "Test", dir: "f", mode: "auto", newPerDay: 20, retention: 0.9, newDay: "", newCount: 0, revDay: "", revCount: 0, chunks: 1, cardCount: 0, ...extra });
const card = (i, sf = null, extra = {}) => ({ i, f: "Frage " + i, b: "Antwort " + i, sf, sr: null, c: 0, x: false, ...extra });
const review = (dueInDays, s = 5, extra = {}) => { const now = Date.now(); return { q: 2, s, d: 5, due: now + dueInDays * DAY, last: now + dueInDays * DAY - s * DAY, reps: 3, lapses: 0, step: 0, ...extra }; };
const learning = (dueInMin) => ({ q: 1, s: 1, d: 5, due: Date.now() + dueInMin * MIN, last: Date.now(), reps: 1, lapses: 0, step: 1 });

function setup(d, cards) {
  app.run(`state.decks = [${json({ ...d, cardCount: cards.length })}]; state.cards = { d1: ${json(cards)} };`);
}
const queue = () => app.get(`(q => ({ main: q.main.map(u => u.card.i), learn: q.learn.map(u => u.card.i), nNew: q.nNew, nRev: q.nRev, unseen: q.unseen }))(buildQueue(state.decks[0]))`);
beforeEach(() => setup(deck(), []));

test("neue Karten: höchstens so viele wie das Tageslimit erlaubt", () => {
  setup(deck({ newPerDay: 2 }), [1, 2, 3, 4, 5].map(i => card("n" + i)));
  const q = queue();
  assert.equal(q.nNew, 2);
  assert.equal(q.unseen, 3);
  assert.deepEqual(q.main, ["n1", "n2"]);
});

test("neue Karten: was heute schon angefangen wurde, zählt aufs Limit", () => {
  const today = app.run("dayKey()");
  setup(deck({ newPerDay: 3, newDay: today, newCount: 3 }), [card("n1"), card("n2")]);
  assert.equal(queue().nNew, 0);
});

test("fällig: nur Karten, die bis heute Abend fällig sind; die wackeligste zuerst", () => {
  setup(deck(), [
    card("morgen", review(1.5)),
    card("leicht-überfällig", review(-0.5, 20)),
    card("lange-überfällig", review(-30, 5)),
  ]);
  const q = queue();
  assert.deepEqual(q.main, ["lange-überfällig", "leicht-überfällig"]);
  assert.equal(q.nRev, 2);
});

test("Lernphase: kommt in die eigene Liste, die nächste zuerst", () => {
  setup(deck(), [card("spaeter", learning(8)), card("gleich", learning(1))]);
  const q = queue();
  assert.deepEqual(q.learn, ["gleich", "spaeter"]);
  assert.deepEqual(q.main, []);
});

test("neue Karten werden zwischen die Wiederholungen gestreut", () => {
  setup(deck(), [card("w1", review(-3)), card("w2", review(-2)), card("w3", review(-1)), card("n1"), card("n2")]);
  const main = queue().main;
  assert.equal(main.length, 5);
  assert.notDeepEqual(main.slice(-2), ["n1", "n2"], "nicht alle neuen am Ende");
});

test("ausgesetzte Karten kommen nicht dran und zählen nicht zum Fortschritt", () => {
  setup(deck(), [card("aus-neu", null, { x: true }), card("aus-fällig", review(-1), { x: true }), card("normal", review(-1))]);
  const q = queue();
  assert.deepEqual(q.main, ["normal"]);
  assert.equal(q.unseen + q.nNew, 0);
  assert.equal(app.get("deckProgress(state.decks[0])").units, 1);
});

test("beide Richtungen: die Rückrichtung startet erst nach einem Tag", () => {
  const today = review(3);
  today.last = Date.now();
  const old = review(3);
  old.last = Date.now() - 3 * DAY;
  setup(deck({ dir: "b" }), [card("heute-gelernt", today), card("früher-gelernt", old)]);
  const q = app.get(`buildQueue(state.decks[0]).fresh.map(u => u.card.i + ":" + u.dir)`);
  assert.deepEqual(q, ["früher-gelernt:r"]);
});

test("Problemkarte ab 4-mal vergessen, in welcher Richtung auch immer", () => {
  assert.equal(app.run(`isLeech(${json(card("a", review(1, 5, { lapses: 3 })))})`), false);
  assert.equal(app.run(`isLeech(${json(card("b", review(1, 5, { lapses: 4 })))})`), true);
  assert.equal(app.run(`isLeech(${json({ ...card("c"), sr: review(1, 5, { lapses: 6 }) })})`), true);
});

test("Karte bearbeiten: leere Seiten und doppelte Vorderseiten werden abgelehnt", () => {
  setup(deck(), [card("a"), card("b")]);
  assert.equal(app.run(`saveCardText(state.decks[0], state.cards.d1[1], "Frage a", "x")`), false);
  assert.equal(app.run(`saveCardText(state.decks[0], state.cards.d1[1], "  ", "x")`), false);
  assert.equal(app.run(`saveCardText(state.decks[0], state.cards.d1[1], " Neu ", " Text ")`), true);
  assert.deepEqual(app.get(`[state.cards.d1[1].f, state.cards.d1[1].b]`), ["Neu", "Text"]);
});

test("CSV-Export lässt sich unverändert wieder einlesen", async () => {
  const tricky = [
    ["Semikolon; im Text", "Antwort mit \"Anführungszeichen\""],
    ["Zeilen\numbruch", "Komma, und Tab\tdrin"],
    ["Umlaute äöüß", "*markiert* bleibt"],
  ];
  setup(deck({ name: "Mein/Stapel: Test" }), tricky.map(([f, b], i) => ({ ...card("c" + i), f, b })));
  app.downloads.length = 0;
  app.run("exportCSV(state.decks[0])");
  const [{ name, blob }] = app.downloads;
  assert.equal(name, "Mein Stapel Test.csv", "Dateiname ohne verbotene Zeichen");
  const text = await blob.text();
  const back = app.get(`(t => { t = t.replace(/^\\uFEFF/, "").replace(/\\r\\n?/g, "\\n"); const [d] = detectDelim(t); return parseCSV(t, d); })(${JSON.stringify(text)})`);
  assert.deepEqual(back[0], ["Vorderseite", "Rückseite"]);
  assert.deepEqual(back.slice(1), tricky);
});
