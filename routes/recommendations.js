// Filmvorschläge (US-1): GET /api/recommendations
// Die Route macht nur HTTP, die Fachregeln stehen im recommendationService.
// KI-Log A25
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { recommendationService } = require("../services/container");

router.get("/recommendations", requireAuth, async (req, res) => {
  const result = await recommendationService.getRecommendations({ userId: req.user.id });
  res.status(200).json(result);
});

module.exports = router;