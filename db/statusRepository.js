// Repository für den Status: enthält nur SQL, keine HTTP- oder Fachregeln.
// Die Verbindung (pool) lässt sich in Tests durch eine Attrappe ersetzen.
const defaultPool = require("./connection");

function createStatusRepository(pool = defaultPool) {
  // Anzahl der Filme in der Datenbank. Der Aufruf zeigt zugleich, dass die Datenbank erreichbar ist.
  async function countMovies() {
    const result = await pool.query("SELECT COUNT(*) AS anzahl FROM Film");
    return parseInt(result.rows[0].anzahl, 10);
  }

  return { countMovies };
}

module.exports = { createStatusRepository };
