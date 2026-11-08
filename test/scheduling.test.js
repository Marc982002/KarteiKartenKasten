// When a card comes back. Checked for both engines: ts-fsrs (FSRS-6) and the built-in FSRS-5 fallback.
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { loadApp, json } from "./load-app.js";

const MIN = 60000, DAY = 86400000;
const NOW = Date.UTC(2026, 10, 8, 10, 0, 0);

for (const tsFsrs of [true, false]) {
  describe(tsFsrs ? "ts-fsrs (FSRS-6)" : "eingebaute Version (FSRS-5)", () => {
    let app;
    before(async () => { app = await loadApp({ tsFsrs }); });
    const outcomes = (prev, now = NOW, ret = 0.9) => app.get(`outcomes(${json(prev)}, ${now}, ${ret})`);
    // A card that was learned 'days' ago with 'ivl' days until it was due.
    const reviewCard = (ivl, s, last = NOW - ivl * DAY) => ({ q: 2, s, d: 5, due: last + ivl * DAY, last, reps: 3, lapses: 0, step: 0 });

    test("richtiger Rechenweg ist aktiv, ohne Warnungen", () => {
      assert.match(app.run("ENGINE"), tsFsrs ? /FSRS-6/ : /FSRS-5/);
      assert.deepEqual(app.warnings, []);
    });

    test("neue Karte: Nochmal und Gut bleiben in der Lernphase, Leicht springt auf Tage", () => {
      const [again, hard, good, easy] = outcomes(null);
      assert.equal(again.q, 1);
      assert.ok(again.due - NOW <= 2 * MIN, "Nochmal: nach etwa 1 Minute");
      assert.equal(good.q, 1);
      assert.ok(good.due - NOW >= 5 * MIN && good.due - NOW <= 15 * MIN, "Gut: nach etwa 10 Minuten");
      assert.equal(easy.q, 2);
      assert.ok(easy.due - NOW >= DAY, "Leicht: frühestens morgen");
      assert.ok(again.due <= hard.due && hard.due <= good.due && good.due < easy.due, "spätere Termine für bessere Bewertungen");
      for (const o of [again, hard, good, easy]) { assert.equal(o.reps, 1); assert.equal(o.lapses, 0); assert.equal(o.last, NOW); }
    });

    test("Lernphase: zweimal Gut macht die Karte zur gelernten Karte", () => {
      const first = outcomes(null)[2];
      const second = outcomes(first, first.due)[2];
      assert.equal(second.q, 2);
      assert.ok(second.due - first.due >= DAY);
    });

    test("fällige Wiederholung: bessere Bewertung, längerer Abstand; Gut wächst über den alten Abstand", () => {
      const prev = reviewCard(10, 10);
      const [again, hard, good, easy] = outcomes(prev);
      assert.ok(hard.due < good.due && good.due < easy.due);
      assert.ok(good.due - NOW > 10 * DAY, `Gut: ${(good.due - NOW) / DAY} Tage`);
      assert.ok(good.s > prev.s, "Gut macht die Erinnerung stabiler");
      assert.ok(again.s < prev.s, "Vergessen macht sie instabiler");
    });

    test("vergessen: zählt als Fehler und kommt nach etwa 10 Minuten wieder", () => {
      const again = outcomes(reviewCard(10, 10))[0];
      assert.equal(again.q, 3);
      assert.equal(again.lapses, 1);
      assert.ok(again.due - NOW <= 15 * MIN);
    });

    test("höheres Ziel heißt kürzere Abstände", () => {
      const prev = reviewCard(20, 20);
      const days = ret => (outcomes(prev, NOW, ret)[2].due - NOW) / DAY;
      const d80 = days(0.8), d90 = days(0.9), d95 = days(0.95);
      assert.ok(d95 < d90 && d90 < d80, `95 %: ${d95}, 90 %: ${d90}, 80 %: ${d80}`);
    });

    test("Abrufchance sinkt mit der Zeit", () => {
      const st = reviewCard(10, 10, NOW);
      const r = days => app.run(`recall(${json(st)}, ${NOW + days * DAY})`);
      assert.ok(r(1) > r(10) && r(10) > r(60));
      assert.ok(Math.abs(r(10) - 0.9) < 0.03, `bei Fälligkeit etwa 90 %: ${r(10)}`);
    });

    test("Abstände bleiben unter 100 Jahren", () => {
      const easy = outcomes(reviewCard(5000, 5000))[3];
      assert.ok(easy.due - NOW <= 36500 * DAY);
    });
  });
}

test("Lernstand übersteht Speichern und Laden unverändert", async () => {
  const app = await loadApp();
  const st = { q: 2, s: 12.3456, d: 4.567, due: NOW + 5 * DAY, last: NOW, reps: 4, lapses: 1, step: 0 };
  const back = app.get(`dec(enc(${json(st)}))`);
  assert.deepEqual(back, st);
  const card = { i: "k1", f: "Vorne", b: "Hinten", sf: st, sr: null, c: 0, x: true };
  const row = app.get(`toRow(${json(card)})`);
  assert.equal(row.x, 1, "ausgesetzt wird mitgespeichert");
  assert.deepEqual(app.get(`fromRow(${json(row)})`), { ...card, c: 0 });
});
