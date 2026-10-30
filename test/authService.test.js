// KI-Log A18
const test = require("node:test");
const assert = require("node:assert");
const { createAuthService } = require("../services/authService");
const { AppError } = require("../lib/appError");

// Attrappen: kein echtes bcrypt, keine Datenbank
function bauen({ user, session } = {}) {
  const gespeichert = [];
  const geloescht = [];
  const repo = {
    findUserByEmail: async () => user,
    createSession: async (id, hash) => { gespeichert.push([id, hash]); },
    findValidSession: async () => session,
    deleteSession: async (id) => { geloescht.push(id); },
  };
  const verify = async (pw, hash) => pw === hash;
  const create = () => ({ token: "tok", tokenHash: "tokhash" });
  const hash = (t) => "h_" + t;
  return { service: createAuthService(repo, verify, create, hash), gespeichert, geloescht };
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

test("login mit richtigen Daten gibt Token und userId zurück und speichert nur den Hash", async () => {
  const { service, gespeichert } = bauen({ user: { id: 1, passwort_hash: "geheim123" } });
  const result = await service.login({ email: "A@B.de", password: "geheim123" });
  assert.deepStrictEqual(result, { token: "tok", userId: "u_1" });
  assert.deepStrictEqual(gespeichert, [[1, "tokhash"]]);
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