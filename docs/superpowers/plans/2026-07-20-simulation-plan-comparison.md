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

- [ ] Write failing tests for weighted ranking, blocked-candidate exclusion, deterministic ties, invalid policy, duplicate candidates, and source-snapshot mismatch.
- [ ] Run `corepack pnpm test packages/simulation-engine/src/index.test.ts` and confirm the comparison API is missing.
- [ ] Implement candidate validation, explicit-limit component scoring, ranking, selection, rejection reasons, and defensive copies.
- [ ] Re-run the focused Simulation Engine suite and require all tests to pass.

### Task 2: Runtime Comparison API

**Files:**

- Modify: `apps/runtime/src/index.test.ts`
- Modify: `apps/runtime/src/index.ts`

- [ ] Write failing API tests that create two real simulations, compare them, persist the result, reject duplicate ids, and record Memory/Audit evidence.
- [ ] Run `corepack pnpm test apps/runtime/src/index.test.ts` and confirm the comparison route is missing.
- [ ] Add request validation, simulation lookup, immutable comparison storage, backward-compatible snapshot restore, list API, Memory, and Audit records.
- [ ] Re-run Runtime tests and require the full file to pass.

### Task 3: Documentation And Verification

**Files:**

- Modify: `IMPLEMENTATION_CHECKLIST.md`
- Modify: `docs/architecture/service-boundaries.md`
- Modify: `docs/architecture/model-routing.md`

- [ ] Mark only deterministic simulation plan comparison complete.
- [ ] Document scoring transparency and the execution-authority boundary.
- [ ] Run `corepack pnpm format`.
- [ ] Run `corepack pnpm check` and require formatting, lint, typecheck, all tests, and build to pass.
- [ ] Commit and push the verified slice to `main`.
