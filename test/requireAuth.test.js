// KI-Log A18
const test = require("node:test");
const assert = require("node:assert");
const { createRequireAuth } = require("../middleware/requireAuth");
const { AppError } = require("../lib/appError");

function antwort() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const fakeService = {
  authenticate: async (token) => {
    if (token !== "gut") throw new AppError(401, "Invalid token.");
    return { id: 4, rolle: "Moderator", sessionId: 9 };
  },
};

test("ohne Authorization-Header gibt es 401 und next wird nicht aufgerufen", async () => {
  const res = antwort();
  let weiter = false;
  await createRequireAuth(fakeService)({ headers: {} }, res, () => { weiter = true; });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(weiter, false);
});

test("mit falschem Schema gibt es 401", async () => {
  const res = antwort();
  await createRequireAuth(fakeService)({ headers: { authorization: "Basic gut" } }, res, () => {});
  assert.strictEqual(res.statusCode, 401);
});

test("mit ungültigem Token gibt es 401", async () => {
  const res = antwort();
  await createRequireAuth(fakeService)({ headers: { authorization: "Bearer schlecht" } }, res, () => {});
  assert.strictEqual(res.statusCode, 401);
});

test("mit gültigem Token setzt es req.user mit Rolle und ruft next auf", async () => {
  const req = { headers: { authorization: "Bearer gut" } };
  let weiter = false;
  await createRequireAuth(fakeService)(req, antwort(), () => { weiter = true; });
  assert.deepStrictEqual(req.user, { id: 4, rolle: "Moderator" });
  assert.strictEqual(req.sessionId, 9);
  assert.strictEqual(weiter, true);
});

test("bei Datenbankfehler gibt es 503", async () => {
  const kaputt = { authenticate: async () => { throw new Error("connection lost"); } };
  const res = antwort();
  await createRequireAuth(kaputt)({ headers: { authorization: "Bearer gut" } }, res, () => {});
  assert.strictEqual(res.statusCode, 503);
});