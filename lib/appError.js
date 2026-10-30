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

module.exports = { AppError, handleError };