// Legt einen Cache um den TMDB-Client (Infrastruktur-Optimierung, ADR-06).
// Gleiche Anfragen innerhalb der Haltedauer gehen nicht erneut an TMDB.
const { createTtlCache } = require("../lib/ttlCache");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function createCachedTmdbClient(tmdbClient, cache = createTtlCache()) {
  return {
    searchMovies: ({ query, page = 1 }) => {
      const key = `search:${String(query).trim().toLowerCase()}:${page}`;
      return cache.getOrLoad(key, () => tmdbClient.searchMovies({ query, page }), 10 * MINUTE);
    },
    discoverMovies: ({ genreId, page = 1 }) =>
      cache.getOrLoad(
        `discover:${genreId}:${page}`,
        () => tmdbClient.discoverMovies({ genreId, page }),
        10 * MINUTE
      ),
    getGenres: () => cache.getOrLoad("genres", () => tmdbClient.getGenres(), 24 * HOUR),
    getMovie: (tmdbId) =>
      cache.getOrLoad(`movie:${tmdbId}`, () => tmdbClient.getMovie(tmdbId), HOUR),
    getRecommendations: (tmdbId) =>
      cache.getOrLoad(`recs:${tmdbId}`, () => tmdbClient.getRecommendations(tmdbId), HOUR),
    // Treffer und Fehlversuche, für den Nachweis der Antwortzeit mit und ohne Cache
    stats: () => cache.stats(),
  };
}

module.exports = { createCachedTmdbClient };