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

Seed the synthetic unknown business system:

```sh
corepack pnpm db:seed:local
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

The first seed fixture is:

```text
infra/postgres/seeds/001_unknown_business_system.sql
```

Migration history is stored in `atlas_core.schema_migrations`. The history table is append-only and exists so the future migration runner can reject checksum drift before applying new migrations.

The seed fixture records a committed ACT for a deliberately generic unknown system, a draft `Create Resource` capability, evidence references for REST, OpenAPI, and Browser UI interfaces, and search/projection rows for local development. It does not replace the full MVP unknown-business-system fixture.
