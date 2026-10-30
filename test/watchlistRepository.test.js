// KI-Log A24
const test = require("node:test");
const assert = require("node:assert");
const { createWatchlistRepository } = require("../db/watchlistRepository");
const { AppError } = require("../lib/appError");

// Ersatz-Pool: merkt sich SQL und Parameter und liefert feste Ergebnisse
function fakePool({ rows = [], rowCount = 0, error } = {}) {
  const calls = [];
  return {
    calls,
    query: async (text, params) => {
      calls.push({ text: text.replace(/\s+/g, " "), params });
      if (error) throw error;
      return { rows, rowCount };
    },
  };
}

test("addMovie fügt über die TMDB-ID ein und übergibt Nutzer und TMDB-ID", async () => {
  const pool = fakePool();
  await createWatchlistRepository(pool).addMovie({ userId: 7, tmdbId: 157336 });
  assert.match(pool.calls[0].text, /INSERT INTO Watchlist/);
  assert.deepStrictEqual(pool.calls[0].params, [7, 157336]);
});

test("addMovie übersetzt den Fehler 23505 (schon auf der Watchlist) in 409", async () => {
  const pool = fakePool({ error: Object.assign(new Error("duplicate"), { code: "23505" }) });
  await assert.rejects(
    createWatchlistRepository(pool).addMovie({ userId: 7, tmdbId: 157336 }),
    (err) => err instanceof AppError && err.status === 409 && err.message === "Movie is already on your watchlist."
  );
});

test("addMovie gibt andere Fehler unverändert weiter (werden zu 503)", async () => {
  const boom = new Error("boom");
  const pool = fakePool({ error: boom });
  await assert.rejects(createWatchlistRepository(pool).addMovie({ userId: 7, tmdbId: 1 }), (err) => err === boom);
});

test("removeMovie gibt true zurück, wenn eine Zeile gelöscht wurde, sonst false", async () => {
  const gelöscht = await createWatchlistRepository(fakePool({ rowCount: 1 })).removeMovie({ userId: 7, tmdbId: 1 });
  const nichts = await createWatchlistRepository(fakePool({ rowCount: 0 })).removeMovie({ userId: 7, tmdbId: 1 });
  assert.strictEqual(gelöscht, true);
  assert.strictEqual(nichts, false);
});

test("removeMovie übergibt Nutzer und TMDB-ID", async () => {
  const pool = fakePool({ rowCount: 1 });
  await createWatchlistRepository(pool).removeMovie({ userId: 7, tmdbId: 157336 });
  assert.match(pool.calls[0].text, /DELETE FROM Watchlist/);
  assert.deepStrictEqual(pool.calls[0].params, [7, 157336]);
});

test("listMovies sortiert die zuletzt hinzugefügten zuerst und liefert die Zeilen", async () => {
  const rows = [{ tmdb_id: 1, titel: "A", poster_pfad: null }];
  const pool = fakePool({ rows });
  const result = await createWatchlistRepository(pool).listMovies(7);
  assert.match(pool.calls[0].text, /ORDER BY w\.hinzugefuegt_am DESC/);
  assert.deepStrictEqual(pool.calls[0].params, [7]);
  assert.deepStrictEqual(result, rows);
});