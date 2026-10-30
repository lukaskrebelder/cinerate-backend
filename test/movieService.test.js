// KI-Log A21
// KI-Log A17
const test = require("node:test");
const assert = require("node:assert");
const { createMovieService } = require("../services/movieService");
const { AppError } = require("../lib/appError");

const tmdbPage = (results) => ({ page: 1, total_pages: 3, results });

// Ersatz-Client, der sich merkt, wie er aufgerufen wurde
function fakeClient({ search, discover } = {}) {
  const calls = [];
  return {
    calls,
    getGenres: async () => ({ genres: [{ id: 878, name: "Science Fiction" }, { id: 35, name: "Komödie" }] }),
    searchMovies: async (args) => { calls.push(["search", args]); return search; },
    discoverMovies: async (args) => { calls.push(["discover", args]); return discover; },
  };
}

const is400 = (err) => err instanceof AppError && err.status === 400;

test("Suche nach Titel liefert das Format aus API-2", async () => {
  const client = fakeClient({
    search: tmdbPage([{ id: 157336, title: "Interstellar", poster_path: "/abc.jpg", genre_ids: [878] }]),
  });
  const result = await createMovieService(client).searchMovies({ query: " Interstellar " });
  assert.deepStrictEqual(client.calls[0], ["search", { query: "Interstellar", page: 1 }]);
  assert.deepStrictEqual(result, {
    page: 1,
    totalPages: 3,
    movies: [{ movieId: 157336, title: "Interstellar", posterUrl: "https://image.tmdb.org/t/p/w500/abc.jpg" }],
  });
});

test("nur Genre: Name wird ohne Beachtung der Schreibweise in die ID umgewandelt", async () => {
  const client = fakeClient({ discover: tmdbPage([]) });
  await createMovieService(client).searchMovies({ genre: "science fiction", page: "2" });
  assert.deepStrictEqual(client.calls[0], ["discover", { genreId: 878, page: 2 }]);
});

test("Titel und Genre: Treffer werden nach Genre gefiltert", async () => {
  const client = fakeClient({
    search: tmdbPage([
      { id: 1, title: "Alien", poster_path: null, genre_ids: [878] },
      { id: 2, title: "Alien Comedy", poster_path: null, genre_ids: [35] },
    ]),
  });
  const result = await createMovieService(client).searchMovies({ query: "alien", genre: "Komödie" });
  assert.deepStrictEqual(result.movies.map((m) => m.movieId), [2]);
});

test("ohne Filter wird die Standardliste geholt", async () => {
  const client = fakeClient({ discover: tmdbPage([]) });
  await createMovieService(client).searchMovies({});
  assert.deepStrictEqual(client.calls[0], ["discover", { genreId: undefined, page: 1 }]);
});

test("fehlendes Poster ergibt posterUrl null", async () => {
  const client = fakeClient({ discover: tmdbPage([{ id: 5, title: "Ohne Poster", poster_path: null }]) });
  const result = await createMovieService(client).searchMovies({});
  assert.strictEqual(result.movies[0].posterUrl, null);
});

test("unbekanntes Genre gibt 400 und fragt TMDB nicht nach Filmen", async () => {
  const client = fakeClient({ discover: tmdbPage([]) });
  await assert.rejects(() => createMovieService(client).searchMovies({ genre: "Gibtsnicht" }), is400);
  assert.strictEqual(client.calls.length, 0);
});

test("ungültige Seite gibt 400", async () => {
  const service = createMovieService(fakeClient({ discover: tmdbPage([]) }));
  for (const page of ["0", "abc", "1.5", "501", "-1"]) {
    await assert.rejects(() => service.searchMovies({ page }), is400);
  }
});

test("ungültiger Text (Liste oder zu lang) gibt 400", async () => {
  const service = createMovieService(fakeClient({ discover: tmdbPage([]) }));
  await assert.rejects(() => service.searchMovies({ query: ["a", "b"] }), is400);
  await assert.rejects(() => service.searchMovies({ genre: "x".repeat(201) }), is400);
});

// --- getMovie (Detailseite) ---

const is404 = (err) => err instanceof AppError && err.status === 404;

// Ersatz-Repository: merkt sich Aufrufe; nach saveMovie liefert findByTmdbId den gespeicherten Film
function fakeRepo(row) {
  const repo = {
    calls: [],
    row,
    findByTmdbId: async (id) => { repo.calls.push(["find", id]); return repo.row; },
    saveMovie: async (movie) => {
      repo.calls.push(["save", movie]);
      repo.row = {
        tmdb_id: movie.tmdbId, titel: movie.title, beschreibung: movie.description,
        erscheinungsjahr: movie.year, laufzeit: movie.runtime,
        poster_pfad: movie.posterPath, fsk: movie.fsk, avg_rating: null,
        genres: movie.genres.map((g) => g.name),
      };
    },
  };
  return repo;
}

const dbRow = {
  tmdb_id: 157336, titel: "Interstellar", beschreibung: "Astronauten suchen eine neue Heimat.",
  erscheinungsjahr: 2014, laufzeit: 169,
  poster_pfad: "/abc.jpg", fsk: "12", avg_rating: "4.6667", genres: ["Drama", "Science Fiction"],
};

test("getMovie: Film aus der Datenbank, TMDB wird nicht gefragt", async () => {
  let tmdbAufrufe = 0;
  const client = { getMovie: async () => { tmdbAufrufe++; } };
  const result = await createMovieService(client, fakeRepo(dbRow)).getMovie("157336");
  assert.strictEqual(tmdbAufrufe, 0);
  assert.deepStrictEqual(result, {
    movieId: 157336,
    title: "Interstellar",
    description: "Astronauten suchen eine neue Heimat.",
    genres: ["Drama", "Science Fiction"],
    fsk: 12,
    releaseYear: 2014,
    runtime: 169,
    posterUrl: "https://image.tmdb.org/t/p/w500/abc.jpg",
    avgRating: 4.7,
  });
});

test("getMovie: Film nur bei TMDB wird gespeichert und zurückgegeben", async () => {
  const repo = fakeRepo(undefined);
  const client = {
    getMovie: async () => ({
      title: "Interstellar", overview: "Beschreibung", release_date: "2014-11-05",
      poster_path: "/abc.jpg", runtime: 169,
      genres: [{ id: 878, name: "Science Fiction" }, { id: 18, name: "Drama" }],
      release_dates: { results: [{ iso_3166_1: "DE", release_dates: [{ certification: "" }, { certification: "12" }] }] },
    }),
  };
  const result = await createMovieService(client, repo).getMovie("157336");
  const gespeichert = repo.calls.find((c) => c[0] === "save")[1];
  assert.deepStrictEqual(gespeichert, {
    tmdbId: 157336, title: "Interstellar", description: "Beschreibung", year: 2014,
    posterPath: "/abc.jpg", runtime: 169, fsk: "12",
    genres: [{ tmdbGenreId: 878, name: "Science Fiction" }, { tmdbGenreId: 18, name: "Drama" }],
  });
  assert.strictEqual(result.movieId, 157336);
  assert.strictEqual(result.fsk, 12);
  assert.strictEqual(result.releaseYear, 2014);
  assert.strictEqual(result.runtime, 169);
  assert.strictEqual(result.avgRating, null);
});

test("getMovie: leere Beschreibung und fehlende Freigabe ergeben null", async () => {
  const repo = fakeRepo(undefined);
  const client = { getMovie: async () => ({ title: "X", overview: "", genres: [], release_dates: { results: [] } }) };
  const result = await createMovieService(client, repo).getMovie("5");
  assert.strictEqual(result.description, null);
  assert.strictEqual(result.fsk, null);
  assert.strictEqual(result.releaseYear, null);
  assert.strictEqual(result.runtime, null);
  assert.strictEqual(result.posterUrl, null);
});

test("getMovie: ungültige ID ergibt 404, ohne Datenbank oder TMDB zu fragen", async () => {
  const repo = fakeRepo(dbRow);
  const service = createMovieService({ getMovie: async () => { throw new Error("darf nicht passieren"); } }, repo);
  for (const id of ["abc", "0", "-1", "1.5", "99999999999", ""]) {
    await assert.rejects(() => service.getMovie(id), is404);
  }
  assert.strictEqual(repo.calls.length, 0);
});

test("getMovie: Fehler von TMDB (z. B. 404) wird unverändert weitergegeben", async () => {
  const client = { getMovie: async () => { throw new AppError(404, "No movie found for this ID."); } };
  await assert.rejects(() => createMovieService(client, fakeRepo(undefined)).getMovie("1"), is404);
});
