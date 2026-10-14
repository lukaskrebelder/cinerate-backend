const test = require("node:test");
const assert = require("node:assert");
const { createCachedTmdbClient } = require("../integrations/cachedTmdbClient");

// Ersatz-Client, der zählt, wie oft TMDB wirklich gefragt wird
function fakeClient() {
  const calls = { search: 0, discover: 0, genres: 0, recs: 0 };
  return {
    calls,
    searchMovies: async ({ query, page }) => { calls.search++; return { query, page }; },
    discoverMovies: async ({ genreId, page }) => { calls.discover++; return { genreId, page }; },
    getGenres: async () => { calls.genres++; return { genres: [] }; },
    getRecommendations: async (id) => { calls.recs++; return { id }; },
  };
}

test("gleiche Suche geht nur einmal an TMDB, Groß-/Kleinschreibung ist egal", async () => {
  const inner = fakeClient();
  const client = createCachedTmdbClient(inner);
  await client.searchMovies({ query: "Interstellar", page: 1 });
  await client.searchMovies({ query: " interstellar ", page: 1 });
  assert.strictEqual(inner.calls.search, 1);
});

test("andere Seite oder anderer Begriff wird neu geholt", async () => {
  const inner = fakeClient();
  const client = createCachedTmdbClient(inner);
  await client.searchMovies({ query: "alien", page: 1 });
  await client.searchMovies({ query: "alien", page: 2 });
  await client.searchMovies({ query: "matrix", page: 1 });
  assert.strictEqual(inner.calls.search, 3);
});

test("Genre-Liste und Discover werden gecacht", async () => {
  const inner = fakeClient();
  const client = createCachedTmdbClient(inner);
  await client.getGenres();
  await client.getGenres();
  await client.discoverMovies({ genreId: 878, page: 1 });
  await client.discoverMovies({ genreId: 878, page: 1 });
  assert.strictEqual(inner.calls.genres, 1);
  assert.strictEqual(inner.calls.discover, 1);
});

test("stats zeigt Treffer und Fehlversuche", async () => {
  const client = createCachedTmdbClient(fakeClient());
  await client.getRecommendations(7);
  await client.getRecommendations(7);
  assert.deepStrictEqual(client.stats(), { hits: 1, misses: 1, size: 1 });
});