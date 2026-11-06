# cinerate-backend

Kern-Backend von CineRate. Reine REST-API für Nutzerverwaltung, Filme und
Bewertungen gegen die PostgreSQL-Datenbank. Teil der Fallstudie Software
Engineering, WS 2026/27.

## Architektur

Dieses Backend ist die einzige Komponente mit Datenbankzugriff. Es ruft bei
Bedarf die **TMDB-API** auf (`integrations/tmdbClient.js`), speichert die geholten
Filme in der Datenbank und antwortet. Das BFF ([cinerate-bff](../cinerate-bff)) reicht
Anfragen nur durch. Nur das BFF darf dieses Backend aufrufen, nicht die SPA direkt
(siehe [Zugriff nur über das BFF](#zugriff-nur-über-das-bff)).

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
| POST | `/api/auth` | nein | 200 `{ token, userId, rolle }` | 400 Daten fehlen, 401 E-Mail oder Passwort falsch, 503 |
| DELETE | `/api/auth` | ja | 200 `{ message }` | 401 Token ungültig oder abgelaufen |
| DELETE | `/api/users/{userId}` | ja | 200 `{ message }` | 401 Token ungültig, 403 fremder Account |

Request-Body von `POST /api/users`: `firstName`, `lastName`, `email`, `password`
(mindestens 8 Zeichen). Request-Body von `POST /api/auth`: `email`, `password`.

## Authentifizierung

- Passwörter werden mit bcrypt gehasht (`lib/password.js`), nie im Klartext gespeichert.
- Beim Login entsteht ein zufälliges Token (64 Hex-Zeichen). In der Tabelle
  `Sitzung` steht nur dessen SHA-256-Hash (`lib/tokens.js`).
- Ein Token gilt 24 Stunden. Die Prüfung übernimmt `middleware/requireAuth.js`.
- Bei jeder erfolgreichen Anmeldung werden abgelaufene Sitzungen aus der Tabelle
  `Sitzung` gelöscht. <!-- KI-Log A46 -->
- Beim Löschen eines Accounts werden alle zugehörigen Daten mitgelöscht
  (`ON DELETE CASCADE` im Schema).

<!-- KI-Log A42, A43 -->
## Fehlerantworten

Jede Fehlerantwort ist JSON im Format `{ "message": "…" }`, nie eine HTML-Seite.
Das gilt auch für Fehler, die vor den Routen entstehen:

| Fall | Status | `message` |
|---|---|---|
| Request-Body ist kein gültiges JSON | 400 | `Request body is not valid JSON.` |
| Request-Body größer als 100 KB | 413 | Meldung von `express.json()` |
| Unbekannte Route oder Methode | 404 | `Route not found.` |
| Datenbank nicht erreichbar | 503 | `Database is not reachable.` |
| Unerwarteter Fehler (z. B. Programmierfehler) | 500 | `Internal server error.` |

Ob ein unerwarteter Fehler 503 oder 500 wird, entscheidet `isDatabaseUnavailable`
anhand des Fehlercodes (Netzwerkfehler und Postgres-Verbindungsfehler ergeben 503).
Die Details landen nur im Log (`console.error`), nie in der Antwort.

Zuständig sind `notFoundMiddleware` und `errorMiddleware` in `lib/appError.js`,
eingebunden am Ende von `app.js`. `server.js` startet nur die App.

<!-- KI-Log A41 -->
## Moderator anlegen

Neue Nutzer bekommen die Rolle `Nutzer`. Es gibt keine Route, um Rollen zu ändern. Für die Demo wird ein Moderator per SQL gesetzt. Ein Moderator darf fremde Kommentare löschen, aber nicht bearbeiten. Die Rolle wird bei jeder Anfrage aus der Datenbank gelesen, ein neuer Login ist nach der Änderung nicht nötig. `POST /api/auth` liefert sie zusätzlich als `rolle` zurück, damit die SPA den Löschen-Knopf anzeigen kann.

Mit `psql`:

```
heroku pg:psql -a cinerate-backend -c "UPDATE Nutzer SET rolle = 'Moderator' WHERE email = 'moderator@cinerate.test'"
```

Ohne `psql` (PowerShell, im Ordner `cinerate-backend`):

```
$env:DATABASE_URL = (heroku config:get DATABASE_URL -a cinerate-backend)
node -e "require('./db/connection').query('UPDATE Nutzer SET rolle=`$1 WHERE email=`$2',[process.argv[1],process.argv[2]]).then(r=>{console.log(r.rowCount);process.exit()})" Moderator moderator@cinerate.test
```

Erwartet wird `UPDATE 1` bzw. `1`. Die `DATABASE_URL` enthält das Passwort der Datenbank und darf nicht weitergegeben werden.  

<!-- KI-Log A45 -->
## Zugriff nur über das BFF

BFF und Backend teilen sich einen geheimen Schlüssel in der Config Var
`INTERNAL_API_KEY`. Das BFF schickt ihn bei jeder Anfrage im Header
`X-Internal-Key` mit (`middleware/requireInternalKey.js`).

| Fall | Antwort |
|---|---|
| Header fehlt oder ist falsch | 403 `Access is only allowed via the BFF.` |
| `GET /api/status` | immer erreichbar, ohne Schlüssel |
| `INTERNAL_API_KEY` nicht gesetzt (lokal) | keine Prüfung, Warnung beim Start |

CORS gibt es im Backend nicht mehr: CORS gilt nur für Browser und hätte das BFF,
das von Server zu Server aufruft, ohnehin nicht eingeschränkt.

Schlüssel erzeugen und auf **beiden** Apps denselben Wert setzen. Reihenfolge:
erst das BFF deployen, das den Header mitschickt, dann den Schlüssel auf dem Backend
setzen; sonst lehnt das Backend das BFF ab.

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
heroku config:set INTERNAL_API_KEY=<Schlüssel> -a cinerate-bff
heroku config:set INTERNAL_API_KEY=<Schlüssel> -a cinerate-backend
```

Für Tests mit Postman oder curl gegen Heroku den Header `X-Internal-Key` mitschicken.
Der Schlüssel gehört weder in Git noch in Chats.

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
heroku config:set TMDB_API_KEY=...   # INTERNAL_API_KEY: siehe "Zugriff nur über das BFF"
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
