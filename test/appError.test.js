// KI-Log A15
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

// KI-Log A42
const { errorMiddleware, notFoundMiddleware } = require("../lib/appError");

test("errorMiddleware antwortet bei AppError mit dessen Status", () => {
  const res = fakeRes();
  errorMiddleware(new AppError(404, "No movie found for this ID."), {}, res, () => {});
  assert.strictEqual(res.statusCode, 404);
  assert.deepStrictEqual(res.body, { message: "No movie found for this ID." });
});

test("errorMiddleware antwortet bei ungültigem JSON mit 400", () => {
  const res = fakeRes();
  const err = Object.assign(new SyntaxError("Unexpected token"), {
    type: "entity.parse.failed",
    status: 400,
    expose: true,
  });
  errorMiddleware(err, {}, res, () => {});
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.body, { message: "Request body is not valid JSON." });
});

test("errorMiddleware gibt bei unbekanntem Fehler an handleError weiter (503)", () => {
  const res = fakeRes();
  const original = console.error;
  console.error = () => {};
  errorMiddleware(new Error("boom"), {}, res, () => {});
  console.error = original;
  assert.strictEqual(res.statusCode, 503);
});

test("errorMiddleware übergibt an Express, wenn die Antwort schon gesendet wird", () => {
  const res = { ...fakeRes(), headersSent: true };
  const err = new Error("zu spät");
  let weitergereicht;
  errorMiddleware(err, {}, res, (e) => { weitergereicht = e; });
  assert.strictEqual(weitergereicht, err);
  assert.strictEqual(res.statusCode, null);
});

test("notFoundMiddleware antwortet mit 404", () => {
  const res = fakeRes();
  notFoundMiddleware({}, res);
  assert.strictEqual(res.statusCode, 404);
  assert.deepStrictEqual(res.body, { message: "Route not found." });
});
