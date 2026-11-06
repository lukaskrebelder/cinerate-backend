// Baut die Express-App zusammen: Middleware, Routen und Fehlerbehandlung.
// Getrennt von server.js, damit Tests die App ohne festen Port starten können.
// KI-Log A42
const express = require("express");
const { errorMiddleware, notFoundMiddleware } = require("./lib/appError");
const { createRequireInternalKey } = require("./middleware/requireInternalKey");
const statusRoute = require("./routes/status");
const usersRoute = require("./routes/users");
const authRoute = require("./routes/auth");
const moviesRoute = require("./routes/movies");
const ratingsRoute = require("./routes/ratings");
const watchlistRoute = require("./routes/watchlist");
const commentsRoute = require("./routes/comments");
const recommendationsRoute = require("./routes/recommendations");

// KI-Log A45
// options.internalKey: gemeinsamer Schlüssel von BFF und Backend (siehe middleware/requireInternalKey.js).
// Standard ist die Config Var INTERNAL_API_KEY; Tests übergeben einen eigenen Wert.
function createApp({ internalKey = process.env.INTERNAL_API_KEY } = {}) {
  const app = express();

  // KI-Log A43
  // Header "X-Powered-By: Express" weglassen, damit nicht jeder sieht, welches Framework läuft
  app.disable("x-powered-by");

  // Backend: REST-API gegen die Datenbank (Nutzer, Film, Bewertung).
  // Ruft bei Bedarf die TMDB-API auf (integrations/tmdbClient.js) und speichert die Filme.
  // Kein CORS: Kein Browser ruft dieses Backend direkt auf, nur das BFF (Server zu Server).

  // Der Status bleibt ohne Schlüssel erreichbar (Demo, Prüfen nach dem Deployment)
  app.use("/api", statusRoute);

  // Alles andere nur mit dem Schlüssel des BFF, geprüft noch vor dem Lesen des Bodys
  app.use(createRequireInternalKey(internalKey));

  app.use(express.json());

  app.use("/api", usersRoute);
  app.use("/api", authRoute);
  app.use("/api", moviesRoute);
  app.use("/api", ratingsRoute);
  app.use("/api", watchlistRoute);
  app.use("/api", commentsRoute);
  app.use("/api", recommendationsRoute);

  // Reihenfolge wichtig: erst unbekannte Routen, ganz am Ende die Fehlerbehandlung
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

module.exports = createApp();
module.exports.createApp = createApp;
