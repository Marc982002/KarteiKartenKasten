// Karteikasten: a small local server. It serves the app and keeps decks and
// learning progress in one SQLite file (data/karteikasten.db).
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { readFile, writeFile, rename, readdir, stat, unlink, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomInt, timingSafeEqual, createHash } from "node:crypto";
import qrcode from "qrcode-generator";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4321;
// HOST set by hand decides where the server listens; otherwise the phone setting in the app does (see below).
const HOST_ENV = process.env.HOST || null;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DATA_DIR, "backups");
const BACKUP_KEEP = 14;            // daily automatic backups kept
const BACKUP_KEEP_RESTORE = 5;     // snapshots taken right before a restore
const MAX_BODY = 5 * 1024 * 1024;
const MAX_RESTORE = 200 * 1024 * 1024;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

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
  -- Deleted documents, so other devices learn about the deletion.
  CREATE TABLE IF NOT EXISTS deleted (id TEXT PRIMARY KEY, rev INTEGER NOT NULL);
`);
// Every write gets a revision number from one counter. A device sends the revision it last saw;
// if someone else wrote in between, the write is refused and the device merges first.
if (!db.prepare("PRAGMA table_info(docs)").all().some(c => c.name === "rev")) db.exec("ALTER TABLE docs ADD COLUMN rev INTEGER NOT NULL DEFAULT 0");
db.exec("CREATE INDEX IF NOT EXISTS docs_rev ON docs(rev); CREATE INDEX IF NOT EXISTS deleted_rev ON deleted(rev);");
const sql = {
  get: db.prepare("SELECT data, rev FROM docs WHERE id = ?"),
  byKind: db.prepare("SELECT data FROM docs WHERE kind = ? ORDER BY id"),
  byKindRev: db.prepare("SELECT id, rev, data FROM docs WHERE kind = ? ORDER BY id"),
  since: db.prepare("SELECT id, rev, data FROM docs WHERE rev > ? ORDER BY id"),
  deletedSince: db.prepare("SELECT id, rev FROM deleted WHERE rev > ? ORDER BY id"),
  tomb: db.prepare("SELECT rev FROM deleted WHERE id = ?"),
  addTomb: db.prepare("INSERT INTO deleted (id, rev) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET rev = excluded.rev"),
  dropTomb: db.prepare("DELETE FROM deleted WHERE id = ?"),
  ids: db.prepare("SELECT id FROM docs"),
  all: db.prepare("SELECT id, data FROM docs ORDER BY id"),
  count: db.prepare("SELECT COUNT(*) AS n FROM docs"),
  put: db.prepare(`INSERT INTO docs (id, kind, data, updated, rev) VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, data = excluded.data, updated = excluded.updated, rev = excluded.rev`),
  del: db.prepare("DELETE FROM docs WHERE id = ?"),
  delAll: db.prepare("DELETE FROM docs"),
  getMeta: db.prepare("SELECT value FROM meta WHERE key = ?"),
  setMeta: db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
};
const currentRev = () => Number(sql.getMeta.get("rev")?.value || 0);
function nextRev() { const r = currentRev() + 1; sql.setMeta.run("rev", String(r)); return r; }
// Revision of a document as a device would know it: the document's, the deletion's, or 0 if it never existed.
const revOf = id => sql.get.get(id)?.rev ?? sql.tomb.get(id)?.rev ?? 0;
function putDoc(id, data) {
  const rev = nextRev();
  sql.put.run(id, typeof data.kind === "string" ? data.kind : null, JSON.stringify(data), Date.now(), rev);
  sql.dropTomb.run(id);
  return rev;
}
function deleteDoc(id) {
  if (!sql.get.get(id)) return revOf(id);
  const rev = nextRev();
  sql.del.run(id); sql.addTomb.run(id, rev);
  return rev;
}

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
  db.exec("BEGIN");
  try {
    const keep = new Set(docs.map(d => d.id));
    for (const { id } of sql.ids.all()) if (!keep.has(id)) deleteDoc(id);
    for (const d of docs) putDoc(d.id, d.data);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}

/* ---------- Phone access ----------
   Off: the server only listens on this computer, as before. On: it also listens on the Wi-Fi.
   Requests from this computer never need anything. Every other device enters a 6-digit PIN once
   and then gets a session cookie. A new PIN signs all devices out. Too many wrong PINs: a pause. */
const meta = k => sql.getMeta.get(k)?.value ?? null;
const PIN_TRIES = 5, PIN_TRIES_ALL = 30, PIN_WINDOW = 10 * 60 * 1000, MAX_SESSIONS = 20;
const hashToken = t => createHash("sha256").update(t).digest("hex");
function sessions() { try { const l = JSON.parse(meta("phoneSessions") || "[]"); return Array.isArray(l) ? l : []; } catch { return []; } }
function resetPin() {
  sql.setMeta.run("phonePin", String(randomInt(0, 1000000)).padStart(6, "0"));
  sql.setMeta.run("phoneSessions", "[]");
}
function newSession() {
  const token = randomBytes(24).toString("base64url");
  sql.setMeta.run("phoneSessions", JSON.stringify([...sessions().slice(-(MAX_SESSIONS - 1)), hashToken(token)]));
  return token;
}
const sessionCookie = token => `kk_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`;
function hasSession(req) {
  const m = /(?:^|;\s*)kk_session=([A-Za-z0-9_-]{10,100})/.exec(req.headers.cookie || "");
  return !!m && sessions().includes(hashToken(m[1]));
}
function pinOk(given) {
  const pin = meta("phonePin");
  return !!pin && typeof given === "string" && given.length === pin.length && timingSafeEqual(Buffer.from(given), Buffer.from(pin));
}
const fails = new Map(); // ip -> times of wrong PINs
function blocked(ip) {
  const now = Date.now();
  for (const [k, list] of fails) { const keep = list.filter(t => now - t < PIN_WINDOW); keep.length ? fails.set(k, keep) : fails.delete(k); }
  const all = [...fails.values()].reduce((a, l) => a + l.length, 0);
  return (fails.get(ip)?.length || 0) >= PIN_TRIES || all >= PIN_TRIES_ALL;
}
const failed = ip => (fails.get(ip) || fails.set(ip, []).get(ip)).push(Date.now());
const isLocalPeer = req => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
const lanAddresses = () => Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
const wantedHost = () => HOST_ENV || (meta("phoneOn") === "1" ? "0.0.0.0" : "127.0.0.1");
let server = null, currentHost = null;
const isOpen = () => !LOOPBACK_HOSTS.has(currentHost);

function phoneStatus() {
  const open = isOpen(), pin = meta("phonePin"), port = server?.address()?.port ?? PORT;
  const urls = open && pin ? lanAddresses().map(ip => {
    const url = `http://${ip}:${port}/`, q = qrcode(0, "M");
    q.addData(`${url}?pin=${pin}`); q.make();
    return { url, qr: q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) };
  }) : [];
  return { on: open || meta("phoneOn") === "1", open, fixed: !!HOST_ENV, pin: open ? pin : null, urls, devices: sessions().length };
}
const LOGIN_TEXT = {
  de: { title: "Karteikasten", lead: "Gib die PIN ein, die auf deinem Computer im Rädchen ⚙︎ unter „Handy verbinden“ steht.", go: "Verbinden", wrong: "Die PIN stimmt nicht.", wait: "Zu viele falsche Versuche. Warte ein paar Minuten." },
  en: { title: "Karteikasten", lead: "Enter the PIN shown on your computer under the gear ⚙︎, “Connect a phone”.", go: "Connect", wrong: "That PIN is not right.", wait: "Too many wrong tries. Wait a few minutes." }
};
function loginPage(req, note) {
  const t = /^de\b/i.test(req.headers["accept-language"] || "") ? LOGIN_TEXT.de : LOGIN_TEXT.en;
  return `<!doctype html><html lang="${t === LOGIN_TEXT.de ? "de" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.title}</title><style>body{font-family:system-ui,sans-serif;background:#fbfcfd;color:#24282f;margin:0;padding:48px 20px;display:flex;justify-content:center}
@media (prefers-color-scheme:dark){body{background:#1b1f26;color:#e7e9ee}h1{color:#93b1ff!important}.note{color:#ee6e64!important}}
main{max-width:340px;display:flex;flex-direction:column;gap:14px}h1{margin:0;color:#2343b0;font-size:32px}p{margin:0;line-height:1.5}
input{font:inherit;font-size:28px;letter-spacing:.3em;text-align:center;padding:10px;border:2px solid #5f6674;border-radius:10px;width:100%;box-sizing:border-box}
button{font:inherit;font-weight:700;font-size:17px;padding:12px;border-radius:10px;border:2px solid #24282f;background:#fff07a;color:#24282f}.note{color:#c4433a;font-weight:700}</style></head>
<body><main><h1>${t.title}</h1><p>${t.lead}</p>${note ? `<p class="note">${t[note]}</p>` : ""}
<form method="post" action="/login"><input name="pin" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" autofocus aria-label="PIN"><br><br><button>${t.go}</button></form></main></body></html>`;
}
// Checks a PIN from the QR code link or the form. Right: cookie and back to the app; wrong: the form again.
function tryPin(req, res, pin) {
  const ip = req.socket.remoteAddress;
  if (blocked(ip)) return send(res, 429, loginPage(req, "wait"), "text/html; charset=utf-8");
  if (!pinOk(pin)) { failed(ip); return send(res, 401, loginPage(req, "wrong"), "text/html; charset=utf-8"); }
  return send(res, 303, "", "text/plain", { Location: "/", "Set-Cookie": sessionCookie(newSession()) });
}
// Listens on the host the setting asks for. Called at start and when the setting changes.
function listenOn(host) {
  return new Promise((resolve, reject) => {
    const s = http.createServer(onRequest);
    s.once("error", reject);
    s.listen(PORT, host, () => { s.off("error", reject); s.on("error", e => console.error(e)); resolve(s); });
  });
}
async function rebind() {
  const host = wantedHost();
  if (host === currentHost) return;
  const old = server, oldHost = currentHost;
  old.close(); old.closeAllConnections(); // also ends connections a phone still holds open
  for (let i = 0; ; i++) {
    try { server = await listenOn(host); currentHost = host; break; }
    catch (e) {
      if (e.code === "EADDRINUSE" && i < 30) { await new Promise(r => setTimeout(r, 100)); continue; }
      console.error("Umschalten fehlgeschlagen:", e.message);
      server = await listenOn(oldHost); currentHost = oldHost; return;
    }
  }
  logAddresses();
}
function logAddresses() {
  if (!isOpen()) { console.log("Nur auf diesem Computer erreichbar."); return; }
  for (const ip of lanAddresses()) console.log(`Im WLAN erreichbar: http://${ip}:${PORT}`);
  console.log(`Andere Geräte brauchen die PIN ${meta("phonePin")} (steht auch in der App im Rädchen).`);
}

/* ---------- HTTP ---------- */
const STATIC = {
  "/": ["public/index.html", "text/html; charset=utf-8"],
  "/index.html": ["public/index.html", "text/html; charset=utf-8"],
  "/vendor/ts-fsrs.js": ["node_modules/ts-fsrs/dist/index.umd.js", "text/javascript; charset=utf-8"],
};
const LOCAL_NAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function send(res, status, body = "", type = "application/json; charset=utf-8", extra = {}) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra });
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
  // Answer only requests addressed to this computer by name (or, with phone access, by its Wi-Fi address).
  // This blocks websites that try to reach the server through DNS tricks. HOST set by hand to the network: no name check, as before.
  const hostName = (req.headers.host || "").replace(/:\d+$/, "");
  const nameCheck = !HOST_ENV || LOOPBACK_HOSTS.has(HOST_ENV);
  if (nameCheck && !LOCAL_NAMES.has(hostName) && !(isOpen() && lanAddresses().includes(hostName))) return send(res, 403, { error: "Unbekannter Host" });

  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;

  // Other devices: the PIN once, then the session cookie. Phone settings only from this computer.
  if (!isLocalPeer(req)) {
    if (p === "/login" && req.method === "POST") return tryPin(req, res, new URLSearchParams(await readBody(req, 1024)).get("pin") || "");
    if (!hasSession(req)) {
      if (req.method === "GET" && (p === "/" || p === "/index.html")) {
        const pin = url.searchParams.get("pin");
        return pin != null ? tryPin(req, res, pin) : send(res, 200, loginPage(req), "text/html; charset=utf-8");
      }
      return send(res, 401, { error: "PIN nötig" });
    }
    if (p.startsWith("/api/phone")) return send(res, 403, { error: "Nur auf dem Computer" });
  }

  if (p === "/api/phone") {
    if (req.method === "GET") return send(res, 200, phoneStatus());
    if (req.method !== "POST") return send(res, 405, { error: "Methode nicht erlaubt" });
    if (!(req.headers["content-type"] || "").startsWith("application/json")) return send(res, 415, { error: "JSON erwartet" });
    if (HOST_ENV) return send(res, 409, { error: "Über HOST festgelegt" });
    let body; try { body = JSON.parse(await readBody(req, 1024)); } catch { return send(res, 400, { error: "Kein gültiges JSON" }); }
    sql.setMeta.run("phoneOn", body?.on ? "1" : "0");
    if (body?.on && !meta("phonePin")) resetPin();
    res.on("finish", () => rebind().catch(e => console.error(e))); // after the answer: switching drops open connections
    return send(res, 200, { ok: true });
  }
  if (p === "/api/phone/pin") {
    if (req.method !== "POST") return send(res, 405, { error: "Methode nicht erlaubt" });
    if (!(req.headers["content-type"] || "").startsWith("application/json")) return send(res, 415, { error: "JSON erwartet" });
    resetPin();
    return send(res, 200, phoneStatus());
  }

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
    if (url.searchParams.get("revs") === "1") return send(res, 200, "[" + sql.byKindRev.all(kind).map(r => `{"id":${JSON.stringify(r.id)},"rev":${r.rev},"data":${r.data}}`).join(",") + "]");
    return send(res, 200, "[" + sql.byKind.all(kind).map(r => r.data).join(",") + "]");
  }
  // What changed since a revision: other devices poll this to stay current.
  if (p === "/api/changes") {
    if (req.method !== "GET") return send(res, 405, { error: "Methode nicht erlaubt" });
    const since = Number(url.searchParams.get("since"));
    if (!Number.isInteger(since) || since < 0) return send(res, 400, { error: "Parameter since fehlt" });
    const docs = sql.since.all(since).map(r => `{"id":${JSON.stringify(r.id)},"rev":${r.rev},"data":${r.data}}`);
    return send(res, 200, `{"rev":${currentRev()},"docs":[${docs.join(",")}],"deleted":${JSON.stringify(sql.deletedSince.all(since).map(r => ({ id: r.id, rev: r.rev })))}}`);
  }
  if (p === "/api/rev") return send(res, 200, { rev: currentRev() });

  const m = p.match(/^\/api\/docs\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (!DOC_ID.test(id)) return send(res, 400, { error: "Ungültige ID" });
    if (req.method === "GET") {
      const row = sql.get.get(id);
      return send(res, 200, row ? row.data : "null", undefined, { "X-Rev": String(revOf(id)) }); // missing documents read as null, like an empty slot
    }
    if (req.method === "PUT") {
      // JSON-only writes also mean browsers must ask first for cross-site requests, which this server never allows.
      if (!(req.headers["content-type"] || "").startsWith("application/json")) return send(res, 415, { error: "JSON erwartet" });
      let data;
      try { data = JSON.parse(await readBody(req)); } catch (e) { if (e.status) throw e; return send(res, 400, { error: "Kein gültiges JSON" }); }
      if (!data || typeof data !== "object" || Array.isArray(data)) return send(res, 400, { error: "Objekt erwartet" });
      const expect = req.headers["x-if-rev"];
      if (expect !== undefined) {
        const now = revOf(id);
        if (Number(expect) !== now) {
          const row = sql.get.get(id);
          return send(res, 409, `{"error":"Inzwischen auf einem anderen Gerät geändert","rev":${now},"data":${row ? row.data : "null"}}`);
        }
      }
      return send(res, 200, { rev: putDoc(id, data) });
    }
    if (req.method === "DELETE") return send(res, 200, { rev: deleteDoc(id) });
    return send(res, 405, { error: "Methode nicht erlaubt" });
  }

  if (req.method === "GET" && STATIC[p]) {
    const [file, type] = STATIC[p];
    try { return send(res, 200, await readFile(path.join(ROOT, file)), type); }
    catch (e) { if (e.code === "ENOENT") return send(res, 404, { error: "Datei fehlt: " + file }); throw e; }
  }
  return send(res, 404, { error: "Nicht gefunden" });
}

function onRequest(req, res) {
  handle(req, res).catch(e => {
    if (!e.status) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : "Serverfehler" });
  });
}

try {
  currentHost = wantedHost();
  if (isOpen() && !meta("phonePin")) resetPin(); // HOST set by hand to the network: other devices need a PIN too
  server = await listenOn(currentHost);
} catch (e) {
  if (e.code === "EADDRINUSE") console.error(`Port ${PORT} ist schon belegt. Starte mit einem anderen Port, z. B.: PORT=4322 npm start`);
  else console.error(e);
  process.exit(1);
}
console.log(`Karteikasten läuft: http://localhost:${PORT}`);
console.log(`Daten: ${path.join(DATA_DIR, "karteikasten.db")}`);
console.log(`Sicherungen: ${BACKUP_DIR}`);
if (isOpen()) logAddresses();
console.log("Beenden mit Ctrl+C.");

autoBackup();
setInterval(autoBackup, 60 * 60 * 1000).unref();

function shutdown() { server.close(); try { db.close(); } catch {} process.exit(0); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
