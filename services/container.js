// Baut die Objekte der Anwendung einmal zusammen, damit alle Routen dieselben Instanzen nutzen
// (zum Beispiel denselben TMDB-Cache).
const { createTmdbClient } = require("../integrations/tmdbClient");
const { createCachedTmdbClient } = require("../integrations/cachedTmdbClient");
const { createMovieRepository } = require("../db/movieRepository");
const { createRatingRepository } = require("../db/ratingRepository");
const { createWatchlistRepository } = require("../db/watchlistRepository");
const { createMovieService } = require("./movieService");
const { createRatingService } = require("./ratingService");
const { createWatchlistService } = require("./watchlistService");

const tmdbClient = createCachedTmdbClient(createTmdbClient());
const movieService = createMovieService(tmdbClient, createMovieRepository());
const ratingService = createRatingService(movieService, createRatingRepository());
const watchlistService = createWatchlistService(movieService, createWatchlistRepository());

module.exports = { movieService, ratingService, watchlistService };