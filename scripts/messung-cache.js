// Messung der Antwortzeit mit und ohne Cache (PB-24, Nachweis für das Portfolio).
// Aufruf im Ordner cinerate-backend: node scripts/messung-cache.js
// Braucht TMDB_API_KEY in der .env. Keine Datenbank, kein Token.
// KI-Log A23
require("dotenv").config();
const { createTmdbClient } = require("../integrations/tmdbClient");
const { createCachedTmdbClient } = require("../integrations/cachedTmdbClient");

const client = createCachedTmdbClient(createTmdbClient());

async function zeit(name, fn) {
  const start = process.hrtime.bigint();
  await fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(`${name}: ${ms.toFixed(1)} ms`);
  return ms;
}

async function main() {
  const suche = () => client.searchMovies({ query: "Interstellar", page: 1 });
  const detail = () => client.getMovie(157336);

  console.log("Suche");
  const s1 = await zeit("  1. Aufruf (ohne Cache, TMDB)", suche);
  const s2 = await zeit("  2. Aufruf (aus dem Cache)  ", suche);
  const s3 = await zeit("  3. Aufruf (aus dem Cache)  ", suche);
  console.log("Filmdetail");
  const d1 = await zeit("  1. Aufruf (ohne Cache, TMDB)", detail);
  const d2 = await zeit("  2. Aufruf (aus dem Cache)  ", detail);
  console.log("Cache-Zähler:", client.stats());
  console.log(`Suche: ohne Cache ${s1.toFixed(1)} ms, mit Cache im Mittel ${((s2 + s3) / 2).toFixed(1)} ms`);
  console.log(`Detail: ohne Cache ${d1.toFixed(1)} ms, mit Cache ${d2.toFixed(1)} ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});