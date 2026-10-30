// Fachregeln für Nutzer (US-2). Kennt weder HTTP (req/res) noch SQL.
// KI-Log A15
const { AppError } = require("../lib/appError");
const { normalizeEmail, isValidRegistration } = require("../lib/validation");
const { hashPassword: defaultHashPassword } = require("../lib/password");

// userRepository: Objekt mit createUser und deleteUser (siehe db/userRepository.js)
// hashPassword lässt sich im Test durch eine schnelle Attrappe ersetzen.
function createUserService(userRepository, hashPassword = defaultHashPassword) {
  // Registrierung: prüft die Eingaben, speichert den Nutzer, gibt die userId zurück.
  async function register(data) {
    if (!isValidRegistration(data)) {
      throw new AppError(400, "Invalid email or password (at least 8 characters).");
    }

    const id = await userRepository.createUser({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: normalizeEmail(data.email),
      passwordHash: await hashPassword(data.password),
    });

    return { userId: "u_" + id };
  }

  // Account löschen: Man darf nur den eigenen Account löschen.
  async function deleteAccount(requestedUserId, currentUserId) {
    if (requestedUserId !== "u_" + currentUserId) {
      throw new AppError(403, "You can only delete your own account.");
    }
    await userRepository.deleteUser(currentUserId);
  }

  return { register, deleteAccount };
}

module.exports = { createUserService };