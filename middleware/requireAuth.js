// Prüft den Header "Authorization: Bearer <token>" bei geschützten Routen.
// Die eigentliche Prüfung (Hash, Ablauf, Rolle) macht der authService.
const { AppError, handleError } = require("../lib/appError");
const { createSessionRepository } = require("../db/sessionRepository");
const { createAuthService } = require("../services/authService");

function createRequireAuth(authService) {
  return async function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    try {
      if (scheme !== "Bearer" || !token) {
        throw new AppError(401, "Invalid token.");
      }
      const user = await authService.authenticate(token);

      // Nachfolgende Routen wissen damit, wer angemeldet ist und welche Rolle er hat
      req.user = { id: user.id, rolle: user.rolle };
      req.sessionId = user.sessionId;
      next();
    } catch (err) {
      handleError(err, res);
    }
  };
}

// Standard-Instanz für die Routen; createRequireAuth ist für Tests da.
const requireAuth = createRequireAuth(createAuthService(createSessionRepository()));

module.exports = requireAuth;
module.exports.createRequireAuth = createRequireAuth;