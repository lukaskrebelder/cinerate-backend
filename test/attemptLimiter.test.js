// KI-Log A46
const test = require("node:test");
const assert = require("node:assert");
const { createAttemptLimiter } = require("../lib/attemptLimiter");

// Limiter mit Uhr, die der Test selbst weiterstellt
function bauen(options = {}) {
  let jetzt = 1000;
  const limiter = createAttemptLimiter({ maxAttempts: 3, windowMs: 100, now: () => jetzt, ...options });
  return { limiter, vorspulen: (ms) => { jetzt += ms; } };
}

test("ein unbekannter Schlüssel ist nicht gesperrt", () => {
  assert.strictEqual(bauen().limiter.isBlocked("a"), false);
});

test("gesperrt erst ab maxAttempts Fehlversuchen", () => {
  const { limiter } = bauen();
  limiter.recordFailure("a");
  limiter.recordFailure("a");
  assert.strictEqual(limiter.isBlocked("a"), false);
  limiter.recordFailure("a");
  assert.strictEqual(limiter.isBlocked("a"), true);
});

test("die Sperre endet windowMs nach dem ersten Fehlversuch", () => {
  const { limiter, vorspulen } = bauen();
  limiter.recordFailure("a");
  vorspulen(50);
  limiter.recordFailure("a");
  limiter.recordFailure("a");
  vorspulen(49);
  assert.strictEqual(limiter.isBlocked("a"), true);
  vorspulen(1);
  assert.strictEqual(limiter.isBlocked("a"), false);
  assert.strictEqual(limiter.size(), 0);
});

test("nach Ablauf beginnt die Zählung neu", () => {
  const { limiter, vorspulen } = bauen();
  limiter.recordFailure("a");
  limiter.recordFailure("a");
  vorspulen(100);
  limiter.recordFailure("a");
  assert.strictEqual(limiter.isBlocked("a"), false);
});

test("reset löscht die Fehlversuche", () => {
  const { limiter } = bauen();
  limiter.recordFailure("a");
  limiter.recordFailure("a");
  limiter.recordFailure("a");
  limiter.reset("a");
  assert.strictEqual(limiter.isBlocked("a"), false);
});

test("Schlüssel werden getrennt gezählt", () => {
  const { limiter } = bauen();
  for (let i = 0; i < 3; i++) limiter.recordFailure("a");
  assert.strictEqual(limiter.isBlocked("b"), false);
});

test("bei vollem Speicher fliegt der älteste Eintrag raus", () => {
  const { limiter } = bauen({ maxEntries: 2 });
  limiter.recordFailure("a");
  limiter.recordFailure("b");
  limiter.recordFailure("c");
  assert.strictEqual(limiter.size(), 2);
  for (let i = 0; i < 2; i++) limiter.recordFailure("a"); // "a" beginnt wieder bei 1
  assert.strictEqual(limiter.isBlocked("a"), false);
});
