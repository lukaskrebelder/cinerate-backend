// Repository für Nutzer: enthält nur SQL, keine HTTP- oder Fachregeln.
// Die Verbindung (pool) lässt sich in Tests durch eine Attrappe ersetzen.
const defaultPool = require("./connection");
const { AppError } = require("../lib/appError");

function createUserRepository(pool = defaultPool) {
  // Legt einen Nutzer an und gibt die neue ID zurück.
  async function createUser({ firstName, lastName, email, passwordHash }) {
    try {
      const result = await pool.query(
        "INSERT INTO Nutzer (vorname, nachname, email, passwort_hash) VALUES ($1, $2, $3, $4) RETURNING id",
        [firstName, lastName, email, passwordHash]
      );
      return result.rows[0].id;
    } catch (err) {
      // 23505 = UNIQUE-Regel verletzt, die E-Mail gibt es schon
      if (err.code === "23505") {
        throw new AppError(409, "An account with this email already exists.");
      }
      throw err; // alles andere behandelt handleError als 503
    }
  }

  // Löscht den Nutzer; ON DELETE CASCADE löscht Sitzungen, Bewertungen, Kommentare und Watchlist mit.
  async function deleteUser(id) {
    await pool.query("DELETE FROM Nutzer WHERE id = $1", [id]);
  }

  return { createUser, deleteUser };
}

module.exports = { createUserRepository };