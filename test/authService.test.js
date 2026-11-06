// KI-Log A18
const test = require("node:test");
const assert = require("node:assert");
const { createAuthService } = require("../services/authService");
const { AppError } = require("../lib/appError");

// Attrappen: kein echtes bcrypt, keine Datenbank
function bauen({ user, session, limiter } = {}) {
  const gespeichert = [];
  const geloescht = [];
  const aufgeraeumt = [];
  const repo = {
    findUserByEmail: async () => user,
    createSession: async (id, hash) => { gespeichert.push([id, hash]); },
    findValidSession: async () => session,
    deleteExpiredSessions: async () => { aufgeraeumt.push(true); return 0; },
    deleteSession: async (id) => { geloescht.push(id); },
  };
  const verify = async (pw, hash) => pw === hash;
  const create = () => ({ token: "tok", tokenHash: "tokhash" });
  const hash = (t) => "h_" + t;
  return { service: createAuthService(repo, verify, create, hash, limiter), gespeichert, geloescht, aufgeraeumt };
}

const status = (code) => (err) => err instanceof AppError && err.status === code;

test("login ohne E-Mail oder Passwort wirft 400", async () => {
  const { service } = bauen();
  await assert.rejects(() => service.login({ email: "a@b.de" }), status(400));
  await assert.rejects(() => service.login(undefined), status(400));
});

test("login mit unbekannter E-Mail wirft 401", async () => {
  const { service } = bauen({ user: undefined });
  await assert.rejects(() => service.login({ email: "a@b.de", password: "x" }), status(401));
});

test("login mit falschem Passwort wirft 401", async () => {
  const { service } = bauen({ user: { id: 1, passwort_hash: "richtig" } });
  await assert.rejects(() => service.login({ email: "a@b.de", password: "falsch" }), status(401));
});

// KI-Log A41
test("login mit richtigen Daten gibt Token, userId und Rolle zurück und speichert nur den Hash", async () => {
  const { service, gespeichert } = bauen({ user: { id: 1, passwort_hash: "geheim123", rolle: "Nutzer" } });
  const result = await service.login({ email: "A@B.de", password: "geheim123" });
  assert.deepStrictEqual(result, { token: "tok", userId: "u_1", rolle: "Nutzer" });
  assert.deepStrictEqual(gespeichert, [[1, "tokhash"]]);
});

// KI-Log A41
test("login eines Moderators gibt die Rolle Moderator zurück", async () => {
  const { service } = bauen({ user: { id: 7, passwort_hash: "geheim123", rolle: "Moderator" } });
  const result = await service.login({ email: "m@b.de", password: "geheim123" });
  assert.deepStrictEqual(result, { token: "tok", userId: "u_7", rolle: "Moderator" });
});

test("authenticate gibt Nutzer-ID, Rolle und Sitzungs-ID zurück", async () => {
  const { service } = bauen({ session: { id: 9, nutzer_id: 4, rolle: "Moderator" } });
  assert.deepStrictEqual(await service.authenticate("tok"), { id: 4, rolle: "Moderator", sessionId: 9 });
});

test("authenticate wirft 401 bei unbekanntem oder abgelaufenem Token", async () => {
  const { service } = bauen({ session: undefined });
  await assert.rejects(() => service.authenticate("tok"), status(401));
});

test("logout löscht die Sitzung", async () => {
  const { service, geloescht } = bauen();
  await service.logout(9);
  assert.deepStrictEqual(geloescht, [9]);
});
// KI-Log A46
const { createAttemptLimiter } = require("../lib/attemptLimiter");

const richtig = { email: "a@b.de", password: "geheim123" };
const falsch = { email: "a@b.de", password: "falsch" };

// Nutzer mit Passwort "geheim123" und einem Limiter mit fester Uhr
function mitSperre() {
  let jetzt = 0;
  const limiter = createAttemptLimiter({ maxAttempts: 5, windowMs: 1000, now: () => jetzt });
  const teile = bauen({ user: { id: 1, passwort_hash: "geheim123", rolle: "Nutzer" }, limiter });
  return { ...teile, vorspulen: (ms) => { jetzt += ms; } };
}

async function fehlversuche(service, anzahl, daten = falsch) {
  for (let i = 0; i < anzahl; i++) {
    await assert.rejects(() => service.login(daten), status(401));
  }
}

test("nach 5 Fehlversuchen wirft login 429, auch mit richtigem Passwort", async () => {
  const { service, gespeichert } = mitSperre();
  await fehlversuche(service, 5);
  await assert.rejects(
    () => service.login(richtig),
    (err) => status(429)(err) && err.message === "Too many failed login attempts. Please try again later."
  );
  assert.deepStrictEqual(gespeichert, []);
});

test("4 Fehlversuche sperren noch nicht", async () => {
  const { service } = mitSperre();
  await fehlversuche(service, 4);
  assert.strictEqual((await service.login(richtig)).userId, "u_1");
});

test("nach Ablauf der Sperrzeit ist die Anmeldung wieder möglich", async () => {
  const { service, vorspulen } = mitSperre();
  await fehlversuche(service, 5);
  vorspulen(1000);
  assert.strictEqual((await service.login(richtig)).userId, "u_1");
});

test("eine erfolgreiche Anmeldung setzt den Zähler zurück", async () => {
  const { service } = mitSperre();
  await fehlversuche(service, 4);
  await service.login(richtig);
  await fehlversuche(service, 4);
  assert.strictEqual((await service.login(richtig)).userId, "u_1");
});

test("die Sperre gilt pro E-Mail, Groß- und Kleinschreibung zählt gleich", async () => {
  const { service } = mitSperre();
  await fehlversuche(service, 3, { email: "A@B.de", password: "falsch" });
  await fehlversuche(service, 2, { email: " a@b.de ", password: "falsch" });
  await assert.rejects(() => service.login(richtig), status(429));
  // Andere E-Mail ist nicht betroffen (der Attrappen-Nutzer passt zu jeder E-Mail)
  assert.strictEqual((await service.login({ email: "c@d.de", password: "geheim123" })).userId, "u_1");
});

test("auch Versuche mit unbekannter E-Mail zählen", async () => {
  let jetzt = 0;
  const limiter = createAttemptLimiter({ maxAttempts: 5, windowMs: 1000, now: () => jetzt });
  const { service } = bauen({ user: undefined, limiter });
  await fehlversuche(service, 5, { email: "x@y.de", password: "egal" });
  await assert.rejects(() => service.login({ email: "x@y.de", password: "egal" }), status(429));
});

test("login räumt abgelaufene Sitzungen nur bei erfolgreicher Anmeldung auf", async () => {
  const { service, aufgeraeumt } = mitSperre();
  await fehlversuche(service, 1);
  assert.strictEqual(aufgeraeumt.length, 0);
  await service.login(richtig);
  assert.strictEqual(aufgeraeumt.length, 1);
});
