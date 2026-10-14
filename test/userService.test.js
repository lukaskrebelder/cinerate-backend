const test = require("node:test");
const assert = require("node:assert");
const { createUserService } = require("../services/userService");
const { AppError } = require("../lib/appError");

const gueltig = { firstName: " Ada ", lastName: "Lovelace", email: " Ada@Example.com ", password: "geheim123" };

// Ersatz-Repository, das sich merkt, was der Service ihm gibt
function fakeRepo() {
  const calls = { created: null, deleted: null };
  return {
    calls,
    createUser: async (data) => { calls.created = data; return 42; },
    deleteUser: async (id) => { calls.deleted = id; },
  };
}
const fakeHash = async (pw) => "hash:" + pw;

test("register speichert aufbereitete Daten und gibt die userId zurück", async () => {
  const repo = fakeRepo();
  const service = createUserService(repo, fakeHash);
  const result = await service.register(gueltig);
  assert.deepStrictEqual(result, { userId: "u_42" });
  assert.deepStrictEqual(repo.calls.created, {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    passwordHash: "hash:geheim123",
  });
});

test("register wirft 400 bei ungültigen Eingaben und speichert nichts", async () => {
  const repo = fakeRepo();
  const service = createUserService(repo, fakeHash);
  await assert.rejects(
    () => service.register({ ...gueltig, password: "kurz" }),
    (err) => err instanceof AppError && err.status === 400
  );
  assert.strictEqual(repo.calls.created, null);
});

test("deleteAccount löscht den eigenen Account", async () => {
  const repo = fakeRepo();
  const service = createUserService(repo, fakeHash);
  await service.deleteAccount("u_5", 5);
  assert.strictEqual(repo.calls.deleted, 5);
});

test("deleteAccount wirft 403 bei fremdem Account und löscht nichts", async () => {
  const repo = fakeRepo();
  const service = createUserService(repo, fakeHash);
  await assert.rejects(
    () => service.deleteAccount("u_6", 5),
    (err) => err instanceof AppError && err.status === 403
  );
  assert.strictEqual(repo.calls.deleted, null);
});