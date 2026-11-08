// The real server in a throwaway data folder: saving, backups, restore and the guards against other websites.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";

const ROOT = new URL("../", import.meta.url);
const dataDir = await mkdtemp(path.join(tmpdir(), "karteikasten-test-"));
const port = 40000 + Math.floor(Math.random() * 20000);
const base = `http://localhost:${port}`;
let server;

async function start() {
  server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: dataDir }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Server startet nicht: " + out)), 5000);
    server.stdout.on("data", d => { out += d; if (out.includes("läuft")) { clearTimeout(t); resolve(); } });
    server.stderr.on("data", d => { out += d; });
    server.on("exit", code => { clearTimeout(t); reject(new Error(`Server beendet (${code}): ${out}`)); });
  });
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  server.removeAllListeners("exit"); // the start-up listener would report this stop as a crash
  const done = new Promise(r => server.once("exit", r));
  server.kill("SIGTERM"); await done;
}
after(async () => { await stop(); await rm(dataDir, { recursive: true, force: true }); });

const put = (id, data) => fetch(`${base}/api/docs/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
const restore = (body, type = "application/json") => fetch(`${base}/api/restore`, { method: "POST", headers: { "Content-Type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });
const backupFiles = async () => (await readdir(path.join(dataDir, "backups")).catch(() => [])).sort();
// The daily backup is written right after start-up, so give it a moment.
async function waitForBackups(n) { for (let i = 0; i < 100 && (await backupFiles()).length < n; i++) await new Promise(r => setTimeout(r, 20)); return backupFiles(); }
const today = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

test("Server startet und speichert Dokumente", async () => {
  await start();
  assert.equal((await put("deck-a", { kind: "deck", name: "A" })).status, 204);
  assert.equal((await put("deck-a-c0", { kind: "chunk", deck: "a", cards: [{ i: "1", f: "Frage", b: "Antwort" }] })).status, 204);
  const decks = await (await fetch(`${base}/api/docs?kind=deck`)).json();
  assert.deepEqual(decks, [{ kind: "deck", name: "A" }]);
});

test("Sicherung herunterladen enthält alles und merkt sich den Zeitpunkt", async () => {
  const r = await fetch(`${base}/api/backup`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-disposition"), /attachment; filename="karteikasten-sicherung-\d{4}-\d{2}-\d{2}\.json"/);
  const b = await r.json();
  assert.equal(b.app, "karteikasten");
  assert.deepEqual(b.docs.map(d => d.id), ["deck-a", "deck-a-c0"]);
  const status = await (await fetch(`${base}/api/backup/status`)).json();
  assert.ok(Date.now() - status.lastDownload < 10000);
});

test("automatische Sicherung beim Start, einmal pro Tag", async () => {
  assert.deepEqual(await backupFiles(), [], "leere Datenbank beim ersten Start: keine Sicherung");
  await stop(); await start();
  assert.deepEqual(await waitForBackups(1), [`karteikasten-${today()}.json`]);
  const b = JSON.parse(await readFile(path.join(dataDir, "backups", `karteikasten-${today()}.json`), "utf8"));
  assert.equal(b.docs.length, 2);
  await stop(); await start();
  await new Promise(r => setTimeout(r, 300));
  assert.equal((await backupFiles()).length, 1, "kein zweites Mal am selben Tag");
});

test("Wiederherstellen ersetzt alles und legt den alten Stand vorher ab", async () => {
  const r = await restore({ app: "karteikasten", format: 1, created: 1, docs: [{ id: "deck-b", data: { kind: "deck", name: "B" } }] });
  assert.equal(r.status, 200);
  const decks = await (await fetch(`${base}/api/docs?kind=deck`)).json();
  assert.deepEqual(decks, [{ kind: "deck", name: "B" }]);
  assert.equal(await (await fetch(`${base}/api/docs/deck-a-c0`)).json(), null, "alte Karten sind weg");

  const saved = (await backupFiles()).find(n => n.startsWith("vor-wiederherstellung-"));
  assert.ok(saved, "vorheriger Stand wurde abgelegt");
  const before = JSON.parse(await readFile(path.join(dataDir, "backups", saved), "utf8"));
  assert.deepEqual(before.docs.map(d => d.id), ["deck-a", "deck-a-c0"]);

  // Und zurück: der abgelegte Stand lässt sich selbst wiederherstellen.
  assert.equal((await restore(before)).status, 200);
  const back = await (await fetch(`${base}/api/docs/deck-a-c0`)).json();
  assert.equal(back.cards[0].f, "Frage");
});

test("Wiederherstellen lehnt kaputte oder fremde Dateien ab und ändert dann nichts", async () => {
  const bad = [
    "kein json",
    { app: "anki", docs: [] },
    { app: "karteikasten", docs: [] },
    { app: "karteikasten", docs: [{ id: "../böse", data: {} }] },
    { app: "karteikasten", docs: [{ id: "x", data: [] }] },
    { app: "karteikasten", docs: [{ id: "x", data: {} }, { id: "x", data: {} }] },
  ];
  for (const body of bad) {
    const r = await restore(body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.ok((await r.json()).error);
  }
  const back = await (await fetch(`${base}/api/docs/deck-a-c0`)).json();
  assert.equal(back.cards[0].f, "Frage", "Daten unverändert");
});

test("Schutz vor fremden Websites", async () => {
  // Nur JSON: ein Formular einer anderen Seite kann nichts wiederherstellen.
  assert.equal((await restore("{}", "text/plain")).status, 415);
  // Fremder Hostname (DNS-Trick): abgewiesen.
  const status = await new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: "/api/backup", headers: { Host: "evil.example" } }, r => { r.resume(); resolve(r.statusCode); }).on("error", reject);
  });
  assert.equal(status, 403);
});
