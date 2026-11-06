// Zentrale PostgreSQL-Verbindung, die von den Routen genutzt wird
// DATABASE_URL wird von Heroku automatisch gesetzt (Heroku Postgres Add-on).
// Für lokale Entwicklung in der .env-Datei selbst eintragen, z. B.:
// DATABASE_URL=postgres://user:passwort@localhost:5432/cinerate
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const isLocal =
  !connectionString || connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

const pool = new Pool({
  connectionString,
  // Heroku Postgres verlangt SSL, eine lokale Datenbank i. d. R. nicht.
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// KI-Log A44
// Bricht eine gerade unbenutzte Verbindung ab (z. B. bei einer Wartung oder einem Neustart von
// Heroku Postgres), meldet pg das als "error"-Event am Pool. Ohne Listener beendet Node dann den
// ganzen Prozess. Mit Listener wird der Fehler nur geloggt; der Pool verwirft die kaputte
// Verbindung und baut bei der nächsten Anfrage selbst eine neue auf.
pool.on("error", (err) => {
  console.error("Postgres-Verbindung im Leerlauf abgebrochen:", err.message);
});

module.exports = pool;
