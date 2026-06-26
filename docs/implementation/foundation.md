# Foundation

Atlas starts as a TypeScript monorepo so the platform can share typed contracts across services, packages, providers, interface drivers, and benchmarks.

## Stack

- Package manager: pnpm workspaces.
- Language: TypeScript with strict compiler settings.
- Tests: Vitest.
- Linting: ESLint flat config with TypeScript rules.
- Formatting: Prettier.
- CI: GitHub Actions running format, lint, type-check, test, and build.

## Repository Policy

Atlas starts with public implementation, documentation, RFC, examples, research, workspace, and organization profile repositories. Repositories that contain secrets, private user data, customer data, production credentials, or unpublished security-sensitive implementation details must be private from creation.

## Runtime Configuration

Environment variables use the `ATLAS_` prefix. Values that grant authority or expose infrastructure must stay out of git and belong in the configured secret provider.

Baseline variables are documented in `.env.example`.

## Logging

Shared logging starts with structured JSON-compatible records:

- `level`
- `message`
- `timestamp`
- optional `context`

Subsystems should add correlation identifiers once execution sessions, goals, and workflow runs exist.

## Package Boundaries

- `packages/core` owns primitives that can be used everywhere.
- `packages/shared` owns common runtime helpers that do not belong to a specific pillar.
- Pillar packages define public contracts first; implementation follows only when the matching checklist slice begins.

## Governance Note

The foundation does not grant Atlas execution authority. It only creates the repository mechanics needed to build governed runtime components later.
