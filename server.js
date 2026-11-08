// Karteikasten: a small local server. It serves the app and keeps decks and
// learning progress in one SQLite file (data/karteikasten.db).
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4321;
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const MAX_BODY = 5 * 1024 * 1024;
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
`);
const sql = {
  get: db.prepare("SELECT data FROM docs WHERE id = ?"),
  byKind: db.prepare("SELECT data FROM docs WHERE kind = ? ORDER BY id"),
  put: db.prepare(`INSERT INTO docs (id, kind, data, updated) VALUES (?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, data = excluded.data, updated = excluded.updated`),
  del: db.prepare("DELETE FROM docs WHERE id = ?"),
};

/* ---------- HTTP ---------- */
const STATIC = {
  "/": ["public/index.html", "text/html; charset=utf-8"],
  "/index.html": ["public/index.html", "text/html; charset=utf-8"],
  "/vendor/ts-fsrs.js": ["node_modules/ts-fsrs/dist/index.umd.js", "text/javascript; charset=utf-8"],
};
const DOC_ID = /^[A-Za-z0-9_.~:@+-]{1,200}$/;
const LOCAL_NAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function send(res, status, body = "", type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > MAX_BODY) { reject(httpError(413, "Zu groß (max. 5 MB pro Dokument)")); req.destroy(); }
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
  if (!LOOPBACK_ONLY) {
    const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
    for (const ip of ips) console.log(`Im WLAN erreichbar: http://${ip}:${PORT}`);
    console.log("Achtung: Ohne Passwort. Jeder im selben Netz kann die Stapel sehen und ändern.");
  }
  console.log("Beenden mit Ctrl+C.");
});

function shutdown() { server.close(); try { db.close(); } catch {} process.exit(0); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
