// Client für die TMDB-API (Fremdservice). Enthält nur die Aufrufe an TMDB,
// keine Fachregeln. Fetch und Timeout lassen sich in Tests austauschen.
const { AppError } = require("../lib/appError");

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function createTmdbClient({
  apiKey = process.env.TMDB_API_KEY,
  fetchFn = fetch,
  timeoutMs = 5000,
} = {}) {
  async function request(path, params = {}) {
    const url = new URL(TMDB_BASE_URL + path);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", "de-DE");
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    try {
      // Nach timeoutMs bricht der Aufruf ab, damit eine hängende TMDB-Antwort nicht ewig wartet
      const response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        throw new Error(`TMDB-Anfrage fehlgeschlagen: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      // Nur die Meldung loggen, nie die URL (sie enthält den API-Schlüssel)
      console.error(err.message);
      throw new AppError(503, "Search is currently unavailable.");
    }
  }

  return {
    searchMovies: ({ query, page = 1 }) => request("/search/movie", { query, page }),
    discoverMovies: ({ genreId, page = 1 }) =>
      request("/discover/movie", { with_genres: genreId, page }),
    getGenres: () => request("/genre/movie/list"),
    getRecommendations: (tmdbId) => request(`/movie/${tmdbId}/recommendations`),
  };
}

module.exports = { createTmdbClient };