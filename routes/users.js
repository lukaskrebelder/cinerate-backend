// Registrierung (US-2): POST /api/users
const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { normalizeEmail, isValidRegistration } = require("../lib/validation");
const { hashPassword } = require("../lib/password");
const requireAuth = require("../middleware/requireAuth");

router.post("/users", async (req, res) => {
  if (!isValidRegistration(req.body)) {
    return res
      .status(400)
      .json({ message: "Invalid email or password (at least 8 characters)." });
  }

  const firstName = req.body.firstName.trim();
  const lastName = req.body.lastName.trim();
  const email = normalizeEmail(req.body.email);

  try {
    const passwordHash = await hashPassword(req.body.password);
    const result = await pool.query(
      "INSERT INTO Nutzer (vorname, nachname, email, passwort_hash) VALUES ($1, $2, $3, $4) RETURNING id",
      [firstName, lastName, email, passwordHash]
    );
    res.status(201).json({
      message: "Account has been created.",
      userId: "u_" + result.rows[0].id,
    });
  } catch (err) {
    // 23505 = UNIQUE-Regel verletzt, die E-Mail gibt es schon
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    }
    console.error(err);
    res.status(503).json({ message: "Database is not reachable." });
  }
});

// Account loeschen (US-2): DELETE /api/users/{userId}
router.delete("/users/:userId", requireAuth, async (req, res) => {
  // Man darf nur den eigenen Account loeschen
  if (req.params.userId !== "u_" + req.user.id) {
    return res
      .status(403)
      .json({ message: "You can only delete your own account." });
  }

  try {
    // ON DELETE CASCADE löscht Sitzungen, Bewertungen, Kommentare und Watchlist mit
    await pool.query("DELETE FROM Nutzer WHERE id = $1", [req.user.id]);
    res.status(200).json({ message: "Account has been deleted." });
  } catch (err) {
    console.error(err);
    res.status(503).json({ message: "Database is not reachable." });
  }
});

module.exports = router;