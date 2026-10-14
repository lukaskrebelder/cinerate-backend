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