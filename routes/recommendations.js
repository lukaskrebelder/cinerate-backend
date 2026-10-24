// Filmvorschläge (US-1): GET /api/recommendations
// Die Route macht nur HTTP, die Fachregeln stehen im recommendationService.
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { handleError } = require("../lib/appError");
const { recommendationService } = require("../services/container");

router.get("/recommendations", requireAuth, async (req, res) => {
  try {
    const result = await recommendationService.getRecommendations({ userId: req.user.id });
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;