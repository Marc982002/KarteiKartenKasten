// Two devices on one server, both with the real app code: nothing may get lost.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadApp, json } from "./load-app.js";

const ROOT = new URL("../", import.meta.url);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let dataDir, server, base, A, B, ids;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "karteikasten-sync-"));
  const port = 40000 + Math.floor(Math.random() * 20000);
  base = `http://localhost:${port}`;
  server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: dataDir }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    let out = "";
    const t = setTimeout(() => reject(new Error("Server startet nicht: " + out)), 5000);
    server.stdout.on("data", d => { out += d; if (out.includes("läuft")) { clearTimeout(t); resolve(); } });
  });
  // Device A creates a deck, device B loads it.
  A = await device();
  A.run("loadSample()");
  await settle(A);
  B = await device();
  ids = cardsOf(B).map(c => c.i);
  assert.equal(ids.length, 20);
});
after(async () => {
  server.kill("SIGTERM");
  await new Promise(r => server.once("exit", r));
  await rm(dataDir, { recursive: true, force: true });
});

const device = () => loadApp({ server: base });
// Waits until everything this device queued is on the server.
async function settle(app) {
  for (let i = 0; i < 300; i++) {
    await app.run("flush()");
    if (app.run("!WQ.busy && !WQ.pending.size")) return;
    await sleep(10);
  }
  throw new Error("Gerät speichert nicht zu Ende");
}
// Answers the given cards of the first deck, one after another, with one grade.
function answer(app, ids, grade) {
  app.run(`(() => {
    const deck = state.decks.find(d => d.name.startsWith("Beispiel"));
    for (const id of ${json(ids)}) {
      const card = state.cards[deck.id].find(c => c.i === id);
      state.session = { deckIds: [deck.id], title: "Test", topicId: null, main: [{ card, dir: "f", deck }], learn: [], current: null, revealed: false,
        done: 0, first: new Map(), history: [], lastKey: null, started: Date.now(), finished: false, startFach: new Map(), lastMove: null, badges: [] };
      advance(); dontKnow(); rate(${grade});
    }
    state.session = null;
  })()`);
}
const deckOf = app => app.get(`state.decks.find(d => d.name.startsWith("Beispiel"))`);
const cardsOf = app => app.get(`state.cards[state.decks.find(d => d.name.startsWith("Beispiel")).id]`);
const card = (app, id) => cardsOf(app).find(c => c.i === id);


test("zwei Geräte lernen gleichzeitig verschiedene Karten: nichts geht verloren", async () => {
  answer(A, ids.slice(0, 3), 3);
  await settle(A);
  answer(B, ids.slice(3, 6), 3); // B kennt A's Antworten noch nicht
  await settle(B);

  const C = await device(); // frisch geladen = was auf dem Server steht
  for (const id of ids.slice(0, 6)) assert.ok(card(C, id).sf, `Lernstand von ${card(C, id).f} fehlt`);
  assert.equal(C.get("state.log.entries.length"), 6, "alle Antworten im Verlauf");
  assert.equal(C.get("state.profile.days[dayKey()]"), 6, "Tageszähler");
  assert.equal(deckOf(C).newCount, 6, "neue Karten heute");

  // B hat beim Zusammenführen A's Antworten übernommen, A holt sich B's beim nächsten Nachsehen.
  assert.ok(card(B, ids[0]).sf);
  await A.run("pullChanges({ quiet: true })");
  for (const id of ids.slice(3, 6)) assert.ok(card(A, id).sf, "A kennt B's Antworten");
});

test("dieselbe Karte auf beiden Geräten: die spätere Bewertung zählt, beide Antworten bleiben im Verlauf", async () => {
  await B.run("pullChanges({ quiet: true })");
  const id = ids[10];
  answer(A, [id], 1); // Nochmal
  await settle(A);
  await sleep(5);
  answer(B, [id], 4); // später: Leicht
  await settle(B);
  const C = await device();
  assert.equal(card(C, id).sf.q, 2, "Leicht (später) gewinnt: Karte ist gelernt");
  const grades = C.get(`state.log.entries.filter(e => e[0] === ${json(id)}).map(e => e[2])`);
  assert.deepEqual(grades, [1, 4]);
});

test("auf einem Gerät bearbeitet, auf dem anderen gelernt: beides bleibt", async () => {
  await A.run("pullChanges({ quiet: true })");
  await B.run("pullChanges({ quiet: true })");
  const id = ids[12];
  B.run(`(() => { const d = state.decks[0], c = state.cards[d.id].find(c => c.i === ${json(id)}); saveCardText(d, c, "Neue Frage", "Neue Antwort"); markChunk(d, c.c); })()`);
  await settle(B);
  answer(A, [id], 3); // A hat die alte Fassung vor sich
  await settle(A);
  const C = await device();
  assert.equal(card(C, id).f, "Neue Frage");
  assert.ok(card(C, id).sf, "Lernstand von A");
});

test("offener Tab holt sich Einstellungen, neue und gelöschte Stapel", async () => {
  await A.run("pullChanges({ quiet: true })");
  await B.run("pullChanges({ quiet: true })");
  B.run(`(() => { const d = state.decks[0]; d.newPerDay = 5; markMeta(d); })()`);
  B.run(`(() => { state.draft = { fileName: "x", name: "Zweiter Stapel", rows: [["a", "b"], ["c", "d"]], delimName: "Semikolon", header: false, fc: 0, bc: 1, targetId: null }; doImport(); })()`);
  await settle(B);
  // B lernt im neuen Stapel gleich eine Karte.
  B.run(`(() => { const deck = state.decks.find(d => d.name === "Zweiter Stapel"), card = state.cards[deck.id][0];
    state.session = { deckIds: [deck.id], title: "T", topicId: null, main: [{ card, dir: "f", deck }], learn: [], current: null, revealed: false, done: 0, first: new Map(), history: [], lastKey: null, started: Date.now(), finished: false, startFach: new Map(), lastMove: null, badges: [] };
    advance(); dontKnow(); rate(3); state.session = null; })()`);
  await settle(B);
  await A.run("pullChanges({ quiet: true })");
  assert.equal(deckOf(A).newPerDay, 5);
  const second = A.get(`state.decks.find(d => d.name === "Zweiter Stapel")`);
  assert.ok(second, "neuer Stapel ist da");
  assert.equal(A.get(`state.cards[${json(second.id)}].length`), 2);
  assert.equal(second.newCount, 1, "heute angefangen: einmal gezählt, nicht doppelt");
  assert.equal(second.revCount, 1);

  B.run(`(() => { const id = state.decks.find(d => d.name === "Zweiter Stapel").id; const chunks = deckById(id).chunks; queueWrite("x:" + id, () => state.store.delDeck(id, chunks), 0); state.decks = state.decks.filter(d => d.id !== id); delete state.cards[id]; })()`);
  await settle(B);
  await A.run("pullChanges({ quiet: true })");
  assert.equal(A.get(`state.decks.some(d => d.name === "Zweiter Stapel")`), false, "gelöschter Stapel ist weg");
});

test("eine rückgängig gemachte Antwort kommt beim Zusammenführen nicht zurück", async () => {
  await A.run("pullChanges({ quiet: true })");
  await B.run("pullChanges({ quiet: true })");
  const id = ids[15];
  answer(A, [id], 3);
  await settle(A); // die Antwort ist schon auf dem Server
  A.run("unrecordAnswer()");
  answer(B, [ids[16]], 3);
  await settle(B);
  await settle(A); // A schreibt den Verlauf ohne die Antwort, trifft auf B's Stand und führt zusammen
  const C = await device();
  const logged = C.get("state.log.entries.map(e => e[0])");
  assert.ok(!logged.includes(id), "zurückgenommene Antwort bleibt draußen");
  assert.ok(logged.includes(ids[16]), "B's Antwort ist da");
});
