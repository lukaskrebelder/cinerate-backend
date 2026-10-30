// KI-Log A15
const test = require("node:test");
const assert = require("node:assert");
const { createUserRepository } = require("../db/userRepository");
const { AppError } = require("../lib/appError");

const nutzer = { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", passwordHash: "hash" };

test("createUser gibt die neue ID zurück", async () => {
  const pool = { query: async () => ({ rows: [{ id: 7 }] }) };
  const repo = createUserRepository(pool);
  assert.strictEqual(await repo.createUser(nutzer), 7);
});

test("createUser übersetzt 23505 in AppError 409", async () => {
  const pool = { query: async () => { const e = new Error("duplicate"); e.code = "23505"; throw e; } };
  const repo = createUserRepository(pool);
  await assert.rejects(() => repo.createUser(nutzer), (err) => err instanceof AppError && err.status === 409);
});

test("createUser reicht andere Datenbankfehler unverändert weiter", async () => {
  const pool = { query: async () => { throw new Error("connection lost"); } };
  const repo = createUserRepository(pool);
  await assert.rejects(() => repo.createUser(nutzer), (err) => !(err instanceof AppError));
});

test("deleteUser löscht mit der übergebenen ID", async () => {
  let gesehen;
  const pool = { query: async (sql, params) => { gesehen = params; return { rows: [] }; } };
  await createUserRepository(pool).deleteUser(5);
  assert.deepStrictEqual(gesehen, [5]);
});