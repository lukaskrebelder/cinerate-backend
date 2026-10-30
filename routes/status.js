// Status: GET /api/status zeigt, dass Backend und Datenbank erreichbar sind.
// Die Route macht nur HTTP, die Antwort baut der statusService.
// KI-Log A27
const express = require("express");
const router = express.Router();
const { handleError } = require("../lib/appError");
const { statusService } = require("../services/container");

router.get("/status", async (req, res) => {
  try {
    res.json(await statusService.getStatus());
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;
