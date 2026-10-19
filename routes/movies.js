// Filmsuche und Filmdetail (US-5): GET /api/movies?query=…&genre=…&page=… und GET /api/movies/{movieId}
// Die Route macht nur HTTP, die Fachregeln stehen im movieService.
// fsk (PB-13) wird noch nicht ausgewertet und ignoriert.
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { handleError } = require("../lib/appError");
const { createTmdbClient } = require("../integrations/tmdbClient");
const { createCachedTmdbClient } = require("../integrations/cachedTmdbClient");
const { createMovieRepository } = require("../db/movieRepository");
const { createMovieService } = require("../services/movieService");

const tmdbClient = createCachedTmdbClient(createTmdbClient());
const movieService = createMovieService(tmdbClient, createMovieRepository());

router.get("/movies", requireAuth, async (req, res) => {
  try {
    const { query, genre, page } = req.query;
    const result = await movieService.searchMovies({ query, genre, page });
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// Detailseite: movieId ist die TMDB-ID
router.get("/movies/:movieId", requireAuth, async (req, res) => {
  try {
    const result = await movieService.getMovie(req.params.movieId);
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;