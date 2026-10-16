// Anmeldung und Abmeldung (US-2): nur HTTP, die Fachregeln stehen im authService.
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { handleError } = require("../lib/appError");
const { createSessionRepository } = require("../db/sessionRepository");
const { createAuthService } = require("../services/authService");

const authService = createAuthService(createSessionRepository());

// Anmeldung (US-2): POST /api/auth
router.post("/auth", async (req, res) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result); // { token, userId }
  } catch (err) {
    handleError(err, res);
  }
});

// Abmeldung (US-2): DELETE /api/auth
router.delete("/auth", requireAuth, async (req, res) => {
  try {
    await authService.logout(req.sessionId);
    res.status(200).json({ message: "Logout successful." });
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;