const test = require("node:test");
const assert = require("node:assert");
const { createRatingService } = require("../services/ratingService");
const { AppError } = require("../lib/appError");

// Ersatz-movieService: Film 999 ist unbekannt (404)
const fakeMovieService = {
  ensureMovie: async (id) => {
    if (String(id) === "999") throw new AppError(404, "No movie found for this ID.");
    return { tmdb_id: Number(id) };
  },
};

// Ersatz-Repository im Speicher; liefert wie Postgres Zahlen als Text (AVG, COUNT)
function fakeRepo() {
  const ratings = [];
  const calls = { saveRating: 0 };
  return {
    calls,
    saveRating: async ({ userId, tmdbId, stars }) => {
      calls.saveRating++;
      const existing = ratings.find((r) => r.userId === userId && r.tmdbId === tmdbId);
      if (existing) existing.stars = stars;
      else ratings.push({ userId, tmdbId, stars });
    },
    getSummary: async ({ userId, tmdbId }) => {
      const list = ratings.filter((r) => r.tmdbId === tmdbId);
      const mine = list.find((r) => r.userId === userId);
      const avg = list.length ? list.reduce((sum, r) => sum + r.stars, 0) / list.length : null;
      return {
        avg_rating: avg === null ? null : String(avg),
        rating_count: String(list.length),
        own_stars: mine ? mine.stars : null,
      };
    },
  };
}

const is400 = (err) => err instanceof AppError && err.status === 400;
const is404 = (err) => err instanceof AppError && err.status === 404;

test("neue Bewertung wird gespeichert (created) und liefert den Durchschnitt", async () => {
  const service = createRatingService(fakeMovieService, fakeRepo());
  const result = await service.saveRating({ userId: 1, movieId: "157336", stars: 5 });
  assert.deepStrictEqual(result, {
    created: true,
    message: "Your rating has been saved.",
    stars: 5,
    avgRating: 5,
  });
});

test("zweite Bewertung desselben Nutzers ändert die erste (nicht created)", async () => {
  const service = createRatingService(fakeMovieService, fakeRepo());
  await service.saveRating({ userId: 1, movieId: "157336", stars: 5 });
  const result = await service.saveRating({ userId: 1, movieId: "157336", stars: 4 });
  assert.deepStrictEqual(result, {
    created: false,
    message: "Your rating has been updated.",
    stars: 4,
    avgRating: 4,
  });
});

test("Durchschnitt über mehrere Nutzer wird auf eine Dezimalstelle gerundet", async () => {
  const service = createRatingService(fakeMovieService, fakeRepo());
  await service.saveRating({ userId: 1, movieId: "157336", stars: 5 });
  await service.saveRating({ userId: 2, movieId: "157336", stars: 4 });
  const result = await service.saveRating({ userId: 3, movieId: "157336", stars: 4 });
  assert.strictEqual(result.avgRating, 4.3);
});

test("ungültige Sterne ergeben 400 und es wird nichts gespeichert", async () => {
  const repo = fakeRepo();
  const service = createRatingService(fakeMovieService, repo);
  for (const stars of [0, 6, 3.5, "5", null, undefined]) {
    await assert.rejects(service.saveRating({ userId: 1, movieId: "157336", stars }), is400);
  }
  assert.strictEqual(repo.calls.saveRating, 0);
});

test("unbekannter Film ergibt 404", async () => {
  const service = createRatingService(fakeMovieService, fakeRepo());
  await assert.rejects(service.saveRating({ userId: 1, movieId: "999", stars: 5 }), is404);
  await assert.rejects(service.getRatings({ userId: 1, movieId: "999" }), is404);
});

test("GET ohne Bewertungen liefert null, 0 und null", async () => {
  const service = createRatingService(fakeMovieService, fakeRepo());
  const result = await service.getRatings({ userId: 1, movieId: "157336" });
  assert.deepStrictEqual(result, { avgRating: null, ratingCount: 0, ownStars: null });
});

test("GET liefert Durchschnitt, Anzahl und die eigenen Sterne", async () => {
  const service = createRatingService(fakeMovieService, fakeRepo());
  await service.saveRating({ userId: 1, movieId: "157336", stars: 5 });
  await service.saveRating({ userId: 2, movieId: "157336", stars: 4 });
  const result = await service.getRatings({ userId: 1, movieId: "157336" });
  assert.deepStrictEqual(result, { avgRating: 4.5, ratingCount: 2, ownStars: 5 });
});