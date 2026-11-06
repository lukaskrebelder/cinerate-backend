// KI-Log A45
// Lässt nur Anfragen durch, die den gemeinsamen Schlüssel von BFF und Backend im Header
// "X-Internal-Key" mitschicken. So kommt nur das BFF an das Backend, nicht jeder, der die
// Heroku-Adresse kennt. (CORS kann das nicht leisten: Es gilt nur für Browser, das BFF ruft
// das Backend aber von Server zu Server auf.)
const crypto = require("crypto");
const { AppError } = require("../lib/appError");

// Beide Werte werden vor dem Vergleich gehasht: gleiche Länge für timingSafeEqual, und die
// Dauer des Vergleichs verrät weder die Länge noch die richtigen Anfangszeichen des Schlüssels.
const sha256 = (text) => crypto.createHash("sha256").update(text).digest();

// expectedKey: Wert der Config Var INTERNAL_API_KEY.
// Ist er leer, prüft die Middleware nichts. So kann das Backend schon deployt werden, bevor
// das BFF den Header mitschickt; scharf geschaltet wird durch Setzen der Config Var.
function createRequireInternalKey(expectedKey) {
  if (!expectedKey) {
    return function internalKeyDisabled(req, res, next) {
      next();
    };
  }

  const expectedHash = sha256(expectedKey);
  return function requireInternalKey(req, res, next) {
    const given = req.get("X-Internal-Key") || "";
    if (!crypto.timingSafeEqual(sha256(given), expectedHash)) {
      // 403 statt 401: Die SPA springt bei 401 zur Anmeldung, das wäre hier irreführend.
      return next(new AppError(403, "Access is only allowed via the BFF."));
    }
    next();
  };
}

module.exports = { createRequireInternalKey };
