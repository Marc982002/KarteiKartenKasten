// More new cards once today's new cards sit: when the offer appears, its brakes, and how a pack is put together.
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loadApp, json } from "./load-app.js";

const MIN = 60000;
let app;
before(async () => { app = await loadApp(); });

/**
 * One deck with a limit of 4 new cards a day. 'today' lists cards started today:
 * { learned: true|false, repeats: [grades after the first answer] }.
 */
function setup({ newPerDay = 4, newCount = 4, bonus = 0, today = [], unseen = 6, fronts = null, topic = null } = {}) {
  const now = Date.now(), day = app.run("dayKey()");
  const cards = [];
  today.forEach((t, i) => cards.push({ i: "s" + i, f: "Gestartet " + i, b: "x", c: 0, x: false, sr: null,
    sf: { q: t.learned ? 2 : 1, s: 1, d: 5, due: now + (t.learned ? 86400000 : 10 * MIN), last: now - MIN, reps: 1 + t.repeats.length, lapses: 0, step: 0 } }));
  for (let i = 0; i < unseen; i++) cards.push({ i: "n" + i, f: fronts ? fronts[i] : "Neu " + i, b: "y", c: 0, x: false, sf: null, sr: null });
  const deck = { id: "d1", name: "Test", dir: "f", mode: "flip", newPerDay, retention: 0.9, newDay: day, newCount, revDay: day, revCount: 0,
    bonusDay: day, bonus, chunks: 1, cardCount: cards.length, topic: topic ? "t1" : null };
  app.run(`state.decks = [${json(deck)}]; state.cards = { d1: ${json(cards)} }; state.attempts = new Map(); SYNC.seen.clear();
    state.topics = ${json(topic ? [topic] : [])}; state.session = null;`);
  today.forEach((t, i) => {
    const start = now - 30 * MIN;
    app.run(`addAttempt(${json(["s" + i, "f", 3, start, "d1"])})`);
    t.repeats.forEach((g, k) => app.run(`addAttempt(${json(["s" + i, "f", g, start + (k + 1) * MIN, "d1"])})`));
  });
}
const offer = () => app.get("extraOffer(state.decks)");
const learned = n => Array.from({ length: n }, () => ({ learned: true, repeats: [3] }));
const learning = n => Array.from({ length: n }, () => ({ learned: false, repeats: [3] }));
beforeEach(() => setup());

test("kein Angebot, solange die regulären neuen Karten von heute noch offen sind", () => {
  setup({ newCount: 2, today: learned(2) });
  assert.equal(offer(), null);
});

test("kein Angebot, wenn neue Karten im Stapel ausgeschaltet sind oder keine mehr übrig", () => {
  setup({ newPerDay: 0, newCount: 0 });
  assert.equal(offer(), null);
  setup({ today: learned(4), unseen: 0 });
  assert.equal(offer(), null);
});

test("Angebot ab drei Vierteln gelernt, höchstens 5 und nicht mehr als das Tageslimit noch einmal", () => {
  setup({ today: [...learned(3), ...learning(1)] });
  const o = offer();
  assert.equal(o.ok, true);
  assert.equal(o.n, 4, "Tageslimit 4: höchstens 4 zusätzlich");
  setup({ newPerDay: 20, newCount: 20, today: [...learned(15), ...learning(5)], unseen: 30 });
  assert.equal(offer().n, 5);
});

test("noch nicht: unter drei Vierteln gelernt", () => {
  setup({ today: [...learned(2), ...learning(2)] });
  const o = offer();
  assert.equal(o.ok, false);
  assert.equal(o.reason, "wait");
  assert.match(app.run(`extraOfferHTML(extraOffer(state.decks), state.decks)`), /2 von 4 neuen Karten sitzen/);
});

test("Bremse: Wiederholungen in der Lernphase liefen heute unter 70 %", () => {
  // 4 gelernt, aber von 8 Wiederholungen nur 4 richtig (50 %)
  setup({ today: learned(4).map(() => ({ learned: true, repeats: [1, 3] })) });
  const o = offer();
  assert.equal(o.ok, false);
  assert.equal(o.reason, "hard");
  assert.equal(o.hitRate, 0.5);
});

test("Bremse greift erst ab 6 Wiederholungen, vorher sagt die Quote zu wenig", () => {
  setup({ today: [{ learned: true, repeats: [1, 3] }, { learned: true, repeats: [1, 3] }, ...learned(1)] , newCount: 3, newPerDay: 3 });
  assert.equal(offer().ok, true);
});

test("Bremse: heute schon doppelt so viele neue Karten wie das Tageslimit", () => {
  setup({ bonus: 4, newCount: 8, today: learned(8) });
  const o = offer();
  assert.equal(o.ok, false);
  assert.equal(o.reason, "double");
});

test("ein Päckchen erhöht das heutige Limit und nimmt nur ungesehene Karten", () => {
  setup({ today: learned(4) });
  const picked = app.get(`pickExtra(state.decks, 4).map(u => u.card.i)`);
  assert.deepEqual(picked, ["n0", "n1", "n2", "n3"]);
  assert.equal(app.get("state.decks[0].bonus"), 4);
  assert.equal(app.get("buildQueue(state.decks[0]).nNew"), 4, "die Lernrunde kennt die zusätzlichen Karten");
});

test("Karten aus verschiedenen Zweigen des Themenbaums kommen abwechselnd", () => {
  const topic = { id: "t1", name: "Strategie", created: 1, pins: {},
    outline: { title: "Strategie", children: [{ id: "a", label: "Porter Wettbewerb", children: [] }, { id: "b", label: "Teece Capabilities", children: [] }] } };
  const fronts = ["Porter: Fünf Kräfte", "Porter: Wertkette", "Porter: Generische Strategien", "Teece: Dynamic Capabilities", "Teece: Sensing", "Teece: Seizing"];
  setup({ newPerDay: 10, newCount: 4, today: learned(4), fronts, topic });
  const picked = app.get(`pickExtra(state.decks, 4).map(u => u.card.f.split(":")[0])`);
  assert.deepEqual(picked, ["Porter", "Teece", "Porter", "Teece"]);
});

test("Preis: geschätzte Wiederholungen in den nächsten 7 Tagen", () => {
  setup({ today: learned(4) });
  const perCard = app.run("reviewsPerNewCard(state.decks)");
  assert.ok(perCard >= 1 && perCard <= 6, `pro Karte ${perCard}`);
  assert.match(app.run(`extraOfferHTML(extraOffer(state.decks), state.decks)`), /etwa \d+ Wiederholungen in den nächsten 7 Tagen/);
});

test("Lernrunde: Päckchen annehmen streut die Karten zwischen die Karten in der Lernphase", () => {
  setup({ today: [...learned(3), ...learning(1)] });
  app.run(`startSession(state.decks, "Test")`); // nur noch eine Karte in der Lernphase
  assert.match(app.run("studyHTML()"), /neue Karten aufnehmen/, "Angebot erscheint in der Runde");
  app.run("addExtraNew()");
  const s = app.get("({ main: state.session.main.length, current: state.session.current?.card.i, finished: state.session.finished })");
  assert.equal(s.finished, false);
  assert.equal(s.main + (s.current?.startsWith("n") ? 1 : 0), 4, "4 neue Karten in der Runde");
  assert.doesNotMatch(app.run("studyHTML()"), /neue Karten aufnehmen/, "kein zweites Angebot, solange das Päckchen läuft");
});

test("aus der Übersicht: „weitere neue“ startet direkt mit einem Päckchen", () => {
  setup({ today: learned(4) });
  app.run(`startSession(state.decks, "Test", null, { extra: true })`);
  assert.equal(app.get("state.view"), "study");
  assert.ok(app.get("state.session.current.card.i").startsWith("n"));
});
