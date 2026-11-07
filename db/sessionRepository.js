// Repository für Sitzungen und Anmelde-Daten: enthält nur SQL.
// KI-Log A18
const defaultPool = require("./connection");

function createSessionRepository(pool = defaultPool) {
  // KI-Log A41
  // Nutzer für die Anmeldung per E-Mail suchen (undefined, wenn es ihn nicht gibt).
  async function findUserByEmail(email) {
    const result = await pool.query(
      "SELECT id, passwort_hash, rolle FROM Nutzer WHERE email = $1",
      [email]
    );
    return result.rows[0];
  }

  // Speichert nur den Hash des Tokens.
  async function createSession(userId, tokenHash) {
    await pool.query(
      "INSERT INTO Sitzung (nutzer_id, token_hash) VALUES ($1, $2)",
      [userId, tokenHash]
    );
  }

  // Gültige Sitzung samt Rolle des Nutzers (undefined, wenn unbekannt oder abgelaufen).
  async function findValidSession(tokenHash) {
    const result = await pool.query(
      `SELECT s.id, s.nutzer_id, n.rolle
         FROM Sitzung s JOIN Nutzer n ON n.id = s.nutzer_id
        WHERE s.token_hash = $1 AND s.laeuft_ab_am > NOW()`,
      [tokenHash]
    );
    return result.rows[0];
  }

  // KI-Log A46
  // Löscht alle abgelaufenen Sitzungen (nutzt den Index idx_sitzung_laeuft_ab) und gibt ihre Anzahl zurück.
  // "<=" passt zu findValidSession, die nur Sitzungen mit laeuft_ab_am > NOW() als gültig ansieht.
  async function deleteExpiredSessions() {
    const result = await pool.query("DELETE FROM Sitzung WHERE laeuft_ab_am <= NOW()");
    return result.rowCount;
  }

  async function deleteSession(sessionId) {
    await pool.query("DELETE FROM Sitzung WHERE id = $1", [sessionId]);
  }

  return { findUserByEmail, createSession, findValidSession, deleteExpiredSessions, deleteSession };
}

module.exports = { createSessionRepository };