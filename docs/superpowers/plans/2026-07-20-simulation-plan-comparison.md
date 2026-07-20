# Simulation Plan Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rank multiple persisted World State simulations using explicit cost, latency, confidence, and risk policy without granting execution authority.

**Architecture:** Simulation Engine validates and scores immutable candidate inputs. Runtime resolves simulation references, persists comparison records, rejects duplicate ids, and emits Memory and Audit evidence.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, Simulation Engine, Atlas Runtime, Memory, Audit.

---

### Task 1: Pure Comparison Contract

**Files:**

- Modify: `packages/simulation-engine/src/index.test.ts`
- Modify: `packages/simulation-engine/src/index.ts`

- [x] Write failing tests for weighted ranking, blocked-candidate exclusion, deterministic ties, invalid policy, duplicate candidates, and source-snapshot mismatch.
- [x] Run `corepack pnpm test packages/simulation-engine/src/index.test.ts` and confirm the comparison API is missing.
- [x] Implement candidate validation, explicit-limit component scoring, ranking, selection, rejection reasons, and defensive copies.
- [x] Re-run the focused Simulation Engine suite and require all tests to pass.

### Task 2: Runtime Comparison API

**Files:**

- Modify: `apps/runtime/src/index.test.ts`
- Modify: `apps/runtime/src/index.ts`

- [x] Write failing API tests that create two real simulations, compare them, persist the result, reject duplicate ids, and record Memory/Audit evidence.
- [x] Run `corepack pnpm test apps/runtime/src/index.test.ts` and confirm the comparison route is missing.
- [x] Add request validation, simulation lookup, immutable comparison storage, backward-compatible snapshot restore, list API, Memory, and Audit records.
- [x] Re-run Runtime tests and require the full file to pass.

### Task 3: Documentation And Verification

**Files:**

- Modify: `IMPLEMENTATION_CHECKLIST.md`
- Modify: `docs/architecture/service-boundaries.md`
- Modify: `docs/architecture/model-routing.md`

- [x] Mark only deterministic simulation plan comparison complete.
- [x] Document scoring transparency and the execution-authority boundary.
- [x] Run `corepack pnpm format`.
- [x] Run `corepack pnpm check` and require formatting, lint, typecheck, all tests, and build to pass.
- [x] Commit and push the verified slice to `main`.
