// Bewertungen (US-4): POST und GET /api/movies/{movieId}/ratings
// Die Route macht nur HTTP, die Fachregeln stehen im ratingService.
// KI-Log A22
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { ratingService } = require("../services/container");

// Bewertung abgeben oder die eigene ändern: 201 (neu) oder 200 (geändert)
router.post("/movies/:movieId/ratings", requireAuth, async (req, res) => {
  const { stars } = req.body ?? {};
  const { created, ...body } = await ratingService.saveRating({
    userId: req.user.id,
    movieId: req.params.movieId,
    stars,
  });
  res.status(created ? 201 : 200).json(body);
});

// Durchschnitt, Anzahl und eigene Sterne
router.get("/movies/:movieId/ratings", requireAuth, async (req, res) => {
  const result = await ratingService.getRatings({
    userId: req.user.id,
    movieId: req.params.movieId,
  });
  res.status(200).json(result);
});

module.exports = router;