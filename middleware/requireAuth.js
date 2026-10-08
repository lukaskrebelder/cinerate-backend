// Prüft den Header "Authorization: Bearer <token>" bei geschützten Routen.
// Gültig ist ein Token, dessen Hash in der Tabelle Sitzung steht und nicht abgelaufen ist.
const pool = require("../db/connection");
const { hashToken } = require("../lib/tokens");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Invalid token." });
  }

  try {
    const result = await pool.query(
      "SELECT id, nutzer_id FROM Sitzung WHERE token_hash = $1 AND laeuft_ab_am > NOW()",
      [hashToken(token)]
    );
    const session = result.rows[0];
    if (!session) {
      return res.status(401).json({ message: "Invalid token." });
    }

    // Nachfolgende Routen wissen damit, wer angemeldet ist
    req.user = { id: session.nutzer_id };
    req.sessionId = session.id;
    next();
  } catch (err) {
    console.error(err);
    res.status(503).json({ message: "Database is not reachable." });
  }
}

module.exports = requireAuth;