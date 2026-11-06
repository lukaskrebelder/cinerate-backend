// KI-Log A42
// Prüft die zentrale Fehlerbehandlung mit echten HTTP-Anfragen an die App.
// Keiner der Fälle erreicht die Datenbank oder TMDB.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const app = require("../app");

let server;
let baseUrl;

before(
  () =>
    new Promise((resolve) => {
      // Port 0: das Betriebssystem wählt einen freien Port
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    })
);

after(
  () =>
    new Promise((resolve) => {
      server.closeAllConnections();
      server.close(resolve);
    })
);

// Schickt die Anfrage und liefert Status, Content-Type und den Body als JSON
async function send(method, path, { body, headers = {} } = {}) {
  const response = await fetch(baseUrl + path, { method, body, headers });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    body: await response.json(),
  };
}

test("ungültiges JSON im Body ergibt 400 als JSON", async () => {
  const res = await send("POST", "/api/users", {
    body: '{"email": "a@b.de",}',
    headers: { "Content-Type": "application/json" },
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.contentType, /application\/json/);
  assert.deepStrictEqual(res.body, { message: "Request body is not valid JSON." });
});

test("zu großer Body ergibt 413 als JSON", async () => {
  const res = await send("POST", "/api/users", {
    body: JSON.stringify({ text: "x".repeat(200 * 1024) }), // Grenze von express.json(): 100 KB
    headers: { "Content-Type": "application/json" },
  });
  assert.strictEqual(res.status, 413);
  assert.match(res.contentType, /application\/json/);
  assert.strictEqual(typeof res.body.message, "string");
});

test("unbekannte Route ergibt 404 als JSON", async () => {
  const res = await send("GET", "/api/gibt-es-nicht");
  assert.strictEqual(res.status, 404);
  assert.match(res.contentType, /application\/json/);
  assert.deepStrictEqual(res.body, { message: "Route not found." });
});

test("unbekannte Methode auf bekanntem Pfad ergibt 404 als JSON", async () => {
  const res = await send("PATCH", "/api/watchlist");
  assert.strictEqual(res.status, 404);
  assert.deepStrictEqual(res.body, { message: "Route not found." });
});

test("Pfad ohne /api ergibt 404 als JSON", async () => {
  const res = await send("GET", "/");
  assert.strictEqual(res.status, 404);
  assert.deepStrictEqual(res.body, { message: "Route not found." });
});

test("geschützte Route ohne Token ergibt weiterhin 401 als JSON", async () => {
  const res = await send("GET", "/api/movies");
  assert.strictEqual(res.status, 401);
  assert.deepStrictEqual(res.body, { message: "Invalid token." });
});

// Die Routen haben kein eigenes try/catch mehr. Dieser Test sichert ab, dass Express 5
// einen Fehler aus einer async-Route wirklich an errorMiddleware weitergibt.
test("Fehler aus einer async-Route kommt als JSON mit dem Status des AppError an", async () => {
  const express = require("express");
  const { AppError, errorMiddleware } = require("../lib/appError");
  const mini = express();
  mini.get("/fehler", async () => {
    throw new AppError(404, "No movie found for this ID.");
  });
  mini.use(errorMiddleware);

  const miniServer = await new Promise((resolve) => {
    const s = mini.listen(0, () => resolve(s));
  });
  try {
    const response = await fetch(`http://127.0.0.1:${miniServer.address().port}/fehler`);
    assert.strictEqual(response.status, 404);
    assert.deepStrictEqual(await response.json(), { message: "No movie found for this ID." });
  } finally {
    miniServer.closeAllConnections();
    await new Promise((resolve) => miniServer.close(resolve));
  }
});

// KI-Log A43
test("Antworten enthalten keinen X-Powered-By-Header", async () => {
  const response = await fetch(baseUrl + "/api/gibt-es-nicht");
  await response.text();
  assert.strictEqual(response.headers.get("x-powered-by"), null);
});

// KI-Log A45
// App mit eingeschaltetem Schlüssel (wie auf Heroku, wenn INTERNAL_API_KEY gesetzt ist)
test("mit INTERNAL_API_KEY: ohne Header 403, mit Header normale Antwort, Status frei", async () => {
  const { createApp } = require("../app");
  const keyServer = await new Promise((resolve) => {
    const s = createApp({ internalKey: "geheim-123" }).listen(0, () => resolve(s));
  });
  const url = `http://127.0.0.1:${keyServer.address().port}`;
  const json = { "Content-Type": "application/json" };
  try {
    const ohne = await fetch(url + "/api/gibt-es-nicht");
    assert.strictEqual(ohne.status, 403);
    assert.deepStrictEqual(await ohne.json(), { message: "Access is only allowed via the BFF." });

    // Geprüft wird vor dem Lesen des Bodys: ohne Schlüssel auch bei kaputtem JSON 403
    const kaputtOhne = await fetch(url + "/api/users", { method: "POST", headers: json, body: "{x" });
    assert.strictEqual(kaputtOhne.status, 403);
    await kaputtOhne.text();

    const mit = await fetch(url + "/api/gibt-es-nicht", { headers: { "X-Internal-Key": "geheim-123" } });
    assert.strictEqual(mit.status, 404);
    await mit.text();

    const kaputtMit = await fetch(url + "/api/users", {
      method: "POST",
      headers: { ...json, "X-Internal-Key": "geheim-123" },
      body: "{x",
    });
    assert.strictEqual(kaputtMit.status, 400);
    await kaputtMit.text();

    // Der Status braucht keinen Schlüssel. Ohne erreichbare Datenbank kommt 503, aber nie 403.
    const original = console.error;
    console.error = () => {};
    try {
      const status = await fetch(url + "/api/status");
      assert.notStrictEqual(status.status, 403);
      await status.text();
    } finally {
      console.error = original;
    }
  } finally {
    keyServer.closeAllConnections();
    await new Promise((resolve) => keyServer.close(resolve));
  }
});

test("Antworten enthalten keine CORS-Header mehr", async () => {
  const response = await fetch(baseUrl + "/api/gibt-es-nicht", { headers: { Origin: "https://example.org" } });
  await response.text();
  assert.strictEqual(response.headers.get("access-control-allow-origin"), null);
});
