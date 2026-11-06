// KI-Log A27
const test = require("node:test");
const assert = require("node:assert");
const { createStatusService } = require("../services/statusService");

test("getStatus liefert Status, Nachricht und Filmanzahl wie bisher", async () => {
  const service = createStatusService({ countMovies: async () => 11 });
  assert.deepStrictEqual(await service.getStatus(), {
    status: "ok",
    nachricht: "CineRate-Backend läuft",
    filmeInDb: 11,
  });
});

test("getStatus reicht einen Datenbankfehler weiter (handleError macht daraus 503)", async () => {
  const service = createStatusService({
    countMovies: async () => {
      throw new Error("connection lost");
    },
  });
  await assert.rejects(() => service.getStatus(), /connection lost/);
});
