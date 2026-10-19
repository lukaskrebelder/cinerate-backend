// Client für die TMDB-API (Fremdservice). Enthält nur die Aufrufe an TMDB,
// keine Fachregeln. Fetch, Timeout, Wiederholungen und Wartezeit lassen sich in Tests austauschen.
const { AppError } = require("../lib/appError");

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Nur vorübergehende Fehler lohnen eine Wiederholung: 429 (zu viele Anfragen) und 5xx.
// Andere 4xx (falscher Schlüssel, unbekannte ID) ändern sich beim zweiten Versuch nicht.
const isRetryableStatus = (status) => status === 429 || status >= 500;

function createTmdbClient({
  apiKey = process.env.TMDB_API_KEY,
  fetchFn = fetch,
  timeoutMs = 5000,
  retries = 2,
  retryDelayMs = 200,
  sleepFn = defaultSleep,
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

    let lastError;
    let notFound = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      // Pause vor jeder Wiederholung, bei jedem Versuch doppelt so lang (200 ms, 400 ms, ...)
      if (attempt > 0) await sleepFn(retryDelayMs * 2 ** (attempt - 1));

      try {
        // Nach timeoutMs bricht der Aufruf ab, damit eine hängende TMDB-Antwort nicht ewig wartet
        const response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (response.ok) return await response.json();

        lastError = new Error(`TMDB-Anfrage fehlgeschlagen: ${response.status}`);
        if (response.status === 404) { notFound = true; break; }
        if (!isRetryableStatus(response.status)) break; // z. B. 401 (falscher Schlüssel): nicht erneut versuchen
      } catch (err) {
        lastError = err; // Netzwerkfehler oder Timeout: erneut versuchen
      }
    }
    if (notFound) throw new AppError(404, "No movie found for this ID.");

    // Nur die Meldung loggen, nie die URL (sie enthält den API-Schlüssel)
    console.error(lastError.message);
    throw new AppError(503, "Search is currently unavailable.");
  }

  return {
    searchMovies: ({ query, page = 1 }) => request("/search/movie", { query, page }),
    discoverMovies: ({ genreId, page = 1 }) =>
      request("/discover/movie", { with_genres: genreId, page }),
    getGenres: () => request("/genre/movie/list"),
    getMovie: (tmdbId) =>
      request(`/movie/${tmdbId}`, { append_to_response: "release_dates" }),
    getRecommendations: (tmdbId) => request(`/movie/${tmdbId}/recommendations`),
  };
}

module.exports = { createTmdbClient };