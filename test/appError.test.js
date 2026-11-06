// KI-Log A15
const test = require("node:test");
const assert = require("node:assert");
const { AppError, handleError, isDatabaseUnavailable } = require("../lib/appError");

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

// KI-Log A43
// Ruft handleError auf, ohne dass console.error die Testausgabe füllt
function handleQuietly(err) {
  const res = fakeRes();
  const original = console.error;
  console.error = () => {};
  try {
    handleError(err, res);
  } finally {
    console.error = original;
  }
  return res;
}

const withCode = (code, message = "db error") => Object.assign(new Error(message), { code });

test("handleError antwortet bei einem Programmierfehler mit 500", () => {
  const res = handleQuietly(new TypeError("Cannot read properties of undefined"));
  assert.strictEqual(res.statusCode, 500);
  assert.deepStrictEqual(res.body, { message: "Internal server error." });
});

test("handleError antwortet bei einem SQL-Fehler, der kein Verbindungsfehler ist, mit 500", () => {
  // 42P01 = Tabelle gibt es nicht: die Datenbank läuft, der Fehler liegt im Code oder Schema
  assert.strictEqual(handleQuietly(withCode("42P01")).statusCode, 500);
});

test("handleError antwortet mit 503, wenn die Datenbank nicht erreichbar ist", () => {
  const faelle = [
    withCode("ECONNREFUSED"),
    withCode("ENOTFOUND"),
    withCode("ETIMEDOUT"),
    withCode("08006"), // Verbindung abgebrochen
    withCode("57P01"), // Server wird heruntergefahren
    withCode("53300"), // zu viele Verbindungen
    new Error("Connection terminated unexpectedly"),
  ];
  for (const err of faelle) {
    const res = handleQuietly(err);
    assert.strictEqual(res.statusCode, 503, `${err.code ?? err.message}`);
    assert.deepStrictEqual(res.body, { message: "Database is not reachable." });
  }
});

test("isDatabaseUnavailable ist bei Werten ohne code und message false", () => {
  assert.strictEqual(isDatabaseUnavailable(undefined), false);
  assert.strictEqual(isDatabaseUnavailable({}), false);
  assert.strictEqual(isDatabaseUnavailable(withCode(42)), false);
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

test("errorMiddleware gibt bei unbekanntem Fehler an handleError weiter (500)", () => {
  const res = fakeRes();
  const original = console.error;
  console.error = () => {};
  errorMiddleware(new Error("boom"), {}, res, () => {});
  console.error = original;
  assert.strictEqual(res.statusCode, 500);
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
