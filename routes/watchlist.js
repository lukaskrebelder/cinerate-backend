// Watchlist (US-3): GET /api/watchlist, POST /api/watchlist, DELETE /api/watchlist/{movieId}
// Die Route macht nur HTTP, die Fachregeln stehen im watchlistService.
// KI-Log A24
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { watchlistService } = require("../services/container");

// Film hinzufügen: Body { "movieId": 157336 }
router.post("/watchlist", requireAuth, async (req, res) => {
  const { movieId } = req.body ?? {};
  const result = await watchlistService.addMovie({ userId: req.user.id, movieId });
  res.status(201).json(result);
});

// Film entfernen
router.delete("/watchlist/:movieId", requireAuth, async (req, res) => {
  const result = await watchlistService.removeMovie({
    userId: req.user.id,
    movieId: req.params.movieId,
  });
  res.status(200).json(result);
});

// Eigene Watchlist, die zuletzt hinzugefügten Filme zuerst
router.get("/watchlist", requireAuth, async (req, res) => {
  const result = await watchlistService.listMovies({ userId: req.user.id });
  res.status(200).json(result);
});

module.exports = router;