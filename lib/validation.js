// Prüfregeln für Registrierung und Anmeldung (US-2).
// Reine Funktionen ohne Datenbank, damit sie sich einfach testen lassen.

// Text ohne Leerzeichen am Anfang und Ende, in Kleinbuchstaben
function normalizeEmail(email) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

// Kein Leerzeichen, genau ein @, danach Text, ein Punkt und wieder Text
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === "string" && EMAIL_PATTERN.test(email);
}

// Mindestens 8 Zeichen, Leerzeichen zählen mit (das Passwort wird nicht getrimmt)
function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

// Text, der nicht leer ist und nicht nur aus Leerzeichen besteht
function isNonEmptyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidRegistration(data) {
  if (typeof data !== "object" || data === null) return false;
  return (
    isNonEmptyText(data.firstName) &&
    isNonEmptyText(data.lastName) &&
    isValidEmail(normalizeEmail(data.email)) &&
    isValidPassword(data.password)
  );
}

   module.exports = {
     normalizeEmail,
     isValidEmail,
     isValidPassword,
     isNonEmptyText,
     isValidRegistration,
   };