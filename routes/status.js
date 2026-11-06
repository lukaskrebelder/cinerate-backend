// Status: GET /api/status zeigt, dass Backend und Datenbank erreichbar sind.
// Die Route macht nur HTTP, die Antwort baut der statusService.
// KI-Log A27
const express = require("express");
const router = express.Router();
const { statusService } = require("../services/container");

router.get("/status", async (req, res) => {
  res.json(await statusService.getStatus());
});

module.exports = router;
