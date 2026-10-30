// Kommentare (PB-32 bis PB-35): /api/movies/{movieId}/comments
// Die Route macht nur HTTP, die Fachregeln stehen im commentService.
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { handleError } = require("../lib/appError");
const { commentService } = require("../services/container");

// Kommentar schreiben: Body { "text": "…" }
router.post("/movies/:movieId/comments", requireAuth, async (req, res) => {
  try {
    const { text } = req.body ?? {};
    const result = await commentService.addComment({
      userId: req.user.id,
      movieId: req.params.movieId,
      text,
    });
    res.status(201).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// Kommentare des Films, neueste zuerst: Query page
router.get("/movies/:movieId/comments", requireAuth, async (req, res) => {
  try {
    const result = await commentService.listComments({
      movieId: req.params.movieId,
      page: req.query.page,
    });
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// Eigenen Kommentar bearbeiten: Body { "text": "…" }
router.put("/movies/:movieId/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const { text } = req.body ?? {};
    const result = await commentService.updateComment({
      userId: req.user.id,
      movieId: req.params.movieId,
      commentId: req.params.commentId,
      text,
    });
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

// Kommentar löschen: Autor oder Moderator (req.user.rolle kommt aus requireAuth)
router.delete("/movies/:movieId/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const result = await commentService.deleteComment({
      userId: req.user.id,
      role: req.user.rolle,
      movieId: req.params.movieId,
      commentId: req.params.commentId,
    });
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;