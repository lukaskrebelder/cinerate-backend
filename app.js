// Baut die Express-App zusammen: Middleware, Routen und Fehlerbehandlung.
// Getrennt von server.js, damit Tests die App ohne festen Port starten können.
// KI-Log A42
const express = require("express");
const cors = require("cors");
const { errorMiddleware, notFoundMiddleware } = require("./lib/appError");
const statusRoute = require("./routes/status");
const usersRoute = require("./routes/users");
const authRoute = require("./routes/auth");
const moviesRoute = require("./routes/movies");
const ratingsRoute = require("./routes/ratings");
const watchlistRoute = require("./routes/watchlist");
const commentsRoute = require("./routes/comments");
const recommendationsRoute = require("./routes/recommendations");

const app = express();

// Backend: REST-API gegen die Datenbank (Nutzer, Film, Bewertung).
// Ruft bei Bedarf die TMDB-API auf (integrations/tmdbClient.js) und speichert die Filme.
// CORS: nur das BFF darf dieses Backend aufrufen, nicht die SPA direkt.
app.use(
  cors({
    origin: process.env.BFF_URL || "*",
  })
);

app.use(express.json());

app.use("/api", statusRoute);
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

module.exports = app;
