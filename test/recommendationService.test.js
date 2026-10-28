const test = require("node:test");
const assert = require("node:assert");
const { createRecommendationService, pickFavoriteGenre } = require("../services/recommendationService");
const { AppError } = require("../lib/appError");

// Bewertete Filme wie aus dem Repository: zuletzt bewertet zuerst
const rated = (tmdb_id, punktzahl, genres) => ({ tmdb_id, punktzahl, genres });

const repoWith = (rows) => ({ listRatedMovies: async () => rows });

// Ersatz-TMDB-Client: pro Film-ID eine Liste von Empfehlungen (Zahlen werden zu { id, title })
function fakeTmdb(map = {}) {
  const calls = [];
  return {
    calls,
    getRecommendations: async (id) => {
      calls.push(id);
      const value = map[id];
      if (value instanceof Error) throw value;
      return { results: (value ?? []).map((r) => (typeof r === "number" ? { id: r, title: `Film ${r}` } : r)) };
    },
  };
}

const status = (code) => (err) => err instanceof AppError && err.status === code;

test("weniger als 3 bewertete Filme: 400", async () => {
  const service = createRecommendationService(fakeTmdb(), repoWith([rated(1, 5, ["Drama"]), rated(2, 5, ["Drama"])]));
  await assert.rejects(service.getRecommendations({ userId: 1 }), (err) => {
    return status(400)(err) && err.message === "Please rate at least 3 movies first.";
  });
});

test("3 Filme, aber keiner mit 4 oder 5 Sternen: 400", async () => {
  const rows = [rated(1, 3, ["Drama"]), rated(2, 2, ["Drama"]), rated(3, 1, ["Drama"])];
  const service = createRecommendationService(fakeTmdb(), repoWith(rows));
  await assert.rejects(service.getRecommendations({ userId: 1 }), (err) => {
    return status(400)(err) && err.message === "Please rate at least one movie with 4 or 5 stars.";
  });
});

test("Grenzwert: genau 3 Filme, einer mit 4 Sternen, ergibt Vorschläge", async () => {
  const rows = [rated(1, 4, ["Drama"]), rated(2, 3, ["Drama"]), rated(3, 1, ["Komödie"])];
  const service = createRecommendationService(fakeTmdb({ 1: [10, 11] }), repoWith(rows));
  const result = await service.getRecommendations({ userId: 1 });
  assert.strictEqual(result.favoriteGenre, "Drama");
  assert.deepStrictEqual(result.movies.map((m) => m.movieId), [10, 11]);
});

test("Beispiel aus Kriterium 1.6: Lieblingsgenre ist Science Fiction, Filme mit 3 Sternen zählen nicht", () => {
  const liked = [
    rated(1, 4, ["Action", "Science Fiction"]),
    rated(2, 5, ["Drama", "Science Fiction"]),
    rated(3, 5, ["Drama", "Science Fiction"]),
  ];
  assert.strictEqual(pickFavoriteGenre(liked), "Science Fiction");
});

test("Gleichstand: das Genre des zuletzt bewerteten Films gewinnt", () => {
  const liked = [rated(1, 5, ["Komödie"]), rated(2, 5, ["Drama"])];
  assert.strictEqual(pickFavoriteGenre(liked), "Komödie");
});

test("Gleichstand: hat der zuletzt bewertete Film mehrere der gleichauf liegenden Genres, gewinnt das alphabetisch erste", () => {
  const liked = [rated(1, 5, ["Thriller", "Action"]), rated(2, 5, ["Action"]), rated(3, 5, ["Thriller"])];
  assert.strictEqual(pickFavoriteGenre(liked), "Action");
});

test("Gleichstand: ein Genre, das nur bei älteren Filmen vorkommt, wird nicht vom neuesten Film bestimmt", () => {
  // Drama und Action je 2. Neuester Film hat nur Horror (1x), zählt nicht. Der nächste mit Action oder Drama gewinnt.
  const liked = [rated(1, 5, ["Horror"]), rated(2, 5, ["Action"]), rated(3, 5, ["Drama"]), rated(4, 4, ["Drama"]), rated(5, 4, ["Action"])];
  assert.strictEqual(pickFavoriteGenre(liked), "Action");
});

test("Filme ohne Genre: kein Lieblingsgenre, also 404", async () => {
  const rows = [rated(1, 5, []), rated(2, 5, []), rated(3, 5, [])];
  const service = createRecommendationService(fakeTmdb(), repoWith(rows));
  await assert.rejects(service.getRecommendations({ userId: 1 }), status(404));
});

test("Quellen sind nur Filme mit 4 oder 5 Sternen im Lieblingsgenre, zuletzt bewertet zuerst", async () => {
  const rows = [
    rated(1, 5, ["Drama"]),      // Quelle
    rated(2, 5, ["Komödie"]),    // anderes Genre, keine Quelle
    rated(3, 3, ["Drama"]),      // zu wenig Sterne, keine Quelle
    rated(4, 4, ["Drama"]),      // Quelle
    rated(5, 4, ["Komödie"]),
  ];
  const tmdb = fakeTmdb({ 1: [10], 4: [11] });
  const result = await createRecommendationService(tmdb, repoWith(rows)).getRecommendations({ userId: 1 });
  assert.deepStrictEqual(tmdb.calls, [1, 4]);
  assert.deepStrictEqual(result.movies.map((m) => m.movieId), [10, 11]);
});

test("bereits bewertete Filme und Dubletten erscheinen nicht", async () => {
  const rows = [rated(1, 5, ["Drama"]), rated(2, 4, ["Drama"]), rated(3, 2, ["Drama"])];
  const tmdb = fakeTmdb({ 1: [2, 20, 3, 21], 2: [20, 22, 1] });
  const result = await createRecommendationService(tmdb, repoWith(rows)).getRecommendations({ userId: 1 });
  // reihum: erst der erste Treffer jeder Quelle (2 ist bewertet, 20 kommt von Quelle 2), dann der zweite usw.
  assert.deepStrictEqual(result.movies.map((m) => m.movieId), [20, 22, 21]);
});

test("höchstens 10 Vorschläge, aufgefüllt aus der Quelle mit den meisten Treffern", async () => {
  const rows = [rated(1, 5, ["Drama"]), rated(2, 5, ["Drama"]), rated(3, 5, ["Drama"])];
  const many = Array.from({ length: 15 }, (_, i) => 100 + i);
  const tmdb = fakeTmdb({ 1: many, 2: [200], 3: [300] });
  const result = await createRecommendationService(tmdb, repoWith(rows)).getRecommendations({ userId: 1 });
  assert.strictEqual(result.movies.length, 10);
  assert.deepStrictEqual(result.movies.map((m) => m.movieId), [100, 200, 300, 101, 102, 103, 104, 105, 106, 107]);
});

test("Vorschläge stammen reihum von allen Quellfilmen, nicht nur vom zuletzt bewerteten", async () => {
  const rows = [rated(1, 5, ["Action"]), rated(2, 5, ["Action"]), rated(3, 4, ["Action"])];
  const lang = (start) => Array.from({ length: 20 }, (_, i) => start + i);
  const tmdb = fakeTmdb({ 1: lang(100), 2: lang(200), 3: lang(300) });
  const result = await createRecommendationService(tmdb, repoWith(rows)).getRecommendations({ userId: 1 });
  const ids = result.movies.map((m) => m.movieId);
  assert.deepStrictEqual(ids, [100, 200, 300, 101, 201, 301, 102, 202, 302, 103]);
  assert.ok(ids.some((id) => id >= 100 && id < 200));
  assert.ok(ids.some((id) => id >= 200 && id < 300));
  assert.ok(ids.some((id) => id >= 300));
});

test("höchstens 10 Quellfilme, dafür höchstens 10 TMDB-Aufrufe", async () => {
  const rows = Array.from({ length: 14 }, (_, i) => rated(i + 1, 5, ["Drama"]));
  const map = Object.fromEntries(rows.map((r) => [r.tmdb_id, [1000 + r.tmdb_id]]));
  const tmdb = fakeTmdb(map);
  const result = await createRecommendationService(tmdb, repoWith(rows)).getRecommendations({ userId: 1 });
  assert.deepStrictEqual(tmdb.calls, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.strictEqual(result.movies.length, 10);
});

test("Antwort: Titel, Beschreibung, Poster-URL; fehlende Werte werden null", async () => {
  const rows = [rated(1, 5, ["Drama"]), rated(2, 5, ["Drama"]), rated(3, 5, ["Drama"])];
  const tmdb = fakeTmdb({
    1: [
      { id: 10, title: "Mit Poster", overview: "Kurzbeschreibung", poster_path: "/a.jpg" },
      { id: 11, title: "Ohne Poster", overview: "", poster_path: null },
    ],
  });
  const result = await createRecommendationService(tmdb, repoWith(rows)).getRecommendations({ userId: 1 });
  assert.deepStrictEqual(result, {
    favoriteGenre: "Drama",
    movies: [
      { movieId: 10, title: "Mit Poster", description: "Kurzbeschreibung", posterUrl: "https://image.tmdb.org/t/p/w500/a.jpg" },
      { movieId: 11, title: "Ohne Poster", description: null, posterUrl: null },
    ],
  });
});

test("alle Empfehlungen schon bewertet: 404 „No new recommendations available.“", async () => {
  const rows = [rated(1, 5, ["Drama"]), rated(2, 5, ["Drama"]), rated(3, 5, ["Drama"])];
  const tmdb = fakeTmdb({ 1: [2, 3], 2: [1], 3: [] });
  await assert.rejects(createRecommendationService(tmdb, repoWith(rows)).getRecommendations({ userId: 1 }), (err) => {
    return status(404)(err) && err.message === "No new recommendations available.";
  });
});

test("TMDB kennt einen Quellfilm nicht (404): diese Quelle wird übersprungen", async () => {
  const rows = [rated(1, 5, ["Drama"]), rated(2, 5, ["Drama"]), rated(3, 5, ["Drama"])];
  const tmdb = fakeTmdb({ 1: new AppError(404, "No movie found for this ID."), 2: [20] });
  const result = await createRecommendationService(tmdb, repoWith(rows)).getRecommendations({ userId: 1 });
  assert.deepStrictEqual(result.movies.map((m) => m.movieId), [20]);
});

test("TMDB-Ausfall (503) wird weitergereicht", async () => {
  const rows = [rated(1, 5, ["Drama"]), rated(2, 5, ["Drama"]), rated(3, 5, ["Drama"])];
  const tmdb = fakeTmdb({ 1: new AppError(503, "TMDB down") });
  await assert.rejects(createRecommendationService(tmdb, repoWith(rows)).getRecommendations({ userId: 1 }), status(503));
});