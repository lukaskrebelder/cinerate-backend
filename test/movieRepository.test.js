const test = require("node:test");
const assert = require("node:assert");
const { createMovieRepository } = require("../db/movieRepository");

const film = {
  tmdbId: 157336,
  title: "Interstellar",
  description: "Astronauten suchen eine neue Heimat.",
  year: 2014,
  posterPath: "/abc.jpg",
  runtime: 169,
  fsk: "12",
  genres: [
    { tmdbGenreId: 878, name: "Science Fiction" },
    { tmdbGenreId: 18, name: "Drama" },
  ],
};

// Ersatz-Pool: merkt sich die SQL-Befehle (nur bis zur ersten Klammer) und ob der Client freigegeben wurde.
// failOn: Befehle, die diesen Text enthalten, werfen einen Fehler.
function fakePool({ failOn } = {}) {
  const befehle = [];
  const zustand = { released: false };
  const client = {
    query: async (text) => {
      const kurz = text.replace(/\s+/g, " ").trim().split(" (")[0];
      befehle.push(kurz);
      if (failOn && kurz.includes(failOn)) throw new Error("boom");
      return { rows: [{ id: 1 }] };
    },
    release: () => { zustand.released = true; },
  };
  return { befehle, zustand, connect: async () => client };
}

test("findByTmdbId liefert die Zeile und übergibt die tmdbId", async () => {
  let gesehen;
  const zeile = { tmdb_id: 157336, titel: "Interstellar", avg_rating: null, genres: [] };
  const pool = { query: async (sql, params) => { gesehen = params; return { rows: [zeile] }; } };
  const result = await createMovieRepository(pool).findByTmdbId(157336);
  assert.deepStrictEqual(gesehen, [157336]);
  assert.deepStrictEqual(result, zeile);
});

test("findByTmdbId liefert undefined, wenn es den Film nicht gibt", async () => {
  const pool = { query: async () => ({ rows: [] }) };
  assert.strictEqual(await createMovieRepository(pool).findByTmdbId(1), undefined);
});

test("saveMovie speichert Film, Genres und Zuordnungen in einer Transaktion", async () => {
  const pool = fakePool();
  await createMovieRepository(pool).saveMovie(film);
  assert.deepStrictEqual(pool.befehle, [
    "BEGIN",
    "INSERT INTO Film",
    "INSERT INTO Genre",
    "INSERT INTO Film_Genre",
    "INSERT INTO Genre",
    "INSERT INTO Film_Genre",
    "COMMIT",
  ]);
  assert.strictEqual(pool.zustand.released, true);
});

test("saveMovie macht bei einem Fehler ROLLBACK, gibt den Client frei und wirft weiter", async () => {
  const pool = fakePool({ failOn: "INSERT INTO Genre" });
  await assert.rejects(() => createMovieRepository(pool).saveMovie(film), /boom/);
  assert.ok(pool.befehle.includes("ROLLBACK"));
  assert.ok(!pool.befehle.includes("COMMIT"));
  assert.strictEqual(pool.zustand.released, true);
});