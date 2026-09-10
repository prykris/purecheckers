# Deployment

Pure Checkers stores all data in PostgreSQL. The application container holds no
state, so redeploys, restarts and rebuilds never touch user data.

## Why not SQLite

Earlier versions kept a SQLite file inside the app directory. On Railway every
deploy starts a fresh container, so that file was lost and `db push` plus the
seed rebuilt an empty database with only bots and shop items. Do not point
`DATABASE_URL` at a `file:` path again.

## Railway setup (one time)

1. In the Railway project, add a **PostgreSQL** database service.
2. On the app service, open **Variables** and set
   `DATABASE_URL` to the reference `${{Postgres.DATABASE_URL}}` (use the name
   of your Postgres service if it differs). Keep `JWT_SECRET`, `SITE_URL`,
   `NODE_ENV=production` and optionally `ADMIN_USERNAME`.
3. Deploy. The `Procfile` runs `npm run start`, which does in order:
   `prisma migrate deploy` (applies pending migrations, never destructive),
   `node prisma/seed.js` (idempotent upserts of bots and shop items), then the
   server.
4. Keep the app at a single replica unless the connection budget of the
   Postgres plan has been checked. The server uses one shared Prisma client
   (`server/db.js`) and therefore one connection pool per replica.

Any data still inside an old SQLite container is not migrated automatically.
Copy `prisma/prod.db` out of the running container before switching if it is
worth keeping.

## Schema changes

Production applies the files in `prisma/migrations/` with `migrate deploy`.
After editing `prisma/schema.prisma`, create a migration locally against a
PostgreSQL database and commit it together with the schema:

```
npm run db:up            # local PostgreSQL via Docker (first time or after db:down)
npm run db:migrate:dev   # prompts for a migration name, writes prisma/migrations/<timestamp>_<name>
```

Tests run `migrate deploy` against `checkers_test`, so a schema change without
a migration fails the test run.

## Local development

```
cp .env.example .env     # DATABASE_URL already points at the compose database
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Tests default to `postgresql://postgres:postgres@localhost:5432/checkers_test`
on the same container and create that database on first run. Set
`TEST_DATABASE_URL` to use another server.

`prisma/migrations-sqlite-archive/` holds the retired SQLite migration history
for reference only. Prisma does not read it.
