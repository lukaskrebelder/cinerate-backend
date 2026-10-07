// Unit-Tests für lib/tokens.js (US-2).
const test = require("node:test");
const assert = require("node:assert");
const { hashToken, createToken } = require("../lib/tokens");

test("hashToken liefert den bekannten SHA-256-Wert", () => {
  // Offizieller SHA-256-Testwert für den Text "abc"
  assert.strictEqual(
    hashToken("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
});

test("hashToken liefert für denselben Text immer denselben Hash", () => {
  assert.strictEqual(hashToken("token-1"), hashToken("token-1"));
});

test("createToken erzeugt ein Token aus 64 Hex-Zeichen", () => {
  const { token } = createToken();
  assert.match(token, /^[0-9a-f]{64}$/);
});

test("createToken liefert den passenden Hash zum Token", () => {
  const { token, tokenHash } = createToken();
  assert.strictEqual(tokenHash, hashToken(token));
  assert.notStrictEqual(tokenHash, token);
});

test("createToken erzeugt bei jedem Aufruf ein anderes Token", () => {
  const erstes = createToken();
  const zweites = createToken();
  assert.notStrictEqual(erstes.token, zweites.token);
});