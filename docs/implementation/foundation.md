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

## Core Repository Operating Model

The active build uses three core repositories together:

| Repository       | Role                              | What Belongs There                                                                                   | Promotion Rule                                                                   |
| ---------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `atlas`          | Implementation monorepo           | Packages, services, runtime contracts, tests, fixtures, benchmarks, and implementation-adjacent docs | Code changes must be tied to checklist items, tests, and architecture refs.      |
| `atlas-docs`     | Canonical documentation           | ADRs, architecture volumes, source specs, diagrams, Notion-ready pages, and accepted decisions       | Accepted research and architecture decisions are promoted here before broad use. |
| `atlas-research` | Research and evaluation workspace | Paper notes, model studies, experiment logs, benchmark plans, and unresolved architecture questions  | Research becomes an ADR/spec before it changes core implementation behavior.     |

Supporting repositories such as `atlas-rfcs`, `atlas-examples`, and `atlas-workspace` remain useful, but the implementation loop should always make clear which of the three core repositories owns the current artifact.

```text
atlas-research
-> atlas-docs
-> IMPLEMENTATION_CHECKLIST.md
-> atlas implementation
-> tests / benchmarks
-> docs update
```

This prevents research notes from silently becoming architecture and prevents implementation from drifting away from accepted docs.

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
