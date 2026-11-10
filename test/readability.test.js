// Readability on this device: text size and a plain font instead of handwriting.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./load-app.js";

let app;
before(async () => { app = await loadApp(); });
after(() => app.run(`setReadability("size", "m"); setReadability("font", "hand"); state.uiOpen = false;`));

test("Standard: normale Größe, Handschrift", () => {
  assert.equal(app.run("SIZE"), "m");
  assert.equal(app.run("FONT"), "hand");
});

test("Größe und Schrift umstellen, Unsinn wird ignoriert", () => {
  app.run(`setReadability("size", "xl"); setReadability("font", "plain")`);
  assert.equal(app.run("SIZE"), "xl");
  assert.equal(app.run("FONT"), "plain");
  app.run(`setReadability("size", "huge"); setReadability("font", "comic")`);
  assert.equal(app.run("SIZE"), "xl");
  assert.equal(app.run("FONT"), "plain");
});

test("das Rädchen zeigt die Auswahl", () => {
  app.run(`setReadability("size", "l"); state.uiOpen = true;`);
  const panel = app.run("uiSettingsHTML()");
  assert.match(panel, /name="ui-size" value="l" checked/);
  assert.match(panel, /name="ui-font" value="plain" checked/);
});
