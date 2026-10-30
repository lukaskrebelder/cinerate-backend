// Repository für Kommentare: enthält nur SQL, keine HTTP- oder Fachregeln.
// Die Verbindung (pool) lässt sich in Tests durch eine Attrappe ersetzen.
// KI-Log A28
const defaultPool = require("./connection");

// Die Spalten sind TIMESTAMP ohne Zeitzone (Heroku Postgres speichert UTC). to_char liefert daher
// direkt einen ISO-Text mit "Z" und umgeht die Zeitzone des Node-Prozesses.
const ISO = `"YYYY-MM-DD"T"HH24:MI:SS"Z"`;

function createCommentRepository(pool = defaultPool) {
  // Speichert einen Kommentar zum Film (TMDB-ID) und gibt die neue Kommentar-ID zurück.
  // Der Film muss vorher in der Datenbank stehen (ensureMovie im movieService).
  async function createComment({ userId, tmdbId, text }) {
    const result = await pool.query(
      `INSERT INTO Kommentar (nutzer_id, film_id, text)
       SELECT $1, f.id, $3 FROM Film f WHERE f.tmdb_id = $2
       RETURNING id`,
      [userId, tmdbId, text]
    );
    return result.rows[0].id;
  }

  // Eine Seite Kommentare zum Film, die neuesten zuerst. Dazu der Vorname des Autors.
  async function listComments({ tmdbId, limit, offset }) {
    const result = await pool.query(
      `SELECT k.id, k.nutzer_id, n.vorname, k.text,
              to_char(k.erstellt_am, '${ISO}') AS erstellt_am,
              to_char(k.aktualisiert_am, '${ISO}') AS aktualisiert_am
       FROM Kommentar k
       JOIN Film f ON f.id = k.film_id
       JOIN Nutzer n ON n.id = k.nutzer_id
       WHERE f.tmdb_id = $1
       ORDER BY k.erstellt_am DESC, k.id DESC
       LIMIT $2 OFFSET $3`,
      [tmdbId, limit, offset]
    );
    return result.rows;
  }

  // Anzahl aller Kommentare zum Film (für totalPages)
  async function countComments(tmdbId) {
    const result = await pool.query(
      `SELECT COUNT(*) AS total
       FROM Kommentar k
       JOIN Film f ON f.id = k.film_id
       WHERE f.tmdb_id = $1`,
      [tmdbId]
    );
    return Number(result.rows[0].total);
  }

  // Autor (nutzer_id) des Kommentars, wenn er zu diesem Film gehört; sonst undefined.
  async function findComment({ commentId, tmdbId }) {
    const result = await pool.query(
      `SELECT k.id, k.nutzer_id
       FROM Kommentar k
       JOIN Film f ON f.id = k.film_id
       WHERE k.id = $1 AND f.tmdb_id = $2`,
      [commentId, tmdbId]
    );
    return result.rows[0];
  }

  // Ändert den Text und setzt aktualisiert_am (NULL = nie bearbeitet)
  async function updateComment({ commentId, text }) {
    await pool.query(
      `UPDATE Kommentar SET text = $2, aktualisiert_am = NOW() WHERE id = $1`,
      [commentId, text]
    );
  }

  async function deleteComment(commentId) {
    await pool.query(`DELETE FROM Kommentar WHERE id = $1`, [commentId]);
  }

  return { createComment, listComments, countComments, findComment, updateComment, deleteComment };
}

module.exports = { createCommentRepository };