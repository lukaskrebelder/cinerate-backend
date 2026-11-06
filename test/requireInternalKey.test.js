// KI-Log A45
const test = require("node:test");
const assert = require("node:assert");
const { AppError } = require("../lib/appError");
const { createRequireInternalKey } = require("../middleware/requireInternalKey");

// Führt die Middleware aus und liefert, womit next aufgerufen wurde
function run(middleware, headers = {}) {
  const req = { get: (name) => headers[name.toLowerCase()] };
  let calledWith = "nicht aufgerufen";
  middleware(req, {}, (err) => { calledWith = err; });
  return calledWith;
}

test("ohne konfigurierten Schlüssel wird nichts geprüft", () => {
  assert.strictEqual(run(createRequireInternalKey(undefined)), undefined);
  assert.strictEqual(run(createRequireInternalKey("")), undefined);
});

test("mit richtigem Schlüssel geht die Anfrage weiter", () => {
  const middleware = createRequireInternalKey("geheim-123");
  assert.strictEqual(run(middleware, { "x-internal-key": "geheim-123" }), undefined);
});

test("fehlender, falscher oder unvollständiger Schlüssel ergibt 403", () => {
  const middleware = createRequireInternalKey("geheim-123");
  for (const headers of [{}, { "x-internal-key": "falsch" }, { "x-internal-key": "geheim-12" }, { "x-internal-key": "" }]) {
    const err = run(middleware, headers);
    assert.ok(err instanceof AppError, JSON.stringify(headers));
    assert.strictEqual(err.status, 403);
    assert.strictEqual(err.message, "Access is only allowed via the BFF.");
  }
});
