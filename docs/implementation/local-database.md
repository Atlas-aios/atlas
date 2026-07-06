# Local Database

Atlas local development uses PostgreSQL through Docker Compose.

## Connection

```text
postgresql://atlas:atlas@localhost:5432/atlas
```

This matches `ATLAS_DATABASE_URL` in `.env.example`.

## Commands

Start the database:

```sh
corepack pnpm db:up
```

Apply the baseline schema:

```sh
corepack pnpm db:migrate:local
```

Open `psql` inside the container:

```sh
corepack pnpm db:psql
```

Stop the database:

```sh
corepack pnpm db:down
```

## Migration Source

SQL migrations live under `infra/postgres` and are mounted into the container as read-only files at `/migrations`.

The first baseline is:

```text
infra/postgres/001_atlas_core.sql
```

Migration history is stored in `atlas_core.schema_migrations`. The history table is append-only and exists so the future migration runner can reject checksum drift before applying new migrations.
