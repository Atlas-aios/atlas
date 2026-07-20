# Internal Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable budget reservation and settlement accounting, then bind simulation comparison to real available funds.

**Architecture:** A pure Internal Economy package owns accounting invariants and an append-only ledger. Runtime persists economy state, exposes authenticated APIs, records Memory/Audit evidence, and derives comparison cost ceilings from budget snapshots.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, Atlas Runtime, Simulation Engine, Memory, Audit.

---

### Task 1: Pure Accounting Domain

**Files:**

- Create: `packages/internal-economy/package.json`
- Create: `packages/internal-economy/tsconfig.json`
- Create: `packages/internal-economy/src/index.test.ts`
- Create: `packages/internal-economy/src/index.ts`
- Modify: `tsconfig.packages.json`

- [x] Write failing tests for budget creation, reservation, insufficient funds, settlement, release, terminal-state enforcement, and idempotency.
- [x] Run the focused tests and confirm the package API is missing.
- [x] Implement immutable commands, derived balances, validation, and defensive snapshots.
- [x] Re-run the focused package tests.

### Task 2: Durable Runtime API

**Files:**

- Modify: `apps/runtime/package.json`
- Modify: `apps/runtime/tsconfig.json`
- Modify: `apps/runtime/src/index.test.ts`
- Modify: `apps/runtime/src/index.ts`
- Modify: `pnpm-lock.yaml`

- [x] Write failing Runtime tests for authenticated accounting routes, overspend rejection, Memory/Audit evidence, and restart persistence.
- [x] Add backward-compatible economy snapshot restore and authenticated API routes.
- [x] Record accepted ledger transitions in Memory and Audit.
- [x] Re-run Runtime tests.

### Task 3: Budget-Aware Simulation Comparison

**Files:**

- Modify: `apps/runtime/src/index.test.ts`
- Modify: `apps/runtime/src/index.ts`

- [x] Write a failing test proving comparison cannot exceed available budget.
- [x] Derive the effective comparison maximum from caller policy and available budget.
- [x] Preserve budget id, available amount, and effective maximum as comparison evidence.
- [x] Re-run focused tests.

### Task 4: Documentation And Verification

**Files:**

- Modify: `IMPLEMENTATION_CHECKLIST.md`
- Modify: `docs/architecture/service-boundaries.md`

- [x] Mark only the implemented Internal Economy slice complete.
- [x] Document accounting ownership and remaining execution-reservation gap.
- [x] Run formatting and the full repository check.
- [x] Commit and push the verified slice to `main`.
