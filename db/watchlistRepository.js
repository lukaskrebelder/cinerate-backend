// Repository für die Watchlist: enthält nur SQL, keine HTTP- oder Fachregeln.
// Die Verbindung (pool) lässt sich in Tests durch eine Attrappe ersetzen.
const defaultPool = require("./connection");
const { AppError } = require("../lib/appError");

function createWatchlistRepository(pool = defaultPool) {
  // Setzt den Film (TMDB-ID) auf die Watchlist des Nutzers. Der Film muss vorher in der Datenbank stehen.
  async function addMovie({ userId, tmdbId }) {
    try {
      await pool.query(
        `INSERT INTO Watchlist (nutzer_id, film_id)
         SELECT $1, f.id FROM Film f WHERE f.tmdb_id = $2`,
        [userId, tmdbId]
      );
    } catch (err) {
      // 23505 = Primärschlüssel (nutzer_id, film_id) verletzt, der Film steht schon auf der Watchlist
      if (err.code === "23505") {
        throw new AppError(409, "Movie is already on your watchlist.");
      }
      throw err; // alles andere behandelt handleError als 503
    }
  }

  // Entfernt den Film von der Watchlist; gibt true zurück, wenn er darauf stand, sonst false.
  async function removeMovie({ userId, tmdbId }) {
    const result = await pool.query(
      `DELETE FROM Watchlist w
       USING Film f
       WHERE w.film_id = f.id AND w.nutzer_id = $1 AND f.tmdb_id = $2`,
      [userId, tmdbId]
    );
    return result.rowCount > 0;
  }

  // Filme der Watchlist, die zuletzt hinzugefügten zuerst.
  async function listMovies(userId) {
    const result = await pool.query(
      `SELECT f.tmdb_id, f.titel, f.poster_pfad
       FROM Watchlist w
       JOIN Film f ON f.id = w.film_id
       WHERE w.nutzer_id = $1
       ORDER BY w.hinzugefuegt_am DESC, f.id DESC`,
      [userId]
    );
    return result.rows;
  }

  return { addMovie, removeMovie, listMovies };
}

module.exports = { createWatchlistRepository };