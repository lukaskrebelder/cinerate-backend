# cinerate-backend

Kern-Backend von CineRate. Reine REST-API für Nutzerverwaltung, Filme und
Bewertungen gegen die PostgreSQL-Datenbank. Teil der Fallstudie Software
Engineering, WS 2026/27.

## Architektur

Dieses Backend ist die einzige Komponente mit Datenbankzugriff. Es ruft bei
Bedarf die **TMDB-API** auf (`lib/tmdbClient.js`), speichert die geholten Filme
in der Datenbank und antwortet. Das BFF ([cinerate-bff](../cinerate-bff)) reicht
Anfragen nur durch. Nur das BFF darf dieses Backend aufrufen (CORS beschränkt auf
`BFF_URL`), nicht die SPA direkt.

Das Datenbankschema selbst liegt in einem eigenen Repository:
[cinerate-db](../cinerate-db).

## Setup

```
npm install
cp .env.example .env   # DATABASE_URL und TMDB_API_KEY eintragen
npm start
```

Läuft auf [http://localhost:3000](http://localhost:3000), liefert nur JSON.

## Endpunkte (US-2: Registrieren, Anmelden, Abmelden, Account löschen)

Alle Pfade haben das Präfix `/api`. Geschützte Endpunkte erwarten den Header
`Authorization: Bearer <token>`.

| Methode | Pfad | Geschützt | Erfolg | Fehler |
|---|---|---|---|---|
| POST | `/api/users` | nein | 201 `{ message, userId }` | 400 ungültige Daten, 409 E-Mail existiert schon, 503 DB nicht erreichbar |
| POST | `/api/auth` | nein | 200 `{ token }` | 400 Daten fehlen, 401 E-Mail oder Passwort falsch, 503 |
| DELETE | `/api/auth` | ja | 200 `{ message }` | 401 Token ungültig oder abgelaufen |
| DELETE | `/api/users/{userId}` | ja | 200 `{ message }` | 401 Token ungültig, 403 fremder Account |

Request-Body von `POST /api/users`: `firstName`, `lastName`, `email`, `password`
(mindestens 8 Zeichen). Request-Body von `POST /api/auth`: `email`, `password`.

## Authentifizierung

- Passwörter werden mit bcrypt gehasht (`lib/password.js`), nie im Klartext gespeichert.
- Beim Login entsteht ein zufälliges Token (64 Hex-Zeichen). In der Tabelle
  `Sitzung` steht nur dessen SHA-256-Hash (`lib/tokens.js`).
- Ein Token gilt 24 Stunden. Die Prüfung übernimmt `middleware/requireAuth.js`.
- Beim Löschen eines Accounts werden alle zugehörigen Daten mitgelöscht
  (`ON DELETE CASCADE` im Schema).

## Tests

```
npm test
```

Unit-Tests für die Kernlogik (Validierung, Passwort-Hash, Token) liegen in `test/`.
Testabdeckung messen: `node --test --experimental-test-coverage`
(aktuell 100 % Zeilen, Verzweigungen und Funktionen in `lib/`).

## Deployment auf Heroku

```
heroku create cinerate-backend
heroku addons:create heroku-postgresql:essential-0
heroku config:set BFF_URL=https://cinerate-bff.herokuapp.com TMDB_API_KEY=...
git push heroku main
```

Das Schema wird separat über `cinerate-db` initialisiert (gegen dieselbe
`DATABASE_URL`).

## Messung: TMDB-Cache (PB-24)

Der Cache (`integrations/cachedTmdbClient.js`) hält Antworten von TMDB im Arbeitsspeicher: Suche und Genre-Auswahl 10 Minuten, Filmdetail und Empfehlungen 1 Stunde, Genre-Liste 24 Stunden. Gleiche Anfragen innerhalb dieser Zeit gehen nicht erneut an TMDB.

**Messung:** `node scripts/messung-cache.js` (22.10.2026, lokaler Rechner, Heimnetz, TMDB live, kein Heroku). Pro Lauf wird dieselbe Suche („Interstellar“) dreimal und dasselbe Filmdetail (TMDB-ID 157336) zweimal abgefragt, mit leerem Cache am Anfang. Drei Läufe:

| Aufruf | Lauf 1 | Lauf 2 | Lauf 3 |
| --- | --- | --- | --- |
| Suche, 1. Aufruf (ohne Cache, TMDB) | 432,2 ms | 206,4 ms | 205,1 ms |
| Suche, 2. Aufruf (Cache) | 0,0 ms | 0,0 ms | 0,0 ms |
| Suche, 3. Aufruf (Cache) | 0,0 ms | 0,1 ms | 0,0 ms |
| Filmdetail, 1. Aufruf (ohne Cache, TMDB) | 128,1 ms | 24,8 ms | 29,2 ms |
| Filmdetail, 2. Aufruf (Cache) | 0,0 ms | 0,0 ms | 0,0 ms |
| Cache-Zähler (Treffer / Fehlversuche) | 3 / 2 | 3 / 2 | 3 / 2 |

**Ergebnis:** Aus dem Cache kommt die Antwort ohne messbare Wartezeit (unter 0,1 ms), ein TMDB-Aufruf dauert dagegen etwa 205 bis 430 ms (Suche) und 25 bis 130 ms (Filmdetail). Der erste Aufruf von Lauf 1 ist am langsamsten, weil dort die Verbindung zu TMDB erst aufgebaut wird. Der Zähler passt zum Ablauf: Pro Lauf 2 Fehlversuche (die beiden ersten Aufrufe) und 3 Treffer.

**Grenzen:** Die Messung läuft lokal und nicht auf Heroku. Die Zeiten hängen von Netz und TMDB ab. Der Cache liegt im Speicher einer Instanz und geht beim Neustart verloren (siehe ADR-06).

## Tech-Stack

Node.js, Express, PostgreSQL (über `pg`), TMDB-API
