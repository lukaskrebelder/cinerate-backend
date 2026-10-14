// Fachregeln für die Filmsuche (US-5). Kennt weder HTTP noch SQL.
// Die Suche geht direkt zu TMDB (über den gecachten Client), nicht über die Datenbank.
const { AppError } = require("../lib/appError");

const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const MAX_TEXT_LENGTH = 200;
const MAX_PAGE = 500; // TMDB liefert nicht mehr Seiten

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

// tmdbClient: Objekt mit searchMovies, discoverMovies, getGenres (siehe integrations/)
function createMovieService(tmdbClient) {
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

  return { searchMovies };
}

module.exports = { createMovieService };