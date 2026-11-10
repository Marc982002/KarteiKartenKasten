// Several subjects: tabs, archive, colours and "Alles lernen" one subject after another.
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loadApp, json } from "./load-app.js";

const DAY = 86400000;
let app;
before(async () => { app = await loadApp(); });

const review = daysOverdue => { const now = Date.now(); return { q: 2, s: 5, d: 5, due: now - daysOverdue * DAY, last: now - (daysOverdue + 5) * DAY, reps: 3, lapses: 0, step: 0 }; };
const deck = (id, topic) => ({ id, name: "Set " + id, dir: "f", mode: "flip", newPerDay: 0, retention: 0.9, newDay: "", newCount: 0, revDay: "", revCount: 0, chunks: 1, cardCount: 3, topic });
const cards = (prefix, n, overdue) => Array.from({ length: n }, (_, i) => ({ i: prefix + i, f: prefix + " Frage " + i, b: "x", c: 0, x: false, sf: review(overdue), sr: null }));

beforeEach(() => {
  // Finanzen-Karten sind länger überfällig: würde man alles mischen, kämen sie zuerst.
  const topics = [{ id: "dis", name: "Strategie", created: 1, color: 0 }, { id: "fin", name: "Finanzen", created: 2, color: 1 }, { id: "alt", name: "Altes Fach", created: 3, color: 2, archived: true }];
  app.run(`state.topics = normTopics(${json(topics)});
    state.decks = ${json([deck("a", "dis"), deck("b", "fin"), deck("c", "alt"), deck("d", null)])};
    state.cards = { a: ${json(cards("A", 3, 1))}, b: ${json(cards("B", 3, 30))}, c: ${json(cards("C", 3, 30))}, d: ${json(cards("D", 2, 1))} };
    state.session = null; state.home = "today";`);
});

test("„Alles lernen“ geht Thema für Thema, Archiv bleibt draußen", async () => {
  await app.run("startAll()");
  const order = app.get("[state.session.current, ...state.session.main].map(u => u.card.i[0])");
  assert.deepEqual(order, ["A", "A", "A", "B", "B", "B", "D", "D"], "erst Strategie, dann Finanzen, dann ohne Thema; kein archiviertes Fach");
});

test("archivierte Themen zählen nicht für „Alles erledigt“", () => {
  app.run(`for (const d of state.decks) if (d.id !== "c") for (const c of state.cards[d.id]) c.sf.due = Date.now() + 5 * ${DAY};`);
  assert.equal(app.run("allCleared()"), true, "nur das Archiv hat noch Fälliges");
});

test("Startseite: Reiter pro Thema, Zeilen mit Zahlen, Archiv als Zusammenfassung", () => {
  const html = app.run("homeHTML()");
  assert.match(html, /data-act="home" data-id="dis"/);
  assert.match(html, /data-act="home" data-id="archive"[^>]*>Archiv/);
  assert.doesNotMatch(html, /data-act="home" data-id="alt"/, "archiviertes Thema hat keinen eigenen Reiter");
  assert.match(html, /Alles lernen/);
  assert.match(html, /Altes Fach · ruht/);
  assert.match(html, /etwa \d+ Min\./);
});

test("Reiter eines Themas zeigt nur dessen Sets", () => {
  app.run(`setHome("fin")`);
  const html = app.run("homeHTML()");
  assert.match(html, /Set b/);
  assert.doesNotMatch(html, /Set a/);
  app.run(`setHome("gibt-es-nicht")`);
  assert.equal(app.run("homeTab()"), "today", "unbekannter Reiter fällt auf „Heute“ zurück");
});

test("Farben und Archiv werden gespeichert", async () => {
  app.run(`state.topics[0].color = 5; state.topics[1].archived = true; saveTopics();`);
  await app.run("flush()");
  const list = JSON.parse(JSON.stringify((await app.run(`state.store.getDoc("topics")`)).list));
  assert.equal(list[0].color, 5);
  assert.equal(list[1].archived, true);
});

test("neue Themen bekommen eine freie Farbe, alte ohne Farbe eine feste", () => {
  assert.equal(app.run("nextColor()"), 3);
  const normed = app.get(`normTopics(${json([{ id: "x", name: "X" }, { id: "y", name: "Y" }])}).map(t => t.color)`);
  assert.deepEqual(normed, [0, 1]);
});

test("Lernzeit: Antwortdauer aus dem Verlauf, sonst 15 Sekunden", () => {
  app.run("state.attempts = new Map(); SYNC.seen.clear();");
  assert.equal(app.run("secondsPerAnswer()"), 15);
  assert.equal(app.run(`minutesFor([{ nRev: 20, nLearn: 0, nNew: 0 }])`), 5);
  app.run(`for (let i = 0; i < 20; i++) addAttempt(["k" + i, "f", 3, Date.now() - i * 1000, "a", { ms: 6000 }]);`);
  assert.equal(app.run("secondsPerAnswer()"), 6);
  assert.equal(app.run(`minutesFor([{ nRev: 10, nLearn: 0, nNew: 0 }])`), 1);
});
