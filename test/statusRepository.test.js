// KI-Log A27
const test = require("node:test");
const assert = require("node:assert");
const { createStatusRepository } = require("../db/statusRepository");

// Ersatz-Pool: merkt sich das SQL und liefert feste Zeilen oder wirft einen Fehler
function fakePool(rows = [], error = null) {
  const calls = [];
  return {
    calls,
    query: async (text, params) => {
      calls.push({ text: text.replace(/\s+/g, " "), params });
      if (error) throw error;
      return { rows };
    },
  };
}

test("countMovies zählt die Filme und wandelt den Text aus der Datenbank in eine Zahl", async () => {
  const pool = fakePool([{ anzahl: "11" }]);
  const result = await createStatusRepository(pool).countMovies();
  assert.strictEqual(result, 11);
  assert.match(pool.calls[0].text, /SELECT COUNT\(\*\) AS anzahl FROM Film/);
});

test("countMovies liefert 0, wenn es keine Filme gibt", async () => {
  const result = await createStatusRepository(fakePool([{ anzahl: "0" }])).countMovies();
  assert.strictEqual(result, 0);
});

test("countMovies reicht Datenbankfehler unverändert weiter", async () => {
  const pool = fakePool([], new Error("connection lost"));
  await assert.rejects(() => createStatusRepository(pool).countMovies(), /connection lost/);
});
