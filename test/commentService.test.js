// KI-Log A28
const test = require("node:test");
const assert = require("node:assert");
const { createCommentService } = require("../services/commentService");
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

// Ersatz-Repository im Speicher. Kommentar 5 gehört Nutzer 7 und Film 157336.
function fakeRepo({ rows = [], total = 0 } = {}) {
  const calls = { createComment: [], listComments: [], updateComment: [], deleteComment: [] };
  return {
    calls,
    createComment: async (args) => { calls.createComment.push(args); return 1042; },
    listComments: async (args) => { calls.listComments.push(args); return rows; },
    countComments: async () => total,
    findComment: async ({ commentId, tmdbId }) =>
      commentId === 5 && tmdbId === 157336 ? { id: 5, nutzer_id: 7 } : undefined,
    updateComment: async (args) => { calls.updateComment.push(args); },
    deleteComment: async (id) => { calls.deleteComment.push(id); },
  };
}

const status = (code) => (err) => err instanceof AppError && err.status === code;

test("Kommentar schreiben: Film wird sichergestellt, Text gekürzt gespeichert, commentId im Format c_…", async () => {
  const movies = fakeMovieService();
  const repo = fakeRepo();
  const result = await createCommentService(movies, repo).addComment({ userId: 7, movieId: 157336, text: "  Spannend!  " });
  assert.deepStrictEqual(movies.calls, [157336]);
  assert.deepStrictEqual(repo.calls.createComment, [{ userId: 7, tmdbId: 157336, text: "Spannend!" }]);
  assert.deepStrictEqual(result, { message: "Your comment has been posted.", commentId: "c_1042" });
});

test("Kommentar schreiben: 500 Zeichen sind erlaubt, 501 nicht; leer, nur Leerzeichen und Nicht-Text ergeben 400", async () => {
  const movies = fakeMovieService();
  const repo = fakeRepo();
  const service = createCommentService(movies, repo);
  await service.addComment({ userId: 7, movieId: 157336, text: "a".repeat(500) });
  for (const text of ["a".repeat(501), "", "   ", undefined, null, 42]) {
    await assert.rejects(
      service.addComment({ userId: 7, movieId: 157336, text }),
      (err) => status(400)(err) && err.message === "Comment must have 1 to 500 characters."
    );
  }
  assert.strictEqual(repo.calls.createComment.length, 1);
  assert.strictEqual(movies.calls.length, 1); // bei 400 wird nichts von TMDB importiert
});

test("Kommentar schreiben: unbekannter Film ergibt 404 und es wird nichts gespeichert", async () => {
  const repo = fakeRepo();
  await assert.rejects(createCommentService(fakeMovieService(), repo).addComment({ userId: 7, movieId: 999, text: "Hallo" }), status(404));
  assert.strictEqual(repo.calls.createComment.length, 0);
});

test("Kommentare lesen: Seite 1 als Standard, Felder wie in API-2 plus userId und updatedAt", async () => {
  const rows = [
    { id: 1042, nutzer_id: 58, vorname: "Lena", text: "Spannend!", erstellt_am: "2026-10-01T18:30:00Z", aktualisiert_am: null },
    { id: 1041, nutzer_id: 7, vorname: "Lukas", text: "Gut", erstellt_am: "2026-10-01T18:00:00Z", aktualisiert_am: "2026-10-02T09:00:00Z" },
  ];
  const repo = fakeRepo({ rows, total: 2 });
  const result = await createCommentService(fakeMovieService(), repo).listComments({ movieId: 157336 });
  assert.deepStrictEqual(repo.calls.listComments, [{ tmdbId: 157336, limit: 20, offset: 0 }]);
  assert.deepStrictEqual(result, {
    page: 1,
    totalPages: 1,
    comments: [
      { commentId: "c_1042", userId: "u_58", firstName: "Lena", text: "Spannend!", createdAt: "2026-10-01T18:30:00Z", updatedAt: null },
      { commentId: "c_1041", userId: "u_7", firstName: "Lukas", text: "Gut", createdAt: "2026-10-01T18:00:00Z", updatedAt: "2026-10-02T09:00:00Z" },
    ],
  });
});

test("Kommentare lesen: totalPages rundet auf, Seite 3 beginnt bei Offset 40, ohne Kommentare ist totalPages 1", async () => {
  const repo = fakeRepo({ total: 41 });
  const service = createCommentService(fakeMovieService(), repo);
  const result = await service.listComments({ movieId: 157336, page: "3" });
  assert.strictEqual(result.page, 3);
  assert.strictEqual(result.totalPages, 3);
  assert.strictEqual(repo.calls.listComments[0].offset, 40);
  assert.strictEqual((await createCommentService(fakeMovieService(), fakeRepo()).listComments({ movieId: 157336 })).totalPages, 1);
});

test("Kommentare lesen: ungültige Seite ergibt 400, unbekannter Film 404", async () => {
  const service = createCommentService(fakeMovieService(), fakeRepo());
  for (const page of ["0", "-1", "abc", "1.5", ""]) {
    await assert.rejects(service.listComments({ movieId: 157336, page }), status(400));
  }
  await assert.rejects(service.listComments({ movieId: 999 }), status(404));
});

test("Kommentar bearbeiten: der Autor ändert den Text (gekürzt)", async () => {
  const repo = fakeRepo();
  const result = await createCommentService(fakeMovieService(), repo).updateComment({
    userId: 7, movieId: 157336, commentId: "c_5", text: " Neuer Text ",
  });
  assert.deepStrictEqual(repo.calls.updateComment, [{ commentId: 5, text: "Neuer Text" }]);
  assert.deepStrictEqual(result, { message: "Your comment has been updated." });
});

test("Kommentar bearbeiten: fremder Kommentar ergibt 403, auch für einen Moderator; es wird nichts geändert", async () => {
  const repo = fakeRepo();
  await assert.rejects(
    createCommentService(fakeMovieService(), repo).updateComment({ userId: 8, movieId: 157336, commentId: "c_5", text: "x" }),
    (err) => status(403)(err) && err.message === "You can only edit your own comments."
  );
  assert.strictEqual(repo.calls.updateComment.length, 0);
});

test("Kommentar bearbeiten: Länge wird geprüft; unbekannte, ungültige oder zu einem anderen Film gehörende ID ergibt 404", async () => {
  const repo = fakeRepo();
  const service = createCommentService(fakeMovieService(), repo);
  await assert.rejects(service.updateComment({ userId: 7, movieId: 157336, commentId: "c_5", text: "" }), status(400));
  await assert.rejects(service.updateComment({ userId: 7, movieId: 157336, commentId: "c_6", text: "x" }), status(404));
  await assert.rejects(service.updateComment({ userId: 7, movieId: 157336, commentId: "5", text: "x" }), status(404));
  await assert.rejects(service.updateComment({ userId: 7, movieId: 157336, commentId: "c_0", text: "x" }), status(404));
  await assert.rejects(service.updateComment({ userId: 7, movieId: 157336, commentId: "c_99999999999", text: "x" }), status(404));
  await assert.rejects(service.updateComment({ userId: 7, movieId: 1, commentId: "c_5", text: "x" }), status(404));
  await assert.rejects(service.updateComment({ userId: 7, movieId: "abc", commentId: "c_5", text: "x" }), status(404));
  assert.strictEqual(repo.calls.updateComment.length, 0);
});

test("Kommentar löschen: Autor und Moderator dürfen, ein anderer Nutzer nicht (403)", async () => {
  const repo = fakeRepo();
  const service = createCommentService(fakeMovieService(), repo);
  const base = { movieId: 157336, commentId: "c_5" };

  assert.deepStrictEqual(await service.deleteComment({ ...base, userId: 7, role: "Nutzer" }), { message: "Comment was deleted." });
  await service.deleteComment({ ...base, userId: 8, role: "Moderator" });
  assert.deepStrictEqual(repo.calls.deleteComment, [5, 5]);

  await assert.rejects(
    service.deleteComment({ ...base, userId: 8, role: "Nutzer" }),
    (err) => status(403)(err) && err.message === "You can only delete your own comments."
  );
  assert.strictEqual(repo.calls.deleteComment.length, 2);
});

test("Kommentar löschen: unbekannter Kommentar ergibt 404, auch für einen Moderator", async () => {
  const service = createCommentService(fakeMovieService(), fakeRepo());
  await assert.rejects(service.deleteComment({ userId: 8, role: "Moderator", movieId: 157336, commentId: "c_6" }), status(404));
});