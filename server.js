require("dotenv").config();
const express = require("express");
const cors = require("cors");
const statusRoute = require("./routes/status");
const usersRoute = require("./routes/users");
const authRoute = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 3000;

// Kern-Backend: reine CRUD-API gegen die Datenbank (Nutzer, Film, Bewertung).
// Kennt TMDB nicht - das übernimmt ausschließlich das BFF (cinerate-bff).
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

app.listen(PORT, () => {
  console.log(`CineRate-Backend läuft auf http://localhost:${PORT}`);
});
