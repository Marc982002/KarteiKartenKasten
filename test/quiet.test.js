// Quiet mode: no badges, streak or extra-card offers on screen; badges are still recorded.
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadApp, json } from "./load-app.js";

let app;
before(async () => { app = await loadApp(); });
afterEach(() => app.run(`state.profile.prefs = normPrefs(); applyPrefs(); state.decks = []; state.cards = {}; state.profile.badges = {}; state.profile.days = {};`));

const setup = () => app.run(`state.topics = []; state.decks = ${json([{ id: "a", name: "a", dir: "f", mode: "flip", newPerDay: 5, retention: 0.9, created: 1, newDay: "", newCount: 0, revDay: "", revCount: 0, chunks: 1, cardCount: 1 }])};
  state.cards = { a: ${json([{ i: "c1", f: "x", b: "y", c: 0, x: false, sf: null, sr: null }])} };`);

test("normal: Abzeichen und Serie sind zu sehen", () => {
  setup();
  const page = app.run("homeHTML()");
  assert.match(page, /id="badges-h"/);
  assert.match(page, /class="streak"/);
});

test("ruhiger Modus: keine Abzeichen, keine Serie, kein Angebot weiterer Karten", () => {
  setup();
  app.run(`setPref("quiet", true)`);
  const page = app.run("homeHTML()");
  assert.doesNotMatch(page, /id="badges-h"/);
  assert.doesNotMatch(page, /class="streak"/);
  assert.equal(app.run(`extraOffer(state.decks)`), null);
});

test("ruhiger Modus: Abzeichen werden trotzdem vergeben, nur ohne Meldung", () => {
  setup();
  app.run(`setPref("quiet", true); $("#toast").textContent = ""; state.profile.days[dayKey()] = 1;`);
  const fresh = app.get(`checkBadges().map(b => b.id)`);
  assert.ok(fresh.includes("first"));
  assert.ok(app.get(`!!state.profile.badges.first`));
  assert.equal(app.run(`$("#toast").textContent`), "");
});

test("die Einstellung gilt auf allen Geräten (liegt im Profil)", () => {
  app.run(`applyProfile(${json({ prefs: { quiet: true } })}, true)`);
  assert.equal(app.run("quiet()"), true);
  assert.equal(app.get(`normPrefs({ quiet: "ja" }).quiet`), false, "nur echtes true schaltet ein");
});
