// Einfacher Zwischenspeicher im Arbeitsspeicher mit Ablaufzeit (TTL).
// Kennt keine Fachlogik und kein TMDB, die Uhr lässt sich in Tests austauschen.
function createTtlCache({ ttlMs = 10 * 60 * 1000, maxEntries = 500, now = () => Date.now() } = {}) {
  const entries = new Map(); // key -> { value, expiresAt }
  const pending = new Map(); // key -> Promise, für gleichzeitige Anfragen
  let hits = 0;
  let misses = 0;

  function store(key, value, ttl) {
    // Ist der Speicher voll, fliegt der älteste Eintrag raus (Map merkt sich die Reihenfolge)
    if (!entries.has(key) && entries.size >= maxEntries) {
      entries.delete(entries.keys().next().value);
    }
    entries.set(key, { value, expiresAt: now() + ttl });
  }

  // Liefert den gespeicherten Wert oder ruft loader() auf und speichert dessen Ergebnis.
  function getOrLoad(key, loader, ttl = ttlMs) {
    const entry = entries.get(key);
    if (entry && entry.expiresAt > now()) {
      hits++;
      return Promise.resolve(entry.value);
    }

    // Läuft für diesen Schlüssel schon ein Aufruf, wartet der zweite darauf
    if (pending.has(key)) {
      hits++;
      return pending.get(key);
    }

    misses++;
    const promise = loader()
      .then((value) => {
        store(key, value, ttl);
        return value;
      })
      .finally(() => pending.delete(key)); // Fehler werden nicht gespeichert
    pending.set(key, promise);
    return promise;
  }

  return {
    getOrLoad,
    stats: () => ({ hits, misses, size: entries.size }),
  };
}

module.exports = { createTtlCache };