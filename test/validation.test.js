// Unit-Tests für die Prüfregeln aus lib/validation.js (US-2).
const test = require("node:test");
const assert = require("node:assert");
const {
  normalizeEmail,
  isValidEmail,
  isValidPassword,
  isNonEmptyText,
  isValidRegistration,
} = require("../lib/validation");

// ---------- normalizeEmail ----------

test("normalizeEmail entfernt Leerzeichen und macht alles klein", () => {
  assert.strictEqual(normalizeEmail("  Max@Example.COM  "), "max@example.com");
});

test("normalizeEmail gibt bei Nicht-Text einen leeren Text zurück", () => {
  assert.strictEqual(normalizeEmail(undefined), "");
  assert.strictEqual(normalizeEmail(123), "");
});

// ---------- isValidEmail ----------

test("isValidEmail akzeptiert eine normale E-Mail-Adresse", () => {
  assert.strictEqual(isValidEmail("max@example.com"), true);
});

test("isValidEmail lehnt Adressen ohne @ ab", () => {
  assert.strictEqual(isValidEmail("max.example.com"), false);
});

test("isValidEmail lehnt Adressen ohne Punkt nach dem @ ab", () => {
  assert.strictEqual(isValidEmail("max@example"), false);
});

test("isValidEmail lehnt Adressen mit Leerzeichen ab", () => {
  assert.strictEqual(isValidEmail("max @example.com"), false);
});

test("isValidEmail lehnt leeren Text und Nicht-Text ab", () => {
  assert.strictEqual(isValidEmail(""), false);
  assert.strictEqual(isValidEmail(null), false);
});

// ---------- isValidPassword (Kriterium 2.4: mindestens 8 Zeichen) ----------

test("isValidPassword lehnt 7 Zeichen ab (Grenzwert)", () => {
  assert.strictEqual(isValidPassword("1234567"), false);
});

test("isValidPassword akzeptiert genau 8 Zeichen (Grenzwert)", () => {
  assert.strictEqual(isValidPassword("12345678"), true);
});

test("isValidPassword lehnt Nicht-Text ab", () => {
  assert.strictEqual(isValidPassword(undefined), false);
  assert.strictEqual(isValidPassword(12345678), false);
});

// ---------- isNonEmptyText ----------

test("isNonEmptyText akzeptiert normalen Text", () => {
  assert.strictEqual(isNonEmptyText("Max"), true);
});

test("isNonEmptyText lehnt leeren Text und nur Leerzeichen ab", () => {
  assert.strictEqual(isNonEmptyText(""), false);
  assert.strictEqual(isNonEmptyText("   "), false);
});

// ---------- isValidRegistration ----------

const gueltig = {
  firstName: "Max",
  lastName: "Mustermann",
  email: "max@example.com",
  password: "geheim123",
};

test("isValidRegistration akzeptiert vollständige, gültige Daten", () => {
  assert.strictEqual(isValidRegistration(gueltig), true);
});

test("isValidRegistration akzeptiert E-Mail mit Leerzeichen und Großbuchstaben", () => {
  assert.strictEqual(
    isValidRegistration({ ...gueltig, email: "  Max@Example.com " }),
    true
  );
});

test("isValidRegistration lehnt fehlenden Vornamen ab", () => {
  assert.strictEqual(isValidRegistration({ ...gueltig, firstName: "" }), false);
});

test("isValidRegistration lehnt fehlenden Nachnamen ab", () => {
  assert.strictEqual(isValidRegistration({ ...gueltig, lastName: "  " }), false);
});

test("isValidRegistration lehnt ungültige E-Mail ab", () => {
  assert.strictEqual(isValidRegistration({ ...gueltig, email: "kein-email" }), false);
});

test("isValidRegistration lehnt zu kurzes Passwort ab", () => {
  assert.strictEqual(isValidRegistration({ ...gueltig, password: "1234567" }), false);
});

test("isValidRegistration lehnt fehlende Daten ab", () => {
  assert.strictEqual(isValidRegistration(null), false);
  assert.strictEqual(isValidRegistration(undefined), false);
  assert.strictEqual(isValidRegistration({}), false);
});