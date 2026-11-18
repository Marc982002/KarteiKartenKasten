// Learning towards an exam date: reviews never land after the exam, enough new cards per day, back to normal afterwards.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { loadApp, json } from "./load-app.js";

const DAY = 86400000;
let app;
before(async () => { app = await loadApp(); });

// The learning day n days from today as "YYYY-MM-DD".
const isoIn = n => app.get(`dayKey(Date.now() + ${n} * DAY)`);
/** One topic with one deck: 'unseen' new cards, 'learned' cards with a long interval. */
function setup({ exam = null, newPerDay = 10, unseen = 100, learned = 0, newCount = 0 } = {}) {
  const now = Date.now(), day = app.run("dayKey()"), cards = [];
  for (let i = 0; i < learned; i++) cards.push({ i: "l" + i, f: "Alt " + i, b: "x", c: 0, x: false, sr: null,
    sf: { q: 2, s: 60, d: 5, due: now + 60 * DAY, last: now - DAY, reps: 4, lapses: 0, step: 0 } });
  for (let i = 0; i < unseen; i++) cards.push({ i: "n" + i, f: "Neu " + i, b: "y", c: 0, x: false, sf: null, sr: null });
  const deck = { id: "d1", name: "Test", dir: "f", mode: "flip", newPerDay, retention: 0.9, newDay: day, newCount, revDay: day, revCount: 0,
    bonusDay: day, bonus: 0, chunks: 1, cardCount: cards.length, topic: "t1" };
  const topic = { id: "t1", name: "Statistik", created: now, color: 0, archived: false, exam };
  app.run(`state.decks = [${json(deck)}]; state.cards = { d1: ${json(cards)} }; state.attempts = new Map(); SYNC.seen.clear();
    state.topics = [${json(topic)}]; state.session = null;`);
}
const review = (due, s = 60) => ({ q: 2, s, d: 5, due, last: Date.now(), reps: 4, lapses: 0, step: 0 });

test("ohne Klausurdatum bleibt alles wie bisher", () => {
  setup();
  assert.equal(app.get("newLimit(state.decks[0])"), 10);
  assert.equal(app.get("buildQueue(state.decks[0]).nNew"), 10);
  assert.equal(app.get("examInfo(state.topics[0])"), null);
});

test("Plan: die letzte Zeit vor der Klausur ist nur Wiederholung (2 bis 7 Tage)", () => {
  setup();
  const plan = n => app.get(`examPlan(${json(isoIn(n))})`);
  assert.deepEqual([plan(30).daysLeft, plan(30).review, plan(30).newDays], [30, 6, 24]);
  assert.equal(plan(90).review, 7, "höchstens 7 Tage");
  assert.equal(plan(5).review, 2, "mindestens 2 Tage");
  assert.equal(plan(2).newDays, 2, "kurz vor der Klausur: neue Karten auf die übrigen Tage verteilt");
  assert.equal(plan(0).daysLeft, 0);
  assert.equal(plan(0).newDays, 1);
});

test("neue Karten: genug pro Tag, damit vor der Wiederholungsphase alle angefangen sind", () => {
  setup({ exam: isoIn(30), unseen: 240 }); // 24 Tage für neue Karten
  assert.equal(app.get("newLimit(state.decks[0])"), 10, "240 / 24 = 10, das eigene Limit reicht genau");
  setup({ exam: isoIn(30), unseen: 480 });
  assert.equal(app.get("newLimit(state.decks[0])"), 20, "doppelt so viele Karten, doppeltes Tempo");
  assert.equal(app.get("buildQueue(state.decks[0]).nNew"), 20);
  setup({ exam: isoIn(30), unseen: 20 });
  assert.equal(app.get("newLimit(state.decks[0])"), 10, "das eigene Limit ist die Untergrenze");
  setup({ exam: isoIn(30), unseen: 480, newPerDay: 0 });
  assert.equal(app.get("newLimit(state.decks[0])"), 0, "ausgeschaltete neue Karten bleiben aus");
});

test("schon heute angefangene Karten zählen mit, das Tempo bleibt über den Tag gleich", () => {
  setup({ exam: isoIn(30), unseen: 460, newCount: 20 });
  assert.equal(app.get("newLimit(state.decks[0])"), 20);
  assert.equal(app.get("buildQueue(state.decks[0]).nNew"), 0, "heute schon 20 neue: fertig");
});

test("keine Wiederholung am oder nach dem Klausurtag, sondern in den letzten 3 Tagen davor", () => {
  setup({ exam: isoIn(20) });
  const iso = isoIn(20), start = app.get(`dayStartOf(${json(iso)})`), now = Date.now();
  for (const id of ["a", "b", "c", "d", "e", "f"]) {
    const capped = app.get(`examCap(${json(review(now + 60 * DAY))}, ${json(iso)}, ${json(id)}, Date.now())`);
    assert.ok(capped.due < start, "vor der Klausur");
    assert.ok(capped.due >= start - 3 * DAY, "in den letzten 3 Tagen");
    assert.equal(capped.s, 60, "die Stabilität bleibt, nach der Klausur geht es normal weiter");
  }
  const early = review(now + 5 * DAY);
  assert.deepEqual(app.get(`examCap(${json(early)}, ${json(iso)}, "a", Date.now())`), early, "Termine vor der Klausur bleiben");
  const learning = { ...review(now + 60 * DAY), q: 1 };
  assert.deepEqual(app.get(`examCap(${json(learning)}, ${json(iso)}, "a", Date.now())`), learning, "Karten in der Lernphase bleiben");
});

test("Klausur morgen: eine gerade gelernte Karte bleibt, wie FSRS sie plant", () => {
  setup({ exam: isoIn(1) });
  const st = review(Date.now() + 10 * DAY);
  assert.deepEqual(app.get(`examCap(${json(st)}, ${json(isoIn(1))}, "a", Date.now())`), st);
});

test("Bewerten: die Knöpfe zeigen den gekappten Termin, der Stempel sagt warum", () => {
  setup({ exam: isoIn(10), unseen: 0, learned: 1 });
  const start = app.get(`dayStartOf(${json(isoIn(10))})`);
  app.run(`state.cards.d1[0].sf.due = Date.now() - 1000; startSession(state.decks, "Test");
    const s = state.session; s.mode = "flip"; s.revealed = true;`);
  const pv = app.get("previewFor(state.session)");
  assert.ok(pv.o[3].due < start, "Leicht landet vor der Klausur");
  assert.equal(pv.capped[3], true);
  assert.equal(pv.capped[0], false, "Nochmal bleibt in der Lernphase");
  app.run("rate(4)");
  assert.ok(app.get("state.cards.d1[0].sf.due") < start);
  assert.equal(app.get("state.session.stamp.title"), "Vor der Klausur");
});

test("nach der Klausur ist das Thema wieder normal", () => {
  setup({ exam: isoIn(-1), unseen: 480 });
  assert.equal(app.get("examOf(state.decks[0])"), null);
  assert.equal(app.get("newLimit(state.decks[0])"), 10);
  assert.equal(app.get("examInfo(state.topics[0]).past"), true);
});

test("Übersicht zum Thema: Tage, Tempo und Minuten", () => {
  setup({ exam: isoIn(30), unseen: 480, learned: 30 });
  const x = app.get("examInfo(state.topics[0])");
  assert.equal(x.daysLeft, 30);
  assert.equal(x.perDay, 20);
  assert.ok(x.mins > 0);
  assert.match(app.get("examHTML(state.topics[0])"), /noch 30 Tage/);
  setup({ exam: isoIn(30), unseen: 0, learned: 30 });
  assert.match(app.get("examHTML(state.topics[0])"), /Alle Karten sind angefangen/);
});

test("Klausurdatum wird mit dem Thema gespeichert, ungültige Werte nicht", () => {
  setup({ exam: "2027-02-16" });
  assert.equal(app.get("validExam('2027-02-16')"), "2027-02-16");
  assert.equal(app.get("validExam('16.02.2027')"), null);
  assert.equal(app.get("validExam('')"), null);
});
