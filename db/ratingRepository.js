// Repository für Bewertungen: enthält nur SQL, keine HTTP- oder Fachregeln.
// Die Verbindung (pool) lässt sich in Tests durch eine Attrappe ersetzen.
const defaultPool = require("./connection");

function createRatingRepository(pool = defaultPool) {
  // Speichert die Bewertung des Nutzers für den Film (TMDB-ID). Gibt es sie schon, wird sie geändert.
  // Der Film muss vorher in der Datenbank stehen (ensureMovie im movieService).
  async function saveRating({ userId, tmdbId, stars }) {
    await pool.query(
      `INSERT INTO Bewertung (nutzer_id, film_id, punktzahl)
       SELECT $1, f.id, $3 FROM Film f WHERE f.tmdb_id = $2
       ON CONFLICT (nutzer_id, film_id) DO UPDATE SET
         punktzahl = EXCLUDED.punktzahl,
         aktualisiert_am = NOW()`,
      [userId, tmdbId, stars]
    );
  }

  // Durchschnitt, Anzahl und die eigenen Sterne des Nutzers; undefined, wenn der Film nicht in der DB steht.
  // Ohne Bewertungen: avg_rating NULL, rating_count 0, own_stars NULL.
  async function getSummary({ userId, tmdbId }) {
    const result = await pool.query(
      `SELECT AVG(b.punktzahl) AS avg_rating,
              COUNT(b.id) AS rating_count,
              MAX(CASE WHEN b.nutzer_id = $1 THEN b.punktzahl END) AS own_stars
       FROM Film f
       LEFT JOIN Bewertung b ON b.film_id = f.id
       WHERE f.tmdb_id = $2
       GROUP BY f.id`,
      [userId, tmdbId]
    );
    return result.rows[0];
  }

  return { saveRating, getSummary };
}

module.exports = { createRatingRepository };