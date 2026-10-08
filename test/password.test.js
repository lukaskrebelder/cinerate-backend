// Unit-Tests für lib/password.js (US-2).
const test = require("node:test");
const assert = require("node:assert");
const { hashPassword, verifyPassword } = require("../lib/password");

test("hashPassword speichert das Passwort nicht im Klartext", async () => {
  const hash = await hashPassword("geheim123");
  assert.notStrictEqual(hash, "geheim123");
  // bcrypt-Hashes beginnen immer mit $2
  assert.ok(hash.startsWith("$2"));
});

test("verifyPassword akzeptiert das richtige Passwort", async () => {
  const hash = await hashPassword("geheim123");
  assert.strictEqual(await verifyPassword("geheim123", hash), true);
});

test("verifyPassword lehnt ein falsches Passwort ab", async () => {
  const hash = await hashPassword("geheim123");
  assert.strictEqual(await verifyPassword("falsches-passwort", hash), false);
});

test("zwei Hashes desselben Passworts sind verschieden (Salt)", async () => {
  const hash1 = await hashPassword("geheim123");
  const hash2 = await hashPassword("geheim123");
  assert.notStrictEqual(hash1, hash2);
});