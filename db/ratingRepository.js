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

  // Alle Bewertungen des Nutzers mit TMDB-ID, Sternen und Genre-Namen (alphabetisch),
  // die zuletzt bewertete zuerst. Grundlage für die Filmvorschläge (US-1).
  async function listRatedMovies(userId) {
    const result = await pool.query(
      `SELECT f.tmdb_id,
              b.punktzahl,
              COALESCE(array_agg(g.name ORDER BY g.name) FILTER (WHERE g.name IS NOT NULL), '{}') AS genres
       FROM Bewertung b
       JOIN Film f ON f.id = b.film_id
       LEFT JOIN Film_Genre fg ON fg.film_id = f.id
       LEFT JOIN Genre g ON g.id = fg.genre_id
       WHERE b.nutzer_id = $1
       GROUP BY b.id, f.id
       ORDER BY b.aktualisiert_am DESC, b.id DESC`,
      [userId]
    );
    return result.rows;
  }

  return { saveRating, getSummary, listRatedMovies };
}

module.exports = { createRatingRepository };