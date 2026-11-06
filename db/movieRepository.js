// Repository für Filme: enthält nur SQL, keine HTTP- oder Fachregeln.
// Die Verbindung (pool) lässt sich in Tests durch eine Attrappe ersetzen.
// KI-Log A21
const defaultPool = require("./connection");

function createMovieRepository(pool = defaultPool) {
  // Film samt Genre-Namen und Durchschnittsbewertung; undefined, wenn der Film nicht in der DB steht.
  // avg_rating ist NULL, solange es keine Bewertung gibt.
  async function findByTmdbId(tmdbId) {
    const result = await pool.query(
      `SELECT f.tmdb_id, f.titel, f.beschreibung, f.erscheinungsjahr, f.laufzeit, f.poster_pfad, f.fsk,
              (SELECT AVG(b.punktzahl) FROM Bewertung b WHERE b.film_id = f.id) AS avg_rating,
              ARRAY(SELECT g.name FROM Genre g
                    JOIN Film_Genre fg ON fg.genre_id = g.id
                    WHERE fg.film_id = f.id ORDER BY g.name) AS genres
       FROM Film f
       WHERE f.tmdb_id = $1`,
      [tmdbId]
    );
    return result.rows[0];
  }

  // Speichert Film, Genres und Zuordnung in einer Transaktion.
  // Idempotent (E7): ein zweiter Aufruf mit derselben tmdbId aktualisiert den Film.
  async function saveMovie(movie) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const film = await client.query(
        `INSERT INTO Film (tmdb_id, titel, beschreibung, erscheinungsjahr, poster_pfad, laufzeit, fsk)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tmdb_id) DO UPDATE SET
           titel = EXCLUDED.titel,
           beschreibung = EXCLUDED.beschreibung,
           erscheinungsjahr = EXCLUDED.erscheinungsjahr,
           poster_pfad = EXCLUDED.poster_pfad,
           laufzeit = EXCLUDED.laufzeit,
           fsk = EXCLUDED.fsk,
           aktualisiert_am = NOW()
         RETURNING id`,
        [movie.tmdbId, movie.title, movie.description, movie.year, movie.posterPath, movie.runtime, movie.fsk]
      );
      const filmId = film.rows[0].id;

      for (const genre of movie.genres) {
        const saved = await client.query(
          `INSERT INTO Genre (tmdb_genre_id, name) VALUES ($1, $2)
           ON CONFLICT (tmdb_genre_id) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [genre.tmdbGenreId, genre.name]
        );
        await client.query(
          "INSERT INTO Film_Genre (film_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [filmId, saved.rows[0].id]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err; // alles Unerwartete behandelt handleError (500, bei DB-Ausfall 503)
    } finally {
      client.release();
    }
  }

  return { findByTmdbId, saveMovie };
}

module.exports = { createMovieRepository };