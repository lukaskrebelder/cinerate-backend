// Fachregeln für Bewertungen (US-4). Kennt weder HTTP noch SQL.
// Der Film wird bei Bedarf über den movieService aus TMDB importiert (ensureMovie).
const { AppError } = require("../lib/appError");

const MIN_STARS = 1;
const MAX_STARS = 5;

// Nur ganze Zahlen von 1 bis 5 (keine halben Sterne, keine Texte)
function parseStars(value) {
  if (!Number.isInteger(value) || value < MIN_STARS || value > MAX_STARS) {
    throw new AppError(400, "Please choose 1 to 5 stars.");
  }
  return value;
}

// Durchschnitt mit einer Dezimalstelle; ohne Bewertungen null
function toAvg(value) {
  return value === null ? null : Number(Number(value).toFixed(1));
}

// movieService: Objekt mit ensureMovie (siehe services/movieService.js)
// ratingRepository: Objekt mit saveRating, getSummary (siehe db/ratingRepository.js)
function createRatingService(movieService, ratingRepository) {
  async function summary(userId, tmdbId) {
    const row = await ratingRepository.getSummary({ userId, tmdbId });
    return {
      avgRating: toAvg(row.avg_rating),
      ratingCount: Number(row.rating_count),
      ownStars: row.own_stars ?? null,
    };
  }

  // POST /movies/{movieId}/ratings: neu (created = true) oder eigene Bewertung geändert (created = false)
  async function saveRating({ userId, movieId, stars }) {
    const value = parseStars(stars);
    const film = await movieService.ensureMovie(movieId);

    const before = await summary(userId, film.tmdb_id);
    await ratingRepository.saveRating({ userId, tmdbId: film.tmdb_id, stars: value });
    const after = await summary(userId, film.tmdb_id);

    const created = before.ownStars === null;
    return {
      created,
      message: created ? "Your rating has been saved." : "Your rating has been updated.",
      stars: value,
      avgRating: after.avgRating,
    };
  }

  // GET /movies/{movieId}/ratings: ohne Bewertungen { avgRating: null, ratingCount: 0, ownStars: null }
  async function getRatings({ userId, movieId }) {
    const film = await movieService.ensureMovie(movieId);
    return summary(userId, film.tmdb_id);
  }

  return { saveRating, getRatings };
}

module.exports = { createRatingService };