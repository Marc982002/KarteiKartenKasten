// The learning day starts at a set hour (default 4 o'clock), not at midnight.
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadApp, json } from "./load-app.js";

let app;
before(async () => { app = await loadApp(); });
afterEach(() => app.run(`state.profile.prefs = normPrefs(); applyPrefs();`));

const at = (h, m = 0, day = 10) => new Date(2026, 10, day, h, m).getTime(); // 10.11.2026, local time

test("Standard: der Lerntag beginnt um 4 Uhr", () => {
  assert.equal(app.run("DAY_START"), 4);
  assert.equal(app.run(`dayKey(${at(1, 30)})`), "2026-11-09", "0:30–4:00 zählt zum Vortag");
  assert.equal(app.run(`dayKey(${at(4)})`), "2026-11-10");
  assert.equal(app.run(`dayKey(${at(23, 59)})`), "2026-11-10");
  assert.equal(app.run(`dayEnd(${at(1, 30)})`), at(4), "der Tag von 1:30 endet um 4 Uhr");
  assert.equal(app.run(`dayEnd(${at(15)})`), at(4, 0, 11), "der Tag von 15 Uhr endet morgen um 4");
});

test("Mitternacht verhält sich wie früher", () => {
  app.run(`setPref("dayStart", 0)`);
  assert.equal(app.run(`dayKey(${at(1, 30)})`), "2026-11-10");
  assert.equal(app.run(`dayEnd(${at(15)})`), at(0, 0, 11));
});

test("Einstellung wird begrenzt und im Profil gespeichert", () => {
  assert.equal(app.get(`normPrefs({ dayStart: 9 }).dayStart`), 6);
  assert.equal(app.get(`normPrefs({ dayStart: -2 }).dayStart`), 0);
  assert.equal(app.get(`normPrefs({ dayStart: "x" }).dayStart`), 4);
  app.run(`setPref("dayStart", 2)`);
  assert.equal(app.run("DAY_START"), 2);
  assert.equal(app.get("state.profile.prefs.dayStart"), 2);
});

test("ein anderes Gerät ändert den Lerntag-Beginn: wird übernommen", () => {
  app.run(`applyProfile(${json({ prefs: { dayStart: 5 } })}, true)`);
  assert.equal(app.run("DAY_START"), 5);
  // Bei einem Speicherkonflikt gewinnt die Einstellung dieses Geräts.
  app.run(`applyProfile(${json({ prefs: { dayStart: 1 } })}, false)`);
  assert.equal(app.run("DAY_START"), 5);
});

test("das Rädchen zeigt die Auswahl", () => {
  app.run(`state.uiOpen = true;`);
  assert.match(app.run("uiSettingsHTML()"), /id="pref-daystart"[\s\S]*<option value="4" selected>/);
  app.run(`state.uiOpen = false;`);
});
