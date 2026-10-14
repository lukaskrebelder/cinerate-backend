const test = require("node:test");
const assert = require("node:assert");
const { createTmdbClient } = require("../integrations/tmdbClient");
const { AppError } = require("../lib/appError");

// Ersatz für fetch, merkt sich die aufgerufenen URLs
function fakeFetch(response) {
  const fn = async (url) => { fn.calls.push(String(url)); return response; };
  fn.calls = [];
  return fn;
}
const ok = (body) => ({ ok: true, json: async () => body });

test("searchMovies baut die URL mit Suchbegriff, Seite, Schlüssel und Sprache", async () => {
  const fetchFn = fakeFetch(ok({ results: [] }));
  const client = createTmdbClient({ apiKey: "testkey", fetchFn });
  await client.searchMovies({ query: "Interstellar", page: 2 });
  const url = fetchFn.calls[0];
  assert.ok(url.includes("/search/movie"));
  assert.ok(url.includes("query=Interstellar"));
  assert.ok(url.includes("page=2"));
  assert.ok(url.includes("api_key=testkey"));
  assert.ok(url.includes("language=de-DE"));
});

test("discoverMovies filtert nach Genre-ID", async () => {
  const fetchFn = fakeFetch(ok({ results: [] }));
  const client = createTmdbClient({ apiKey: "testkey", fetchFn });
  await client.discoverMovies({ genreId: 878 });
  assert.ok(fetchFn.calls[0].includes("/discover/movie"));
  assert.ok(fetchFn.calls[0].includes("with_genres=878"));
});

test("Fehlerstatus von TMDB wird zu AppError 503", async () => {
  const client = createTmdbClient({ apiKey: "k", fetchFn: fakeFetch({ ok: false, status: 500 }) });
  const original = console.error;
  console.error = () => {};
  await assert.rejects(() => client.getGenres(), (e) => e instanceof AppError && e.status === 503);
  console.error = original;
});

test("Netzwerkfehler oder Timeout wird zu AppError 503", async () => {
  const fetchFn = async () => { throw new Error("fetch failed"); };
  const client = createTmdbClient({ apiKey: "k", fetchFn });
  const original = console.error;
  console.error = () => {};
  await assert.rejects(() => client.getGenres(), (e) => e instanceof AppError && e.status === 503);
  console.error = original;
});