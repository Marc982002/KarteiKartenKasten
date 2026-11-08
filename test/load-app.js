// Loads the real app code from public/index.html into a sandbox, so the tests check
// exactly what runs in the browser. The page itself is replaced by a few stand-ins.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const html = readFileSync(new URL("public/index.html", ROOT), "utf8");
const APP_CODE = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
const TS_FSRS = readFileSync(new URL("node_modules/ts-fsrs/dist/index.umd.js", ROOT), "utf8");

const noop = () => {};
function fakeElement() {
  return { innerHTML: "", textContent: "", hidden: true, value: "", style: {}, dataset: {},
    classList: { add: noop, remove: noop, contains: () => false },
    focus: noop, scrollIntoView: noop, click: noop, remove: noop, appendChild: noop,
    querySelector: () => null, querySelectorAll: () => [] };
}

/**
 * @param {{ tsFsrs?: boolean }} opts  tsFsrs: false loads the app without the ts-fsrs library (built-in fallback).
 * @returns {Promise<{ run: (code: string) => any, get: (code: string) => any, warnings: string[], downloads: { name: string, blob: Blob }[] }>}
 */
export async function loadApp({ tsFsrs = true } = {}) {
  const elements = { "#app": fakeElement(), "#toast": fakeElement() };
  const warnings = [], downloads = [];
  const later = (fn, ms, ...a) => { const t = setTimeout(fn, ms, ...a); t.unref?.(); return t; };
  const sandbox = {
    console: { ...console, warn: (...a) => warnings.push(a.join(" ")), log: noop },
    document: {
      addEventListener: noop, body: fakeElement(), visibilityState: "visible",
      querySelector: sel => elements[sel] || null, querySelectorAll: () => [],
      createElement: () => { const a = fakeElement(); a.click = () => downloads.push({ name: a.download, blob: blobs.get(a.href) }); return a; }
    },
    addEventListener: noop,
    location: { reload: noop },
    fetch: () => Promise.reject(new Error("kein Server im Test")), // the app falls back to in-memory storage
    setTimeout: later, clearTimeout, setInterval: later, clearInterval,
    TextEncoder, Blob,
    URL: Object.assign(function (...a) { return new URL(...a); }, { createObjectURL: b => { const k = "blob:" + blobs.size; blobs.set(k, b); return k; }, revokeObjectURL: noop })
  };
  const blobs = new Map();
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  if (tsFsrs) vm.runInContext(TS_FSRS, sandbox, { filename: "ts-fsrs.js" });
  vm.runInContext(APP_CODE, sandbox, { filename: "index.html" });
  const run = code => vm.runInContext(code, sandbox);
  // Same as run, but the result comes back as plain data, comparable with assert.deepEqual.
  const get = code => { const out = run(`JSON.stringify(${code})`); return out === undefined ? undefined : JSON.parse(out); };
  for (let i = 0; i < 200 && run("state.loading"); i++) await new Promise(r => setTimeout(r, 5));
  if (run("state.loading")) throw new Error("App ist im Test nicht hochgefahren");
  return { run, get, warnings, downloads };
}

// Passes plain data into the sandbox as its own objects (JSON keeps it free of cross-realm surprises).
export const json = v => `JSON.parse(${JSON.stringify(JSON.stringify(v))})`;
