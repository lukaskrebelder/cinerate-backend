const test = require("node:test");
const assert = require("node:assert");
const { createWatchlistService } = require("../services/watchlistService");
const { AppError } = require("../lib/appError");

// Ersatz-movieService: Film 999 und Werte, die keine ganze Zahl sind, ergeben 404 (wie der echte Service)
function fakeMovieService() {
  const calls = [];
  return {
    calls,
    ensureMovie: async (id) => {
      calls.push(id);
      if (!/^\d+$/.test(String(id)) || String(id) === "999") throw new AppError(404, "No movie found for this ID.");
      return { tmdb_id: Number(id) };
    },
  };
}

// Ersatz-Repository im Speicher: merkt sich Aufrufe und Einträge
function fakeRepo(rowsForList = []) {
  const calls = { addMovie: [], removeMovie: [] };
  const entries = [];
  return {
    calls,
    addMovie: async (args) => { calls.addMovie.push(args); entries.push(args); },
    removeMovie: async ({ userId, tmdbId }) => {
      calls.removeMovie.push({ userId, tmdbId });
      const index = entries.findIndex((e) => e.userId === userId && e.tmdbId === tmdbId);
      if (index === -1) return false;
      entries.splice(index, 1);
      return true;
    },
    listMovies: async () => rowsForList,
  };
}

const is404 = (err) => err instanceof AppError && err.status === 404;

test("Film hinzufügen: Film wird sichergestellt, Eintrag gespeichert, Meldung wie in API-2", async () => {
  const movies = fakeMovieService();
  const repo = fakeRepo();
  const result = await createWatchlistService(movies, repo).addMovie({ userId: 7, movieId: 157336 });
  assert.deepStrictEqual(movies.calls, [157336]);
  assert.deepStrictEqual(repo.calls.addMovie, [{ userId: 7, tmdbId: 157336 }]);
  assert.deepStrictEqual(result, { message: "Movie was added to your watchlist." });
});

test("Film hinzufügen: unbekannter Film ergibt 404 und es wird nichts gespeichert", async () => {
  const repo = fakeRepo();
  const service = createWatchlistService(fakeMovieService(), repo);
  await assert.rejects(service.addMovie({ userId: 7, movieId: 999 }), is404);
  await assert.rejects(service.addMovie({ userId: 7, movieId: undefined }), is404);
  assert.strictEqual(repo.calls.addMovie.length, 0);
});

test("Film hinzufügen: der Fehler 409 des Repositories geht unverändert durch", async () => {
  const repo = fakeRepo();
  repo.addMovie = async () => { throw new AppError(409, "Movie is already on your watchlist."); };
  const service = createWatchlistService(fakeMovieService(), repo);
  await assert.rejects(
    service.addMovie({ userId: 7, movieId: 157336 }),
    (err) => err instanceof AppError && err.status === 409 && err.message === "Movie is already on your watchlist."
  );
});

test("Film entfernen: Eintrag wird gelöscht, Meldung wie in API-2", async () => {
  const repo = fakeRepo();
  const service = createWatchlistService(fakeMovieService(), repo);
  await service.addMovie({ userId: 7, movieId: 157336 });
  const result = await service.removeMovie({ userId: 7, movieId: "157336" });
  assert.deepStrictEqual(result, { message: "Movie was removed from your watchlist." });
  assert.deepStrictEqual(repo.calls.removeMovie, [{ userId: 7, tmdbId: 157336 }]);
});

test("Film entfernen: steht er nicht auf der Watchlist, ergibt das 404", async () => {
  const service = createWatchlistService(fakeMovieService(), fakeRepo());
  await assert.rejects(
    service.removeMovie({ userId: 7, movieId: "157336" }),
    (err) => is404(err) && err.message === "Movie is not on your watchlist."
  );
});

test("Film entfernen: ungültige ID ergibt 404 ohne Datenbankzugriff und ohne TMDB-Import", async () => {
  const movies = fakeMovieService();
  const repo = fakeRepo();
  const service = createWatchlistService(movies, repo);
  for (const movieId of ["abc", "0", "-5", "1.5", "99999999999", ""]) {
    await assert.rejects(service.removeMovie({ userId: 7, movieId }), is404);
  }
  assert.strictEqual(repo.calls.removeMovie.length, 0);
  assert.strictEqual(movies.calls.length, 0);
});

test("Watchlist anzeigen: Format aus API-2, Reihenfolge bleibt, fehlendes Poster ergibt null", async () => {
  const rows = [
    { tmdb_id: 603, titel: "Matrix", poster_pfad: null },
    { tmdb_id: 157336, titel: "Interstellar", poster_pfad: "/abc.jpg" },
  ];
  const result = await createWatchlistService(fakeMovieService(), fakeRepo(rows)).listMovies({ userId: 7 });
  assert.deepStrictEqual(result, {
    movies: [
      { movieId: 603, title: "Matrix", posterUrl: null },
      { movieId: 157336, title: "Interstellar", posterUrl: "https://image.tmdb.org/t/p/w500/abc.jpg" },
    ],
  });
});

test("Watchlist anzeigen: leere Watchlist ergibt eine leere Liste", async () => {
  const result = await createWatchlistService(fakeMovieService(), fakeRepo([])).listMovies({ userId: 7 });
  assert.deepStrictEqual(result, { movies: [] });
});