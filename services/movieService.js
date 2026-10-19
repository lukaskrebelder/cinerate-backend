// Fachregeln für Filmsuche und Filmdetail (US-5). Kennt weder HTTP noch SQL.
// Die Suche geht direkt zu TMDB (über den gecachten Client), nicht über die Datenbank.
// Die Detailseite liest zuerst aus der Datenbank und holt den Film nur bei TMDB, wenn er dort fehlt.
const { AppError } = require("../lib/appError");

const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const MAX_TEXT_LENGTH = 200;
const MAX_PAGE = 500; // TMDB liefert nicht mehr Seiten
const MAX_TMDB_ID = 2147483647; // größte Zahl, die die Spalte INTEGER in Postgres speichert
const FSK_VALUES = [0, 6, 12, 16, 18];

function invalidFilter() {
  return new AppError(400, "Invalid filter value.");
}

function parsePage(value) {
  if (value === undefined) return 1;
  if (!/^\d+$/.test(String(value))) throw invalidFilter();
  const page = Number(value);
  if (page < 1 || page > MAX_PAGE) throw invalidFilter();
  return page;
}

// Text ohne Leerzeichen am Rand; leer oder fehlend ergibt undefined
function parseText(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > MAX_TEXT_LENGTH) throw invalidFilter();
  const text = value.trim();
  return text === "" ? undefined : text;
}

function toMovieSummary(movie) {
  return {
    movieId: movie.id,
    title: movie.title,
    posterUrl: movie.poster_path ? IMAGE_BASE_URL + movie.poster_path : null,
  };
}

function movieNotFound() {
  return new AppError(404, "No movie found for this ID.");
}

// Die ID kommt als Text aus der URL. Alles außer einer ganzen Zahl von 1 bis MAX_TMDB_ID gibt 404.
function parseMovieId(value) {
  if (!/^\d+$/.test(String(value))) throw movieNotFound();
  const id = Number(value);
  if (id < 1 || id > MAX_TMDB_ID) throw movieNotFound();
  return id;
}

// Altersfreigabe für Deutschland aus den release_dates von TMDB, sonst null (E14).
// Ergebnis ist Text, so wie er in Film.fsk gespeichert wird (z. B. "12").
function extractFsk(tmdbMovie) {
  const de = tmdbMovie.release_dates?.results?.find((r) => r.iso_3166_1 === "DE");
  return de?.release_dates?.map((d) => d.certification).find(Boolean) ?? null;
}

// Text aus der Datenbank wird zur Zahl für die API; unbekannte oder fehlende Werte ergeben null
function toFskNumber(text) {
  const n = Number(text);
  return text && FSK_VALUES.includes(n) ? n : null;
}

// Zeile aus movieRepository.findByTmdbId wird zur Antwort aus der API
function toMovieDetail(row) {
  return {
    movieId: row.tmdb_id,
    title: row.titel,
    description: row.beschreibung || null,
    genres: row.genres,
    fsk: toFskNumber(row.fsk),
    releaseYear: row.erscheinungsjahr ?? null,
    runtime: row.laufzeit ?? null,
    posterUrl: row.poster_pfad ? IMAGE_BASE_URL + row.poster_pfad : null,
    avgRating: row.avg_rating === null ? null : Number(Number(row.avg_rating).toFixed(1)),
  };
}

// tmdbClient: Objekt mit searchMovies, discoverMovies, getGenres, getMovie (siehe integrations/)
// movieRepository: Objekt mit findByTmdbId, saveMovie (siehe db/); nur für getMovie nötig
function createMovieService(tmdbClient, movieRepository) {
  async function findGenreId(name) {
    const { genres } = await tmdbClient.getGenres();
    const found = genres.find((genre) => genre.name.toLowerCase() === name.toLowerCase());
    if (!found) throw invalidFilter();
    return found.id;
  }

  // Suche nach Titel und/oder Genre, mit Seitennummer.
  // Einschränkung: Mit Titel und Genre filtert der Service die Treffer einer TMDB-Seite nach Genre,
  // eine Seite kann dadurch weniger Filme enthalten und totalPages ist eine Obergrenze.
  async function searchMovies({ query, genre, page } = {}) {
    const pageNumber = parsePage(page);
    const text = parseText(query);
    const genreName = parseText(genre);
    const genreId = genreName ? await findGenreId(genreName) : undefined;

    let data;
    if (text) {
      data = await tmdbClient.searchMovies({ query: text, page: pageNumber });
      if (genreId !== undefined) {
        data = {
          ...data,
          results: data.results.filter((movie) => (movie.genre_ids || []).includes(genreId)),
        };
      }
    } else {
      data = await tmdbClient.discoverMovies({ genreId, page: pageNumber });
    }

    return {
      page: data.page,
      totalPages: data.total_pages,
      movies: data.results.map(toMovieSummary),
    };
  }

  // Detailseite (US-5, Kriterium 5.5 und 5.6): erst die Datenbank, sonst TMDB holen und speichern.
  async function getMovie(movieIdParam) {
    const tmdbId = parseMovieId(movieIdParam);
    let row = await movieRepository.findByTmdbId(tmdbId);

    if (!row) {
      const tmdbMovie = await tmdbClient.getMovie(tmdbId);
      await movieRepository.saveMovie({
        tmdbId,
        title: tmdbMovie.title,
        description: tmdbMovie.overview || null,
        year: tmdbMovie.release_date ? Number(tmdbMovie.release_date.slice(0, 4)) : null,
        posterPath: tmdbMovie.poster_path || null,
        runtime: tmdbMovie.runtime || null,
        fsk: extractFsk(tmdbMovie),
        genres: (tmdbMovie.genres || []).map((g) => ({ tmdbGenreId: g.id, name: g.name })),
      });
      row = await movieRepository.findByTmdbId(tmdbId);
    }

    return toMovieDetail(row);
  }

  return { searchMovies, getMovie };
}

module.exports = { createMovieService };