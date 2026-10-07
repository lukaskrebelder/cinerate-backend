// Anmeldung (US-2): POST /api/auth
const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { normalizeEmail, isNonEmptyText } = require("../lib/validation");
const { verifyPassword } = require("../lib/password");
const { createToken } = require("../lib/tokens");
const requireAuth = require("../middleware/requireAuth");

router.post("/auth", async (req, res) => {
  const body = req.body || {};

  if (!isNonEmptyText(body.email) || !isNonEmptyText(body.password)) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  const email = normalizeEmail(body.email);

  try {
    const result = await pool.query(
      "SELECT id, passwort_hash FROM Nutzer WHERE email = $1",
      [email]
    );
    const user = result.rows[0];

    // Unbekannte E-Mail und falsches Passwort bekommen dieselbe Antwort
    const passwordOk =
      user && (await verifyPassword(body.password, user.passwort_hash));
    if (!passwordOk) {
      return res
        .status(401)
        .json({ message: "Email or password is incorrect." });
    }

    // Token geht an den Nutzer, nur der Hash wird gespeichert
    const { token, tokenHash } = createToken();
    await pool.query(
      "INSERT INTO Sitzung (nutzer_id, token_hash) VALUES ($1, $2)",
      [user.id, tokenHash]
    );

    res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    res.status(503).json({ message: "Database is not reachable." });
  }
});

// Abmeldung (US-2): DELETE /api/auth
router.delete("/auth", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM Sitzung WHERE id = $1", [req.sessionId]);
    res.status(200).json({ message: "Logout successful." });
  } catch (err) {
    console.error(err);
    res.status(503).json({ message: "Database is not reachable." });
  }
});

module.exports = router;