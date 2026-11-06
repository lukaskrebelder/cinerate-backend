// Fehler mit HTTP-Status, den der Service wirft und die Route in eine Antwort umwandelt.
// KI-Log A15
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

// Wandelt einen Fehler in die HTTP-Antwort um.
// Bekannte Fehler (AppError) behalten ihren Status, alles Unerwartete wird 503.
function handleError(err, res) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(503).json({ message: "Database is not reachable." });
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

module.exports = { AppError, handleError, errorMiddleware, notFoundMiddleware };
