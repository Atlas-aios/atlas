# Foundation Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the Atlas implementation monorepo foundation so future checklist items can be built, tested, and reviewed consistently.

**Architecture:** The first slice creates a pnpm + TypeScript workspace with strict package boundaries, a small shared runtime surface, and CI gates. Pillar packages begin as typed contracts only; implementation logic will be added behind those contracts as each checklist section starts.

**Tech Stack:** pnpm workspaces, TypeScript, Vitest, ESLint flat config, Prettier, GitHub Actions.

---

## File Structure

- `package.json`: Root scripts and dev tooling.
- `pnpm-workspace.yaml`: Workspace package membership.
- `tsconfig.base.json`: Shared strict TypeScript settings.
- `tsconfig.packages.json`: Build graph for package references.
- `.github/workflows/ci.yml`: Pull request and main branch verification.
- `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `eslint.config.mjs`: Formatting and linting rules.
- `.env.example`: Runtime configuration and secrets naming baseline.
- `CONTRIBUTING.md`: Branch, commit, and review conventions.
- `docs/implementation/foundation.md`: Stack, logging, config, and repo convention notes.
- `packages/core`: Core primitives used across Atlas packages.
- `packages/shared`: Shared config and logging helpers.
- `packages/*`: Typed pillar package contracts for later implementation.

## Tasks

### Task 1: Foundation Tooling

- [x] Add pnpm workspace, root scripts, TypeScript configs, lint, format, and CI files.
- [x] Add repository contribution, environment, and implementation convention docs.

### Task 2: Red Tests

- [x] Add Vitest tests for `@atlas-aios/core` result helpers.
- [x] Add Vitest tests for `@atlas-aios/shared` runtime config and logger helpers.
- [x] Run tests and confirm they fail because the helpers are not implemented.

### Task 3: Green Implementation

- [x] Implement the core result helpers and shared runtime helpers.
- [x] Add typed exports for the first Atlas pillar packages.
- [x] Run tests, type-check, lint, format check, and build.

### Task 4: Checklist And Commit

- [x] Update `IMPLEMENTATION_CHECKLIST.md` for completed foundation items.
- [ ] Commit and push `codex/foundation-workspace`.

## Self-Review

- Spec coverage: Covers the foundation checklist items only; no pillar runtime behavior is included in this slice.
- Placeholder scan: The plan contains no open-ended implementation placeholders.
- Type consistency: Runtime helper names in the tests match the planned exports in `packages/core` and `packages/shared`.
