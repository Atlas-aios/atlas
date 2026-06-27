# Twelve-Pillar Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the first Atlas twelve-pillar implementation map so future runtime work has clear package, event, persistence, and observability boundaries.

**Architecture:** This slice keeps implementation lightweight: a typed pillar registry and event envelope helper in `@atlas-aios/core`, plus architecture docs that describe service ownership. Runtime services, databases, API endpoints, and queues remain future checklist items.

**Tech Stack:** TypeScript, Vitest, Markdown architecture docs.

---

## File Structure

- `packages/core/src/pillars.ts`: Canonical pillar identifiers, package ownership, persistence ownership, and observability expectations.
- `packages/core/src/events.ts`: Cross-pillar event envelope contract and constructor.
- `packages/core/src/index.test.ts`: Tests for registry uniqueness and event envelope shape.
- `docs/architecture/service-boundaries.md`: Human-readable twelve-pillar service boundary map.
- `docs/architecture/cross-pillar-contracts.md`: Event, persistence, and observability conventions.
- `IMPLEMENTATION_CHECKLIST.md`: Marks only section 1 implementation-map items complete.

## Tasks

### Task 1: Red Tests

- [x] Add tests that expect `PILLAR_BOUNDARIES`, `getPillarBoundary`, and `createAtlasEventEnvelope`.
- [x] Run tests and confirm they fail because the helpers are not implemented.

### Task 2: Core Contracts

- [x] Add the typed pillar boundary registry.
- [x] Add the cross-pillar event envelope helper.
- [x] Export the new contracts from `packages/core/src/index.ts`.
- [x] Run tests and confirm they pass.

### Task 3: Docs And Checklist

- [x] Add service boundary documentation for all twelve pillars.
- [x] Add event, persistence, and observability documentation.
- [x] Update the implementation checklist section 1.
- [x] Run `corepack pnpm check`.
- [x] Commit and push the branch.

## Self-Review

- Spec coverage: Covers the section 1 implementation-map checklist only.
- Placeholder scan: No runtime placeholder is treated as complete.
- Type consistency: Pillar ids used in docs and tests match package names.
