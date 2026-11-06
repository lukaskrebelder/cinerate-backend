// KI-Log A44
const test = require("node:test");
const assert = require("node:assert");
const pool = require("../db/connection");

test("der Pool hat einen Listener für das error-Event", () => {
  assert.strictEqual(pool.listenerCount("error"), 1);
});

test("ein error-Event am Pool beendet den Prozess nicht, sondern wird geloggt", () => {
  // Ohne Listener würde emit den Fehler werfen (und im Betrieb den Prozess beenden)
  const geloggt = [];
  const original = console.error;
  console.error = (...args) => geloggt.push(args.join(" "));
  try {
    assert.doesNotThrow(() => pool.emit("error", new Error("terminating connection due to administrator command")));
  } finally {
    console.error = original;
  }
  assert.strictEqual(geloggt.length, 1);
  assert.match(geloggt[0], /terminating connection due to administrator command/);
});
