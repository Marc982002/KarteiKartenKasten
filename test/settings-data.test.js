// Backup and "how it works" live behind the gear; the overview only shows a reminder when a download is overdue.
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadApp, json } from "./load-app.js";

const DAY = 86400000;
let app;
before(async () => { app = await loadApp(); });
afterEach(() => { app.run(`state.uiOpen = false; state.backup = null; state.decks = []; state.cards = {}; state.topics = [];`); app.run("if (globalThis.__store) { state.store = __store; delete globalThis.__store; }"); });

const asServer = (backup, createdDaysAgo) => {
  app.run(`globalThis.__store ??= state.store; state.store = { kind: "server" }; state.backup = ${json(backup)};
    state.decks = ${json([{ id: "a", name: "a", dir: "f", mode: "auto", newPerDay: 20, retention: 0.9, created: Date.now() - createdDaysAgo * DAY, newDay: "", newCount: 0, revDay: "", revCount: 0, chunks: 0, cardCount: 0 }])};
    state.cards = { a: [] };`);
};

test("Sicherung und Erklärung stehen im Rädchen, nicht mehr auf der Startseite", () => {
  asServer({ lastAuto: Date.now(), keep: 14, dir: "/x", lastDownload: Date.now() }, 30);
  assert.doesNotMatch(app.run("homeHTML()"), /id="backup-h"|class="how"/);
  app.run("state.uiOpen = true");
  const panel = app.run("homeHTML()");
  assert.match(panel, /id="backup-h"/);
  assert.match(panel, /data-act="backup-dl"/);
  assert.match(panel, /<details class="how">/);
});

test("Wiederherstellen geht auch ohne Stapel (neuer Computer)", () => {
  asServer({ lastAuto: null, keep: 14, dir: "/x", lastDownload: null }, 30);
  app.run("state.decks = []; state.uiOpen = true;");
  const panel = app.run("uiSettingsHTML()");
  assert.match(panel, /for="file-restore"/);
  assert.match(panel, /data-act="backup-dl" disabled/);
});

test("Erinnerung auf der Startseite erst, wenn sie sinnvoll ist", () => {
  asServer({ lastAuto: Date.now(), keep: 14, dir: "/x", lastDownload: null }, 2);
  assert.equal(app.run("backupNudgeHTML()"), "", "erster Stapel ist erst 2 Tage alt");
  asServer({ lastAuto: Date.now(), keep: 14, dir: "/x", lastDownload: null }, 10);
  assert.match(app.run("backupNudgeHTML()"), /data-act="ui-backup"/, "nie heruntergeladen, Stapel 10 Tage alt");
  asServer({ lastAuto: Date.now(), keep: 14, dir: "/x", lastDownload: Date.now() - 5 * DAY }, 60);
  assert.equal(app.run("backupNudgeHTML()"), "", "vor 5 Tagen heruntergeladen");
  asServer({ lastAuto: Date.now(), keep: 14, dir: "/x", lastDownload: Date.now() - 40 * DAY }, 60);
  assert.match(app.run("backupNudgeHTML()"), /data-act="ui-backup"/, "vor 40 Tagen heruntergeladen");
});
