require("dotenv").config();
const express = require("express");
const cors = require("cors");
const statusRoute = require("./routes/status");
const usersRoute = require("./routes/users");
const authRoute = require("./routes/auth");
const moviesRoute = require("./routes/movies");
const ratingsRoute = require("./routes/ratings");

const app = express();
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`CineRate-Backend läuft auf http://localhost:${PORT}`);
});
