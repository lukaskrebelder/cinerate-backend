// Zentraler Client für Anfragen an die TMDB-API.
// Das Backend holt damit Filmdaten, die noch nicht in der Datenbank stehen,
// und speichert sie danach (Caching on Demand).
// KI-Log Nr. 12
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function tmdbRequest(path) {
  const url = `${TMDB_BASE_URL}${path}${path.includes("?") ? "&" : "?"}api_key=${process.env.TMDB_API_KEY}&language=de-DE`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB-Anfrage fehlgeschlagen: ${response.status}`);
  }
  return response.json();
}

async function sucheFilm(titel) {
  return tmdbRequest(`/search/movie?query=${encodeURIComponent(titel)}`);
}

async function empfehlungenFuerFilm(tmdbId) {
  return tmdbRequest(`/movie/${tmdbId}/recommendations`);
}

module.exports = { sucheFilm, empfehlungenFuerFilm };