// Fachregeln für die Watchlist (US-3). Kennt weder HTTP noch SQL.
// Beim Hinzufügen wird der Film bei Bedarf über den movieService aus TMDB importiert (ensureMovie).
const { AppError } = require("../lib/appError");
const { toPosterUrl } = require("./movieService");

const MAX_TMDB_ID = 2147483647; // größte Zahl, die die Spalte INTEGER in Postgres speichert

// Ganze Zahl von 1 bis MAX_TMDB_ID, sonst null
function parseTmdbId(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const id = Number(value);
  return id < 1 || id > MAX_TMDB_ID ? null : id;
}

// movieService: Objekt mit ensureMovie (siehe services/movieService.js)
// watchlistRepository: Objekt mit addMovie, removeMovie, listMovies (siehe db/watchlistRepository.js)
function createWatchlistService(movieService, watchlistRepository) {
  // POST /watchlist: unbekannte ID ergibt 404 (aus ensureMovie), doppelter Eintrag 409 (aus dem Repository)
  async function addMovie({ userId, movieId }) {
    const film = await movieService.ensureMovie(movieId);
    await watchlistRepository.addMovie({ userId, tmdbId: film.tmdb_id });
    return { message: "Movie was added to your watchlist." };
  }

  // DELETE /watchlist/{movieId}: steht der Film nicht auf der Watchlist (oder ist die ID ungültig), 404.
  // Hier wird nichts von TMDB importiert.
  async function removeMovie({ userId, movieId }) {
    const notOnList = new AppError(404, "Movie is not on your watchlist.");
    const tmdbId = parseTmdbId(movieId);
    if (tmdbId === null) throw notOnList;

    const removed = await watchlistRepository.removeMovie({ userId, tmdbId });
    if (!removed) throw notOnList;
    return { message: "Movie was removed from your watchlist." };
  }

  // GET /watchlist: zuletzt hinzugefügte Filme zuerst
  async function listMovies({ userId }) {
    const rows = await watchlistRepository.listMovies(userId);
    return {
      movies: rows.map((row) => ({
        movieId: row.tmdb_id,
        title: row.titel,
        posterUrl: toPosterUrl(row.poster_pfad),
      })),
    };
  }

  return { addMovie, removeMovie, listMovies };
}

module.exports = { createWatchlistService };