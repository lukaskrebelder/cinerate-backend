// Fachregeln für Anmeldung und Sitzung (US-2). Kennt weder HTTP (req/res) noch SQL.
// KI-Log A18
const { AppError } = require("../lib/appError");
const { normalizeEmail, isNonEmptyText } = require("../lib/validation");
const { verifyPassword: defaultVerifyPassword } = require("../lib/password");
const { createToken: defaultCreateToken, hashToken: defaultHashToken } = require("../lib/tokens");

// sessionRepository: siehe db/sessionRepository.js
// Die drei Funktionen lassen sich im Test durch schnelle Attrappen ersetzen.
function createAuthService(
  sessionRepository,
  verifyPassword = defaultVerifyPassword,
  createToken = defaultCreateToken,
  hashToken = defaultHashToken
) {
  // KI-Log A41
  // Anmeldung: prüft die Zugangsdaten und gibt Token, userId und Rolle zurück.
  async function login(data) {
    const body = data || {};
    if (!isNonEmptyText(body.email) || !isNonEmptyText(body.password)) {
      throw new AppError(400, "Email and password are required.");
    }

    const user = await sessionRepository.findUserByEmail(normalizeEmail(body.email));

    // Unbekannte E-Mail und falsches Passwort bekommen dieselbe Antwort
    const passwordOk = user && (await verifyPassword(body.password, user.passwort_hash));
    if (!passwordOk) {
      throw new AppError(401, "Email or password is incorrect.");
    }

    // KI-Log A46
    // Abgelaufene Sitzungen aller Nutzer aufräumen, sonst wächst die Tabelle Sitzung unbegrenzt
    await sessionRepository.deleteExpiredSessions();

    // Token geht an den Nutzer, nur der Hash wird gespeichert
    const { token, tokenHash } = createToken();
    await sessionRepository.createSession(user.id, tokenHash);
    return { token, userId: "u_" + user.id, rolle: user.rolle };
  }

  // Token prüfen: gibt den angemeldeten Nutzer zurück oder wirft 401.
  async function authenticate(token) {
    const session = await sessionRepository.findValidSession(hashToken(token));
    if (!session) {
      throw new AppError(401, "Invalid token.");
    }
    return { id: session.nutzer_id, rolle: session.rolle, sessionId: session.id };
  }

  // Abmeldung: beendet die aktuelle Sitzung.
  async function logout(sessionId) {
    await sessionRepository.deleteSession(sessionId);
  }

  return { login, authenticate, logout };
}

module.exports = { createAuthService };