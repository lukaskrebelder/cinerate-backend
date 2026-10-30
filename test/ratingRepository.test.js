// KI-Log A22
const test = require("node:test");
const assert = require("node:assert");
const { createRatingRepository } = require("../db/ratingRepository");

// Ersatz-Pool: merkt sich SQL und Parameter und liefert feste Zeilen
function fakePool(rows = []) {
  const calls = [];
  return {
    calls,
    query: async (text, params) => {
      calls.push({ text: text.replace(/\s+/g, " "), params });
      return { rows };
    },
  };
}

test("saveRating nutzt ON CONFLICT und übergibt Nutzer, TMDB-ID und Sterne", async () => {
  const pool = fakePool();
  await createRatingRepository(pool).saveRating({ userId: 7, tmdbId: 157336, stars: 4 });
  assert.match(pool.calls[0].text, /INSERT INTO Bewertung/);
  assert.match(pool.calls[0].text, /ON CONFLICT \(nutzer_id, film_id\) DO UPDATE/);
  assert.deepStrictEqual(pool.calls[0].params, [7, 157336, 4]);
});

test("getSummary liefert die erste Zeile und übergibt Nutzer und TMDB-ID", async () => {
  const row = { avg_rating: "4.5", rating_count: "2", own_stars: 5 };
  const pool = fakePool([row]);
  const result = await createRatingRepository(pool).getSummary({ userId: 7, tmdbId: 157336 });
  assert.deepStrictEqual(result, row);
  assert.deepStrictEqual(pool.calls[0].params, [7, 157336]);
});

test("getSummary liefert undefined, wenn der Film nicht in der Datenbank steht", async () => {
  const result = await createRatingRepository(fakePool([])).getSummary({ userId: 7, tmdbId: 1 });
  assert.strictEqual(result, undefined);
});

test("listRatedMovies übergibt die Nutzer-ID, sortiert nach zuletzt bewertet und liefert die Zeilen", async () => {
  const rows = [{ tmdb_id: 27205, punktzahl: 5, genres: ["Action", "Science Fiction"] }];
  const pool = fakePool(rows);
  const result = await createRatingRepository(pool).listRatedMovies(7);
  assert.deepStrictEqual(result, rows);
  assert.deepStrictEqual(pool.calls[0].params, [7]);
  assert.match(pool.calls[0].text, /WHERE b\.nutzer_id = \$1/);
  assert.match(pool.calls[0].text, /ORDER BY b\.aktualisiert_am DESC/);
});