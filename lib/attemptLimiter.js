// KI-Log A46
// Zählt Fehlversuche pro Schlüssel (hier: E-Mail) im Arbeitsspeicher.
// Nach maxAttempts Fehlversuchen ist der Schlüssel gesperrt, bis windowMs seit dem ersten
// Fehlversuch vergangen sind. Kennt keine Fachlogik, die Uhr lässt sich in Tests austauschen.
// Einschränkung: Der Zähler lebt im Prozess. Bei mehreren Dynos hätte jeder seinen eigenen,
// nach einem Neustart beginnt er bei 0. Für einen Dyno auf Heroku reicht das.
function createAttemptLimiter({
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
  maxEntries = 10000,
  now = () => Date.now(),
} = {}) {
  const failures = new Map(); // key -> { count, firstAt }

  // Eintrag zum Schlüssel; abgelaufene Einträge werden dabei entfernt
  function current(key) {
    const entry = failures.get(key);
    if (entry && now() - entry.firstAt >= windowMs) {
      failures.delete(key);
      return undefined;
    }
    return entry;
  }

  function isBlocked(key) {
    const entry = current(key);
    return entry !== undefined && entry.count >= maxAttempts;
  }

  function recordFailure(key) {
    const entry = current(key);
    if (entry) {
      entry.count++;
      return;
    }
    // Speicher begrenzen: ist er voll, fliegt der älteste Eintrag raus (Map merkt sich die Reihenfolge)
    if (failures.size >= maxEntries) {
      failures.delete(failures.keys().next().value);
    }
    failures.set(key, { count: 1, firstAt: now() });
  }

  // Nach erfolgreicher Anmeldung beginnt die Zählung von vorn
  function reset(key) {
    failures.delete(key);
  }

  return { isBlocked, recordFailure, reset, size: () => failures.size };
}

module.exports = { createAttemptLimiter };
