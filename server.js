// Startet das Backend. Die App selbst (Routen, Middleware) steht in app.js.
// dotenv muss vor app.js geladen werden, weil db/connection.js DATABASE_URL beim Laden liest.
require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 3000;

// KI-Log A45
if (!process.env.INTERNAL_API_KEY) {
  console.warn("INTERNAL_API_KEY ist nicht gesetzt: Das Backend nimmt Anfragen ohne Schlüssel des BFF an.");
}

app.listen(PORT, () => {
  console.log(`CineRate-Backend läuft auf http://localhost:${PORT}`);
});
