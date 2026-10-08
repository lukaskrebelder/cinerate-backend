// Passwort-Hash für die Registrierung und die Anmeldung (US-2).
// Das Passwort wird nie im Klartext gespeichert, sondern nur als bcrypt-Hash.
const bcrypt = require("bcryptjs");

// Je höher die Zahl, desto aufwendiger (und sicherer) ist die Berechnung.
const SALT_ROUNDS = 10;

// Wandelt ein Passwort in einen Hash um, der in der Datenbank gespeichert wird.
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Prüft, ob ein eingegebenes Passwort zu einem gespeicherten Hash passt.
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { hashPassword, verifyPassword };