// KI-Log A18
const test = require("node:test");
const assert = require("node:assert");
const { createSessionRepository } = require("../db/sessionRepository");

// KI-Log A41
test("findUserByEmail gibt die erste Zeile zurück", async () => {
  const pool = { query: async () => ({ rows: [{ id: 3, passwort_hash: "h", rolle: "Nutzer" }] }) };
  const user = await createSessionRepository(pool).findUserByEmail("a@b.de");
  assert.deepStrictEqual(user, { id: 3, passwort_hash: "h", rolle: "Nutzer" });
});

// KI-Log A41
test("findUserByEmail fragt die Rolle mit ab", async () => {
  let sql;
  const pool = { query: async (text) => { sql = text; return { rows: [] }; } };
  await createSessionRepository(pool).findUserByEmail("a@b.de");
  assert.match(sql, /SELECT id, passwort_hash, rolle FROM Nutzer/);
});

test("findUserByEmail gibt undefined zurück, wenn es den Nutzer nicht gibt", async () => {
  const pool = { query: async () => ({ rows: [] }) };
  assert.strictEqual(await createSessionRepository(pool).findUserByEmail("x@y.de"), undefined);
});

test("createSession speichert Nutzer-ID und Token-Hash", async () => {
  let gesehen;
  const pool = { query: async (sql, params) => { gesehen = params; return { rows: [] }; } };
  await createSessionRepository(pool).createSession(4, "hash");
  assert.deepStrictEqual(gesehen, [4, "hash"]);
});

test("findValidSession liefert die Sitzung mit Rolle", async () => {
  const pool = { query: async () => ({ rows: [{ id: 9, nutzer_id: 4, rolle: "Moderator" }] }) };
  const s = await createSessionRepository(pool).findValidSession("hash");
  assert.strictEqual(s.rolle, "Moderator");
});

test("findValidSession gibt undefined zurück, wenn nichts gefunden wird", async () => {
  const pool = { query: async () => ({ rows: [] }) };
  assert.strictEqual(await createSessionRepository(pool).findValidSession("hash"), undefined);
});

test("deleteSession löscht mit der übergebenen ID", async () => {
  let gesehen;
  const pool = { query: async (sql, params) => { gesehen = params; return { rows: [] }; } };
  await createSessionRepository(pool).deleteSession(9);
  assert.deepStrictEqual(gesehen, [9]);
});