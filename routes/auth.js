// Anmeldung und Abmeldung (US-2): nur HTTP, die Fachregeln stehen im authService.
// KI-Log A18
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { createSessionRepository } = require("../db/sessionRepository");
const { createAuthService } = require("../services/authService");

const authService = createAuthService(createSessionRepository());

// Anmeldung (US-2): POST /api/auth
router.post("/auth", async (req, res) => {
  const result = await authService.login(req.body);
  res.status(200).json(result); // { token, userId }
});

// Abmeldung (US-2): DELETE /api/auth
router.delete("/auth", requireAuth, async (req, res) => {
  await authService.logout(req.sessionId);
  res.status(200).json({ message: "Logout successful." });
});

module.exports = router;