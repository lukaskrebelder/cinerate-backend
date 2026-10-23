// Watchlist (US-3): GET /api/watchlist, POST /api/watchlist, DELETE /api/watchlist/{movieId}
// Die Route macht nur HTTP, die Fachregeln stehen im watchlistService.
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { handleError } = require("../lib/appError");
const { watchlistService } = require("../services/container");

// Film hinzufügen: Body { "movieId": 157336 }
router.post("/watchlist", requireAuth, async (req, res) => {
  try {
    const { movieId } = req.body ?? {};
    const result = await watchlistService.addMovie({ userId: req.user.id, movieId });
    res.status(201).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// Film entfernen
router.delete("/watchlist/:movieId", requireAuth, async (req, res) => {
  try {
    const result = await watchlistService.removeMovie({
      userId: req.user.id,
      movieId: req.params.movieId,
    });
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// Eigene Watchlist, die zuletzt hinzugefügten Filme zuerst
router.get("/watchlist", requireAuth, async (req, res) => {
  try {
    const result = await watchlistService.listMovies({ userId: req.user.id });
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;