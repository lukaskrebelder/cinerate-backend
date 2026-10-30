// Fachregeln für Kommentare (PB-32 bis PB-35). Kennt weder HTTP noch SQL.
// Schreiben und Lesen importieren den Film bei Bedarf über den movieService (ensureMovie).
// Bearbeiten und Löschen importieren nichts: Ein Kommentar kann nur zu einem Film existieren, der schon in der DB steht.
const { AppError } = require("../lib/appError");

const MAX_COMMENT_LENGTH = 500;
const PAGE_SIZE = 20;
const MAX_ID = 2147483647; // größte Zahl, die die Spalte INTEGER in Postgres speichert
const MODERATOR = "Moderator";

// 1 bis 500 Zeichen nach dem Kürzen von Leerzeichen am Rand; gibt den gekürzten Text zurück
function parseText(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < 1 || text.length > MAX_COMMENT_LENGTH) {
    throw new AppError(400, "Comment must have 1 to 500 characters.");
  }
  return text;
}

function parsePage(value) {
  if (value === undefined) return 1;
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > MAX_ID) {
    throw new AppError(400, "Invalid page.");
  }
  return Number(value);
}

// "c_1042" -> 1042; alles andere ergibt 404 (wie bei einer unbekannten ID)
function parseCommentId(value) {
  const match = /^c_(\d+)$/.exec(String(value));
  const id = match ? Number(match[1]) : 0;
  if (id < 1 || id > MAX_ID) throw new AppError(404, "No comment found for this ID.");
  return id;
}

// Film-ID in der URL: ungültig oder unbekannt ergibt 404, ohne TMDB-Import
function parseMovieId(value) {
  const id = /^\d+$/.test(String(value)) ? Number(value) : 0;
  if (id < 1 || id > MAX_ID) throw new AppError(404, "No comment found for this ID.");
  return id;
}

// movieService: Objekt mit ensureMovie (siehe services/movieService.js)
// commentRepository: siehe db/commentRepository.js
function createCommentService(movieService, commentRepository) {
  // Kommentar gehört zum Film in der URL? Sonst 404. Gibt den Datensatz mit Autor zurück.
  async function loadComment(movieId, commentIdParam) {
    const commentId = parseCommentId(commentIdParam);
    const comment = await commentRepository.findComment({ commentId, tmdbId: parseMovieId(movieId) });
    if (!comment) throw new AppError(404, "No comment found for this ID.");
    return { commentId, authorId: comment.nutzer_id };
  }

  // POST /movies/{movieId}/comments: 201, 400 (Länge), 404 (Film unbekannt). Die Länge wird zuerst geprüft.
  async function addComment({ userId, movieId, text }) {
    const value = parseText(text);
    const film = await movieService.ensureMovie(movieId);
    const id = await commentRepository.createComment({ userId, tmdbId: film.tmdb_id, text: value });
    return { message: "Your comment has been posted.", commentId: "c_" + id };
  }

  // GET /movies/{movieId}/comments?page=: neueste zuerst, 20 pro Seite, ohne Kommentare totalPages = 1
  async function listComments({ movieId, page }) {
    const pageNumber = parsePage(page);
    const film = await movieService.ensureMovie(movieId);
    const [rows, total] = await Promise.all([
      commentRepository.listComments({
        tmdbId: film.tmdb_id,
        limit: PAGE_SIZE,
        offset: (pageNumber - 1) * PAGE_SIZE,
      }),
      commentRepository.countComments(film.tmdb_id),
    ]);
    return {
      page: pageNumber,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      comments: rows.map((row) => ({
        commentId: "c_" + row.id,
        userId: "u_" + row.nutzer_id,
        firstName: row.vorname,
        text: row.text,
        createdAt: row.erstellt_am,
        updatedAt: row.aktualisiert_am ?? null,
      })),
    };
  }

  // PUT /movies/{movieId}/comments/{commentId}: nur der Autor (auch Moderatoren dürfen fremde Texte nicht ändern)
  async function updateComment({ userId, movieId, commentId, text }) {
    const value = parseText(text);
    const comment = await loadComment(movieId, commentId);
    if (comment.authorId !== userId) {
      throw new AppError(403, "You can only edit your own comments.");
    }
    await commentRepository.updateComment({ commentId: comment.commentId, text: value });
    return { message: "Your comment has been updated." };
  }

  // DELETE /movies/{movieId}/comments/{commentId}: der Autor oder ein Moderator
  async function deleteComment({ userId, role, movieId, commentId }) {
    const comment = await loadComment(movieId, commentId);
    if (comment.authorId !== userId && role !== MODERATOR) {
      throw new AppError(403, "You can only delete your own comments.");
    }
    await commentRepository.deleteComment(comment.commentId);
    return { message: "Comment was deleted." };
  }

  return { addComment, listComments, updateComment, deleteComment };
}

module.exports = { createCommentService };