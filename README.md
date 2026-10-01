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
