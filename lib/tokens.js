// Token für die Anmeldung (US-2).
// Das Token selbst bekommt nur der Nutzer. In der Datenbank (Tabelle Sitzung)
// steht ausschliesslich sein SHA-256-Hash.
// KI-Log A5
const crypto = require("crypto");

// Gleicher Text ergibt immer denselben Hash. Dadurch kann das Backend
// ein mitgeschicktes Token in der Tabelle suchen (WHERE token_hash = ...).
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Erzeugt ein neues zufälliges Token (64 Hex-Zeichen) und dessen Hash.
function createToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

module.exports = { hashToken, createToken };