// Status des Backends (zeigt, dass Backend und Datenbank laufen). Kennt weder HTTP noch SQL.
// statusRepository: Objekt mit countMovies (siehe db/statusRepository.js)
function createStatusService(statusRepository) {
  // GET /status
  async function getStatus() {
    return {
      status: "ok",
      nachricht: "CineRate-Backend läuft",
      filmeInDb: await statusRepository.countMovies(),
    };
  }

  return { getStatus };
}

module.exports = { createStatusService };
