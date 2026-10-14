const test = require("node:test");
const assert = require("node:assert");
const { AppError, handleError } = require("../lib/appError");

// Minimale Attrappe für res, die Status und Body merkt
function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("AppError behält Status und Meldung", () => {
  const err = new AppError(409, "An account with this email already exists.");
  assert.strictEqual(err.status, 409);
  assert.strictEqual(err.message, "An account with this email already exists.");
});

test("handleError antwortet bei AppError mit dessen Status", () => {
  const res = fakeRes();
  handleError(new AppError(400, "Bad input."), res);
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.body, { message: "Bad input." });
});

test("handleError antwortet bei unbekanntem Fehler mit 503", () => {
  const res = fakeRes();
  const original = console.error;
  console.error = () => {}; // Ausgabe im Test unterdrücken
  handleError(new Error("boom"), res);
  console.error = original;
  assert.strictEqual(res.statusCode, 503);
  assert.deepStrictEqual(res.body, { message: "Database is not reachable." });
});