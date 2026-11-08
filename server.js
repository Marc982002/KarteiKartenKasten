// Karteikasten: a small local server. It serves the app and keeps decks and
// learning progress in one SQLite file (data/karteikasten.db).
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { readFile, writeFile, rename, readdir, stat, unlink, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4321;
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DATA_DIR, "backups");
const BACKUP_KEEP = 14;            // daily automatic backups kept
const BACKUP_KEEP_RESTORE = 5;     // snapshots taken right before a restore
const MAX_BODY = 5 * 1024 * 1024;
const MAX_RESTORE = 200 * 1024 * 1024;
const LOOPBACK_ONLY = HOST === "127.0.0.1" || HOST === "localhost" || HOST === "::1";

/* ---------- Storage: one table of JSON documents ---------- */
await mkdir(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "karteikasten.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS docs (
    id      TEXT PRIMARY KEY,
    kind    TEXT,
    data    TEXT NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS docs_kind ON docs(kind);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`);
const sql = {
  get: db.prepare("SELECT data FROM docs WHERE id = ?"),
  byKind: db.prepare("SELECT data FROM docs WHERE kind = ? ORDER BY id"),
  all: db.prepare("SELECT id, data FROM docs ORDER BY id"),
  count: db.prepare("SELECT COUNT(*) AS n FROM docs"),
  put: db.prepare(`INSERT INTO docs (id, kind, data, updated) VALUES (?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, data = excluded.data, updated = excluded.updated`),
  del: db.prepare("DELETE FROM docs WHERE id = ?"),
  delAll: db.prepare("DELETE FROM docs"),
  getMeta: db.prepare("SELECT value FROM meta WHERE key = ?"),
  setMeta: db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
};

/* ---------- Backups: every document in one JSON file ----------
   The same format is used for the download button, the daily automatic backup
   and the snapshot taken before a restore, so any of them can be restored. */
const DOC_ID = /^[A-Za-z0-9_.~:@+-]{1,200}$/;
const AUTO_FILE = /^karteikasten-(\d{4}-\d{2}-\d{2})\.json$/;
const RESTORE_FILE = /^vor-wiederherstellung-[\d-]+\.json$/;
const pad = n => String(n).padStart(2, "0");
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const stamp = (d = new Date()) => `${dayKey(d)}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

function backupJSON() {
  const docs = sql.all.all().map(r => `{"id":${JSON.stringify(r.id)},"data":${r.data}}`);
  return `{"app":"karteikasten","format":1,"created":${Date.now()},"docs":[\n${docs.join(",\n")}\n]}\n`;
}
async function writeBackup(name) {
  await mkdir(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, name), tmp = file + ".tmp";
  await writeFile(tmp, backupJSON());
  await rename(tmp, file); // never leave a half-written backup behind
  return file;
}
async function prune(pattern, keep) {
  const names = (await readdir(BACKUP_DIR).catch(() => [])).filter(n => pattern.test(n)).sort();
  for (const n of names.slice(0, Math.max(0, names.length - keep))) await unlink(path.join(BACKUP_DIR, n)).catch(() => {});
}
// Once a day, on start and then hourly: a copy of everything, the last 14 days kept.
async function autoBackup() {
  try {
    if (!sql.count.get().n) return;
    const name = `karteikasten-${dayKey()}.json`;
    if (await stat(path.join(BACKUP_DIR, name)).catch(() => null)) return;
    await writeBackup(name);
    await prune(AUTO_FILE, BACKUP_KEEP);
  } catch (e) { console.error("Automatische Sicherung fehlgeschlagen:", e.message); }
}
async function backupStatus() {
  const names = (await readdir(BACKUP_DIR).catch(() => [])).filter(n => AUTO_FILE.test(n)).sort();
  const lastName = names[names.length - 1];
  const last = lastName ? (await stat(path.join(BACKUP_DIR, lastName)).catch(() => null))?.mtimeMs ?? null : null;
  const dl = sql.getMeta.get("lastDownload");
  return { dir: BACKUP_DIR, keep: BACKUP_KEEP, count: names.length, lastAuto: last, lastDownload: dl ? Number(dl.value) : null };
}
function parseBackup(text) {
  let b;
  try { b = JSON.parse(text); } catch { throw httpError(400, "Die Datei ist keine gültige Sicherung (kein JSON)."); }
  if (!b || b.app !== "karteikasten" || !Array.isArray(b.docs)) throw httpError(400, "Die Datei ist keine Karteikasten-Sicherung.");
  if (!b.docs.length) throw httpError(400, "Die Sicherung ist leer.");
  const seen = new Set();
  for (const d of b.docs) {
    if (!d || typeof d.id !== "string" || !DOC_ID.test(d.id) || seen.has(d.id)) throw httpError(400, "Die Sicherung ist beschädigt (ungültige ID).");
    if (!d.data || typeof d.data !== "object" || Array.isArray(d.data)) throw httpError(400, "Die Sicherung ist beschädigt (ungültiger Inhalt).");
    seen.add(d.id);
  }
  return b.docs;
}
function replaceAll(docs) {
  const now = Date.now();
  db.exec("BEGIN");
  try {
    sql.delAll.run();
    for (const d of docs) sql.put.run(d.id, typeof d.data.kind === "string" ? d.data.kind : null, JSON.stringify(d.data), now);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}

/* ---------- HTTP ---------- */
const STATIC = {
  "/": ["public/index.html", "text/html; charset=utf-8"],
  "/index.html": ["public/index.html", "text/html; charset=utf-8"],
  "/vendor/ts-fsrs.js": ["node_modules/ts-fsrs/dist/index.umd.js", "text/javascript; charset=utf-8"],
};
const LOCAL_NAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function send(res, status, body = "", type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > limit) { reject(httpError(413, `Zu groß (max. ${Math.round(limit / 1048576)} MB)`)); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handle(req, res) {
  // When only reachable from this Mac, answer only requests addressed to it by name.
  // This blocks websites that try to reach the server through DNS tricks.
  const hostName = (req.headers.host || "").replace(/:\d+$/, "");
  if (LOOPBACK_ONLY && !LOCAL_NAMES.has(hostName)) return send(res, 403, { error: "Unbekannter Host" });

  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;

  if (p === "/api/health") return send(res, 200, { ok: true });

  if (p === "/api/backup") {
    if (req.method !== "GET") return send(res, 405, { error: "Methode nicht erlaubt" });
    const body = backupJSON();
    sql.setMeta.run("lastDownload", String(Date.now()));
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="karteikasten-sicherung-${dayKey()}.json"` });
    return res.end(body);
  }
  if (p === "/api/backup/status") {
    if (req.method !== "GET") return send(res, 405, { error: "Methode nicht erlaubt" });
    return send(res, 200, await backupStatus());
  }
  if (p === "/api/restore") {
    if (req.method !== "POST") return send(res, 405, { error: "Methode nicht erlaubt" });
    if (!(req.headers["content-type"] || "").startsWith("application/json")) return send(res, 415, { error: "JSON erwartet" });
    const docs = parseBackup(await readBody(req, MAX_RESTORE));
    // Keep the current state first, so a wrong file can be undone.
    let saved = null;
    if (sql.count.get().n) { saved = await writeBackup(`vor-wiederherstellung-${stamp()}.json`); await prune(RESTORE_FILE, BACKUP_KEEP_RESTORE); }
    replaceAll(docs);
    console.log(`Wiederhergestellt: ${docs.length} Dokumente.` + (saved ? ` Vorheriger Stand: ${saved}` : ""));
    return send(res, 200, { docs: docs.length, saved });
  }

  if (p === "/api/docs") {
    if (req.method !== "GET") return send(res, 405, { error: "Methode nicht erlaubt" });
    const kind = url.searchParams.get("kind");
    if (!kind) return send(res, 400, { error: "Parameter kind fehlt" });
    return send(res, 200, "[" + sql.byKind.all(kind).map(r => r.data).join(",") + "]");
  }

  const m = p.match(/^\/api\/docs\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (!DOC_ID.test(id)) return send(res, 400, { error: "Ungültige ID" });
    if (req.method === "GET") {
      const row = sql.get.get(id);
      return send(res, 200, row ? row.data : "null"); // missing documents read as null, like an empty slot
    }
    if (req.method === "PUT") {
      // JSON-only writes also mean browsers must ask first for cross-site requests, which this server never allows.
      if (!(req.headers["content-type"] || "").startsWith("application/json")) return send(res, 415, { error: "JSON erwartet" });
      let data;
      try { data = JSON.parse(await readBody(req)); } catch (e) { if (e.status) throw e; return send(res, 400, { error: "Kein gültiges JSON" }); }
      if (!data || typeof data !== "object" || Array.isArray(data)) return send(res, 400, { error: "Objekt erwartet" });
      sql.put.run(id, typeof data.kind === "string" ? data.kind : null, JSON.stringify(data), Date.now());
      return send(res, 204);
    }
    if (req.method === "DELETE") { sql.del.run(id); return send(res, 204); }
    return send(res, 405, { error: "Methode nicht erlaubt" });
  }

  if (req.method === "GET" && STATIC[p]) {
    const [file, type] = STATIC[p];
    try { return send(res, 200, await readFile(path.join(ROOT, file)), type); }
    catch (e) { if (e.code === "ENOENT") return send(res, 404, { error: "Datei fehlt: " + file }); throw e; }
  }
  return send(res, 404, { error: "Nicht gefunden" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(e => {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : "Serverfehler" });
  });
});

server.on("error", e => {
  if (e.code === "EADDRINUSE") console.error(`Port ${PORT} ist schon belegt. Starte mit einem anderen Port, z. B.: PORT=4322 npm start`);
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Karteikasten läuft: http://localhost:${PORT}`);
  console.log(`Daten: ${path.join(DATA_DIR, "karteikasten.db")}`);
  console.log(`Sicherungen: ${BACKUP_DIR}`);
  if (!LOOPBACK_ONLY) {
    const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
    for (const ip of ips) console.log(`Im WLAN erreichbar: http://${ip}:${PORT}`);
    console.log("Achtung: Ohne Passwort. Jeder im selben Netz kann die Stapel sehen und ändern.");
  }
  console.log("Beenden mit Ctrl+C.");
});

autoBackup();
setInterval(autoBackup, 60 * 60 * 1000).unref();

function shutdown() { server.close(); try { db.close(); } catch {} process.exit(0); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
