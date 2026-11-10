// Defaults for new decks (gear → "Neue Stapel starten mit") and putting them on existing decks.
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadApp, json } from "./load-app.js";

let app;
before(async () => { app = await loadApp(); });
afterEach(() => app.run(`state.profile.prefs = normPrefs(); applyPrefs(); state.decks = []; state.cards = {}; state.topics = []; state.draft = null;`));

test("ohne Einstellung: dieselben Werte wie bisher", () => {
  assert.deepEqual(app.get("prefs().deck"), { newPerDay: 20, dir: "f", mode: "auto", retention: 0.9 });
});

test("ungültige Werte werden begrenzt", () => {
  assert.deepEqual(app.get(`normPrefs({ deck: { newPerDay: 9999, dir: "x", mode: "?", retention: 2 } }).deck`),
    { newPerDay: 500, dir: "f", mode: "auto", retention: 0.97 });
  assert.equal(app.get(`normPrefs({ deck: { retention: 0.5 } }).deck.retention`), 0.75);
});

test("ein neuer Stapel startet mit den Standardwerten", () => {
  app.run(`setDeckPref("newPerDay", 7); setDeckPref("dir", "b"); setDeckPref("mode", "type"); setDeckPref("retention", 0.93);`);
  app.run(`openImportText("a;b\\nc;d", "x.csv"); doImport();`);
  assert.deepEqual(app.get(`(({ newPerDay, dir, mode, retention }) => ({ newPerDay, dir, mode, retention }))(state.decks[0])`),
    { newPerDay: 7, dir: "b", mode: "type", retention: 0.93 });
});

test("übertragen: nur auf die gewählten Stapel, Richtung bleibt", () => {
  const deck = (id, topic) => ({ id, name: id, dir: "r", mode: "flip", newPerDay: 3, retention: 0.8, topic, newDay: "", newCount: 0, revDay: "", revCount: 0, chunks: 0, cardCount: 0 });
  app.run(`state.topics = normTopics(${json([{ id: "t", name: "T", created: 1 }])}); state.decks = ${json([deck("a", "t"), deck("b", null)])}; state.cards = { a: [], b: [] };`);
  app.run(`setDeckPref("newPerDay", 12); setDeckPref("mode", "type"); setDeckPref("dir", "b");`);
  assert.equal(app.run(`applyDeckDefaults(decksOfTopic("t"))`), 1);
  assert.deepEqual(app.get(`state.decks.map(d => [d.id, d.newPerDay, d.mode, d.retention, d.dir])`), [["a", 12, "type", 0.9, "r"], ["b", 3, "flip", 0.8, "r"]]);
});

test("das Rädchen zeigt Standardwerte und fragt vor dem Übertragen nach", () => {
  app.run(`state.decks = ${json([{ id: "a", name: "a", dir: "f", mode: "auto", newPerDay: 20, retention: 0.9, newDay: "", newCount: 0, revDay: "", revCount: 0, chunks: 0, cardCount: 0 }])}; state.cards = { a: [] }; state.uiOpen = true;`);
  assert.match(app.run("uiSettingsHTML()"), /id="pref-new"[\s\S]*data-act="pref-apply"/);
  app.run(`state.applyDefaults = { scope: "all", confirm: true }`);
  assert.match(app.run("uiSettingsHTML()"), /data-act="pref-apply-yes"/);
  app.run(`state.uiOpen = false; state.applyDefaults = null;`);
});
