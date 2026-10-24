// Fachregeln für die Filmvorschläge (US-1, PB-26). Kennt weder HTTP noch SQL.
// Vorschläge werden nicht gespeichert: Titel, Beschreibung und Poster kommen direkt aus der TMDB-Antwort.
const { AppError } = require("../lib/appError");
const { toPosterUrl } = require("./movieService");

const MIN_RATED_MOVIES = 3; // so viele Bewertungen braucht der Nutzer mindestens
const MIN_LIKED_STARS = 4; // ab dieser Sternezahl zählt ein Film für das Lieblingsgenre
const MAX_RECOMMENDATIONS = 10;

const byGermanName = (a, b) => a.localeCompare(b, "de");

// liked: Filme mit 4 oder 5 Sternen, zuletzt bewertet zuerst, je mit genres (Liste von Namen).
// Das Genre mit den meisten Filmen gewinnt. Bei Gleichstand zählt der zuletzt bewertete Film,
// der eines der gleichauf liegenden Genres hat; hat er mehrere davon, gewinnt das alphabetisch erste.
// Gibt null zurück, wenn keiner der Filme ein Genre hat.
function pickFavoriteGenre(liked) {
  const counts = new Map();
  for (const movie of liked) {
    for (const genre of movie.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const max = Math.max(...counts.values());
  const tied = [...counts].filter(([, count]) => count === max).map(([genre]) => genre);
  if (tied.length === 1) return tied[0];

  const newest = liked.find((movie) => movie.genres.some((genre) => tied.includes(genre)));
  return newest.genres.filter((genre) => tied.includes(genre)).sort(byGermanName)[0];
}

function toRecommendation(tmdbMovie) {
  return {
    movieId: tmdbMovie.id,
    title: tmdbMovie.title,
    description: tmdbMovie.overview || null,
    posterUrl: toPosterUrl(tmdbMovie.poster_path),
  };
}

// tmdbClient: Objekt mit getRecommendations (siehe integrations/cachedTmdbClient.js)
// ratingRepository: Objekt mit listRatedMovies (siehe db/ratingRepository.js)
function createRecommendationService(tmdbClient, ratingRepository) {
  // GET /recommendations
  async function getRecommendations({ userId }) {
    const rated = await ratingRepository.listRatedMovies(userId);
    if (rated.length < MIN_RATED_MOVIES) {
      throw new AppError(400, "Please rate at least 3 movies first.");
    }

    const liked = rated.filter((movie) => movie.punktzahl >= MIN_LIKED_STARS);
    if (liked.length === 0) {
      throw new AppError(400, "Please rate at least one movie with 4 or 5 stars.");
    }

    const noRecommendations = new AppError(404, "No new recommendations available.");
    const favoriteGenre = pickFavoriteGenre(liked);
    if (favoriteGenre === null) throw noRecommendations;

    // Empfehlungen zu den Filmen im Lieblingsgenre, zuletzt bewertet zuerst, in TMDB-Reihenfolge.
    // Bereits bewertete Filme und Dubletten fallen weg, bei 10 Treffern ist Schluss.
    const sources = liked.filter((movie) => movie.genres.includes(favoriteGenre));
    const alreadyRated = new Set(rated.map((movie) => movie.tmdb_id));
    const seen = new Set();
    const movies = [];

    for (const source of sources) {
      let data;
      try {
        data = await tmdbClient.getRecommendations(source.tmdb_id);
      } catch (err) {
        // TMDB kennt diesen Film nicht mehr: nur diese Quelle überspringen, nicht die ganze Anfrage abbrechen
        if (err instanceof AppError && err.status === 404) continue;
        throw err;
      }

      for (const candidate of data.results ?? []) {
        if (alreadyRated.has(candidate.id) || seen.has(candidate.id)) continue;
        seen.add(candidate.id);
        movies.push(toRecommendation(candidate));
        if (movies.length === MAX_RECOMMENDATIONS) break;
      }
      if (movies.length === MAX_RECOMMENDATIONS) break;
    }

    if (movies.length === 0) throw noRecommendations;
    return { favoriteGenre, movies };
  }

  return { getRecommendations };
}

module.exports = { createRecommendationService, pickFavoriteGenre };