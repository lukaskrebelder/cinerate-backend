// Nutzer-Routen (US-2): nur HTTP, die Fachregeln stehen im userService.
// KI-Log A15
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { handleError } = require("../lib/appError");
const { createUserRepository } = require("../db/userRepository");
const { createUserService } = require("../services/userService");

const userService = createUserService(createUserRepository());

// Registrierung (US-2): POST /api/users
router.post("/users", async (req, res) => {
  try {
    const { userId } = await userService.register(req.body);
    res.status(201).json({ message: "Account has been created.", userId });
  } catch (err) {
    handleError(err, res);
  }
});

// Account loeschen (US-2): DELETE /api/users/{userId}
router.delete("/users/:userId", requireAuth, async (req, res) => {
  try {
    await userService.deleteAccount(req.params.userId, req.user.id);
    res.status(200).json({ message: "Account has been deleted." });
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;