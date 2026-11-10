// Phone access: switched on in the app, other devices need the PIN once, then a session cookie.
// Requests from another device are simulated through this computer's own Wi-Fi address.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os, { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";

const ROOT = new URL("../", import.meta.url);
const port = 40000 + Math.floor(Math.random() * 20000);
const local = `http://localhost:${port}`;
const lanIp = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === "IPv4" && !i.internal)?.address;
const remote = lanIp && `http://${lanIp}:${port}`;
const noLan = lanIp ? false : "kein WLAN-Anschluss auf diesem Rechner";
let dataDir, server;

const wait = ms => new Promise(r => setTimeout(r, ms));
async function start() {
  server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, HOST: "", PORT: String(port), DATA_DIR: dataDir }, stdio: ["ignore", "pipe", "pipe"] });
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
  server.removeAllListeners("exit");
  const done = new Promise(r => server.once("exit", r));
  server.kill("SIGTERM"); await done;
}
before(async () => { dataDir = await mkdtemp(path.join(tmpdir(), "karteikasten-phone-")); await start(); });
after(async () => { await stop(); await rm(dataDir, { recursive: true, force: true }); });

const json = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const status = () => fetch(`${local}/api/phone`).then(r => r.json());
// Switching rebinds the server, so wait until the new state is live.
async function setPhone(on) {
  assert.equal((await json(`${local}/api/phone`, { on })).status, 200);
  for (let i = 0; i < 50; i++) { await wait(60); try { const s = await status(); if (s.open === on) return s; } catch {} }
  throw new Error("Umschalten hat nicht geklappt");
}
const reachable = url => fetch(url, { signal: AbortSignal.timeout(1500) }).then(() => true, () => false);
const cookieOf = r => (r.headers.get("set-cookie") || "").split(";")[0];

test("aus: nur auf diesem Computer erreichbar", { skip: noLan }, async () => {
  const s = await status();
  assert.equal(s.on, false);
  assert.equal(s.pin, null);
  assert.equal(await reachable(`${remote}/`), false);
});

test("an: PIN und QR-Code für jede WLAN-Adresse", { skip: noLan }, async () => {
  const s = await setPhone(true);
  assert.match(s.pin, /^\d{6}$/);
  assert.ok(s.urls.some(u => u.url === `${remote}/`));
  assert.match(s.urls[0].qr, /^<svg/);
  // Der Computer selbst braucht keine PIN.
  assert.equal((await fetch(`${local}/api/rev`)).status, 200);
});

test("anderes Gerät: ohne PIN nur die Anmeldeseite, keine Daten", { skip: noLan }, async () => {
  const page = await fetch(`${remote}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /name="pin"/);
  assert.equal((await fetch(`${remote}/api/rev`)).status, 401);
  assert.equal((await fetch(`${remote}/api/docs?kind=deck`)).status, 401);
  assert.equal((await fetch(`${remote}/vendor/ts-fsrs.js`)).status, 401);
});

test("richtige PIN aus dem QR-Code: angemeldet, Einstellungen bleiben gesperrt", { skip: noLan }, async () => {
  const { pin } = await status();
  const r = await fetch(`${remote}/?pin=${pin}`, { redirect: "manual" });
  assert.equal(r.status, 303);
  const cookie = cookieOf(r);
  assert.match(cookie, /^kk_session=/);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.equal((await fetch(`${remote}/api/rev`, { headers: { Cookie: cookie } })).status, 200);
  assert.equal((await fetch(`${remote}/api/phone`, { headers: { Cookie: cookie } })).status, 403, "das Handy darf den Zugang nicht verwalten");
  assert.equal((await json(`${remote}/api/phone/pin`, {})).status, 401);
});

test("PIN über das Formular", { skip: noLan }, async () => {
  const { pin } = await status();
  const r = await fetch(`${remote}/login`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "pin=" + pin, redirect: "manual" });
  assert.equal(r.status, 303);
  assert.match(cookieOf(r), /^kk_session=/);
});

test("neue PIN meldet alle Geräte ab", { skip: noLan }, async () => {
  const { pin } = await status();
  const cookie = cookieOf(await fetch(`${remote}/?pin=${pin}`, { redirect: "manual" }));
  const s = await json(`${local}/api/phone/pin`, {}).then(r => r.json());
  assert.notEqual(s.pin, pin);
  assert.equal((await fetch(`${remote}/api/rev`, { headers: { Cookie: cookie } })).status, 401);
});

test("falsche PINs: nach 5 Versuchen Pause", { skip: noLan }, async () => {
  const { pin } = await status();
  const wrong = pin === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) assert.equal((await fetch(`${remote}/?pin=${wrong}`, { redirect: "manual" })).status, 401);
  assert.equal((await fetch(`${remote}/?pin=${pin}`, { redirect: "manual" })).status, 429, "auch die richtige PIN wartet jetzt");
});

test("fremde Websites (DNS-Tricks) bleiben draußen, auch wenn der Zugang an ist", { skip: noLan }, async () => {
  const code = host => new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: "/api/rev", headers: { Host: host } }, r => { r.resume(); resolve(r.statusCode); }).on("error", reject);
  });
  assert.equal(await code("evil.example:" + port), 403);
  assert.equal(await code(`${lanIp}:${port}`), 200, "die eigene WLAN-Adresse ist erlaubt");
});

test("aus: das WLAN ist wieder zu, auch bestehende Verbindungen", { skip: noLan }, async () => {
  await setPhone(false);
  assert.equal(await reachable(`${remote}/`), false);
  assert.equal((await fetch(`${local}/api/rev`)).status, 200);
});
