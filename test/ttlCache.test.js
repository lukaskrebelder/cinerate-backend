const test = require("node:test");
const assert = require("node:assert");
const { createTtlCache } = require("../lib/ttlCache");

test("zweiter Aufruf innerhalb der TTL kommt aus dem Cache", async () => {
  let t = 0;
  const cache = createTtlCache({ ttlMs: 1000, now: () => t });
  let calls = 0;
  const loader = async () => { calls++; return "wert"; };

  assert.strictEqual(await cache.getOrLoad("k", loader), "wert");
  t = 500;
  assert.strictEqual(await cache.getOrLoad("k", loader), "wert");
  assert.strictEqual(calls, 1);
  assert.deepStrictEqual(cache.stats(), { hits: 1, misses: 1, size: 1 });
});

test("nach Ablauf der TTL wird neu geladen", async () => {
  let t = 0;
  const cache = createTtlCache({ ttlMs: 1000, now: () => t });
  let calls = 0;
  const loader = async () => { calls++; return calls; };

  await cache.getOrLoad("k", loader);
  t = 1001;
  assert.strictEqual(await cache.getOrLoad("k", loader), 2);
  assert.strictEqual(calls, 2);
});

test("gleichzeitige Anfragen laden nur einmal", async () => {
  const cache = createTtlCache();
  let calls = 0;
  const loader = async () => { calls++; return "x"; };

  const [a, b] = await Promise.all([cache.getOrLoad("k", loader), cache.getOrLoad("k", loader)]);
  assert.strictEqual(a, "x");
  assert.strictEqual(b, "x");
  assert.strictEqual(calls, 1);
});

test("Fehler werden nicht gespeichert", async () => {
  const cache = createTtlCache();
  await assert.rejects(() => cache.getOrLoad("k", async () => { throw new Error("boom"); }));
  assert.strictEqual(await cache.getOrLoad("k", async () => "ok"), "ok");
});

test("bei vollem Speicher fliegt der älteste Eintrag raus", async () => {
  const cache = createTtlCache({ maxEntries: 2 });
  let callsA = 0;
  await cache.getOrLoad("a", async () => { callsA++; return 1; });
  await cache.getOrLoad("b", async () => 2);
  await cache.getOrLoad("c", async () => 3); // verdrängt "a"
  await cache.getOrLoad("a", async () => { callsA++; return 1; });
  assert.strictEqual(callsA, 2);
});