// Beispiel-Route, die zeigt, dass Backend + Datenbank erreichbar sind
const express = require("express");
const router = express.Router();
const pool = require("../db/connection");

router.get("/status", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) AS anzahl FROM Film");
    res.json({
      status: "ok",
      nachricht: "CineRate-Backend läuft",
      filmeInDb: parseInt(result.rows[0].anzahl, 10),
    });
  } catch (err) {
    res.status(500).json({ status: "error", nachricht: err.message });
  }
});

module.exports = router;
