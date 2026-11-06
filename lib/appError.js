// Fehler mit HTTP-Status, den der Service wirft und die Route in eine Antwort umwandelt.
// KI-Log A15
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

// KI-Log A43
// Netzwerkfehler von Node, wenn die Datenbank nicht antwortet (falsche Adresse, Server aus, Verbindung weg)
const NETWORK_ERROR_CODES = ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"];

// Erkennt Fehler, bei denen die Datenbank nicht erreichbar ist, im Unterschied zu Programmierfehlern.
// SQLSTATE 08xxx = Verbindungsfehler, 57P01 bis 57P03 = Server fährt herunter oder nimmt
// noch keine Verbindungen an, 53300 = zu viele Verbindungen. pg selbst meldet einen Abbruch
// mitten in der Abfrage ohne Code als "Connection terminated ...".
function isDatabaseUnavailable(err) {
  const code = typeof err?.code === "string" ? err.code : "";
  return (
    NETWORK_ERROR_CODES.includes(code) ||
    code.startsWith("08") ||
    ["57P01", "57P02", "57P03", "53300"].includes(code) ||
    /^Connection terminated/.test(err?.message ?? "")
  );
}

// Wandelt einen Fehler in die HTTP-Antwort um.
// Bekannte Fehler (AppError) behalten ihren Status. Ist die Datenbank nicht erreichbar, gibt es 503,
// alles andere Unerwartete (z. B. ein Programmierfehler) wird 500.
function handleError(err, res) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  if (isDatabaseUnavailable(err)) {
    return res.status(503).json({ message: "Database is not reachable." });
  }
  res.status(500).json({ message: "Internal server error." });
}

// KI-Log A42
// Letzte Middleware der App (siehe app.js). Express 5 reicht hierher alle Fehler weiter:
// aus express.json() (Body ist kein gültiges JSON, Body zu groß) und aus async-Routen.
// Ohne sie antwortet Express mit einer HTML-Seite statt mit JSON.
function errorMiddleware(err, req, res, next) {
  // Ist die Antwort schon unterwegs, kann nur noch Express selbst die Verbindung beenden
  if (res.headersSent) return next(err);

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body is not valid JSON." });
  }
  // Weitere Fehler aus express.json() (z. B. 413 Body zu groß); expose = Meldung darf an den Client
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }
  handleError(err, res);
}

// Keine Route passt: 404 als JSON statt der HTML-Seite "Cannot GET ..."
function notFoundMiddleware(req, res) {
  res.status(404).json({ message: "Route not found." });
}

module.exports = { AppError, handleError, isDatabaseUnavailable, errorMiddleware, notFoundMiddleware };
