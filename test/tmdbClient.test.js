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
  const client = createTmdbClient({ apiKey: "k", fetchFn: fakeFetch({ ok: false, status: 500 }), sleepFn: async () => {} });
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
// Ersatz für fetch, der nacheinander verschiedene Antworten liefert (Fehler = Exception)
function sequenceFetch(...steps) {
  const fn = async () => {
    fn.calls++;
    const step = steps[Math.min(fn.calls - 1, steps.length - 1)];
    if (step instanceof Error) throw step;
    return step;
  };
  fn.calls = 0;
  return fn;
}
const stumm = async (fn) => {
  const original = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = original; }
};
const keinSchlaf = async () => {};

test("bei 500 wird wiederholt und der zweite Versuch liefert das Ergebnis", async () => {
  const fetchFn = sequenceFetch({ ok: false, status: 500 }, ok({ genres: [] }));
  const client = createTmdbClient({ apiKey: "k", fetchFn, sleepFn: keinSchlaf });
  assert.deepStrictEqual(await client.getGenres(), { genres: [] });
  assert.strictEqual(fetchFn.calls, 2);
});

test("bei 429 wird wiederholt", async () => {
  const fetchFn = sequenceFetch({ ok: false, status: 429 }, ok({ genres: [] }));
  const client = createTmdbClient({ apiKey: "k", fetchFn, sleepFn: keinSchlaf });
  await client.getGenres();
  assert.strictEqual(fetchFn.calls, 2);
});

test("bei Netzwerkfehler wird wiederholt", async () => {
  const fetchFn = sequenceFetch(new Error("network down"), ok({ genres: [] }));
  const client = createTmdbClient({ apiKey: "k", fetchFn, sleepFn: keinSchlaf });
  await client.getGenres();
  assert.strictEqual(fetchFn.calls, 2);
});

test("bei 404 wird nicht wiederholt", async () => {
  const fetchFn = sequenceFetch({ ok: false, status: 404 });
  const client = createTmdbClient({ apiKey: "k", fetchFn, sleepFn: keinSchlaf });
  await stumm(() =>
        assert.rejects(() => client.getRecommendations(1), (e) => e instanceof AppError && e.status === 404)
  )
  assert.strictEqual(fetchFn.calls, 1);
});

test("getMovie fragt /movie/{id} mit release_dates ab", async () => {
  const fetchFn = fakeFetch(ok({ id: 157336 }));
  const client = createTmdbClient({ apiKey: "testkey", fetchFn });
  await client.getMovie(157336);
  assert.ok(fetchFn.calls[0].includes("/movie/157336"));
  assert.ok(fetchFn.calls[0].includes("append_to_response=release_dates"));
});

test("getMovie: 404 von TMDB wird zu AppError 404 mit der Meldung aus der API", async () => {
  const fetchFn = sequenceFetch({ ok: false, status: 404 });
  const client = createTmdbClient({ apiKey: "k", fetchFn, sleepFn: keinSchlaf });
  await assert.rejects(
    () => client.getMovie(1),
    (e) => e instanceof AppError && e.status === 404 && e.message === "No movie found for this ID."
  );
  assert.strictEqual(fetchFn.calls, 1);
});

test("nach allen Versuchen gibt es AppError 503", async () => {
  const fetchFn = sequenceFetch({ ok: false, status: 503 });
  const client = createTmdbClient({ apiKey: "k", fetchFn, sleepFn: keinSchlaf });
  await stumm(() =>
    assert.rejects(() => client.getGenres(), (e) => e instanceof AppError && e.status === 503)
  );
  assert.strictEqual(fetchFn.calls, 3);
});

test("die Pausen verdoppeln sich: 200 ms, dann 400 ms", async () => {
  const pausen = [];
  const fetchFn = sequenceFetch({ ok: false, status: 500 });
  const client = createTmdbClient({ apiKey: "k", fetchFn, sleepFn: async (ms) => { pausen.push(ms); } });
  await stumm(() => assert.rejects(() => client.getGenres()));
  assert.deepStrictEqual(pausen, [200, 400]);
});