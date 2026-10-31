// KI-Log A28
const test = require("node:test");
const assert = require("node:assert");
const { createCommentRepository } = require("../db/commentRepository");

// Ersatz-Pool: merkt sich SQL und Parameter und liefert feste Ergebnisse
function fakePool({ rows = [] } = {}) {
  const calls = [];
  return {
    calls,
    query: async (text, params) => {
      calls.push({ text: text.replace(/\s+/g, " "), params });
      return { rows, rowCount: rows.length };
    },
  };
}

test("createComment fügt über die TMDB-ID ein und gibt die neue ID zurück", async () => {
  const pool = fakePool({ rows: [{ id: 1042 }] });
  const id = await createCommentRepository(pool).createComment({ userId: 7, tmdbId: 157336, text: "Hallo" });
  assert.strictEqual(id, 1042);
  assert.match(pool.calls[0].text, /INSERT INTO Kommentar/);
  assert.match(pool.calls[0].text, /RETURNING id/);
  assert.deepStrictEqual(pool.calls[0].params, [7, 157336, "Hallo"]);
});

test("listComments sortiert neueste zuerst, gibt Zeiten als ISO-Text zurück und übergibt Limit und Offset", async () => {
  const rows = [{ id: 1 }];
  const pool = fakePool({ rows });
  const result = await createCommentRepository(pool).listComments({ tmdbId: 157336, limit: 20, offset: 40 });
  assert.strictEqual(result, rows);
  assert.match(pool.calls[0].text, /ORDER BY k\.erstellt_am DESC, k\.id DESC/);
  assert.match(pool.calls[0].text, /to_char\(k\.erstellt_am/);
  assert.match(pool.calls[0].text, /to_char\(k\.aktualisiert_am/);
  assert.match(pool.calls[0].text, /to_char\(k\.erstellt_am, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'\)/);
  assert.deepStrictEqual(pool.calls[0].params, [157336, 20, 40]);
});

test("countComments gibt die Anzahl als Zahl zurück", async () => {
  const pool = fakePool({ rows: [{ total: "41" }] });
  assert.strictEqual(await createCommentRepository(pool).countComments(157336), 41);
  assert.deepStrictEqual(pool.calls[0].params, [157336]);
});

test("findComment sucht über Kommentar-ID und TMDB-ID; ohne Treffer undefined", async () => {
  const found = fakePool({ rows: [{ id: 5, nutzer_id: 7 }] });
  assert.deepStrictEqual(await createCommentRepository(found).findComment({ commentId: 5, tmdbId: 157336 }), { id: 5, nutzer_id: 7 });
  assert.deepStrictEqual(found.calls[0].params, [5, 157336]);
  assert.strictEqual(await createCommentRepository(fakePool()).findComment({ commentId: 6, tmdbId: 157336 }), undefined);
});

test("updateComment setzt Text und aktualisiert_am, deleteComment löscht über die ID", async () => {
  const pool = fakePool();
  const repo = createCommentRepository(pool);
  await repo.updateComment({ commentId: 5, text: "Neu" });
  await repo.deleteComment(5);
  assert.match(pool.calls[0].text, /UPDATE Kommentar SET text = \$2, aktualisiert_am = NOW\(\) WHERE id = \$1/);
  assert.deepStrictEqual(pool.calls[0].params, [5, "Neu"]);
  assert.match(pool.calls[1].text, /DELETE FROM Kommentar WHERE id = \$1/);
  assert.deepStrictEqual(pool.calls[1].params, [5]);
});