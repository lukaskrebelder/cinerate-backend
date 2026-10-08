# cinerate-backend

Kern-Backend von CineRate. Reine REST-API für Nutzerverwaltung, Filme und
Bewertungen gegen die PostgreSQL-Datenbank. Teil der Fallstudie Software
Engineering, WS 2026/27.

## Architektur

Dieses Backend kennt **keine TMDB-Anbindung**. Externe Daten werden
ausschließlich vom BFF ([cinerate-bff](../cinerate-bff)) geholt und mit den
Daten dieses Backends kombiniert. Nur das BFF darf dieses Backend aufrufen
(CORS beschränkt auf `BFF_URL`), nicht die SPA direkt.

Das Datenbankschema selbst liegt in einem eigenen Repository:
[cinerate-db](../cinerate-db).

## Setup

```
npm install
cp .env.example .env   # DATABASE_URL eintragen (siehe cinerate-db)
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
heroku config:set BFF_URL=https://cinerate-bff.herokuapp.com
git push heroku main
```

Das Schema wird separat über `cinerate-db` initialisiert (gegen dieselbe
`DATABASE_URL`).

## Tech-Stack

Node.js, Express, PostgreSQL (über `pg`)
