# Execution Cost Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reserve a governed plan's estimated provider cost before AtlasFlow execution and settle provider-reported usage afterward.

**Architecture:** Execution Engine carries typed per-step resource usage without owning budgets. Plan Orchestrator owns the reserve-execute-settle lifecycle through injected accounting dependencies. Runtime binds those dependencies to Internal Economy, provider cost metadata, persistence, Memory, and Audit.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, Execution Engine, Plan Orchestrator, Internal Economy, Atlas Runtime.

---

### Task 1: Typed Execution Usage

**Files:**

- Modify: `packages/execution-engine/src/index.test.ts`
- Modify: `packages/execution-engine/src/index.ts`

- [x] Add a failing test in which a capability handler returns `{ cost, unit, evidenceRef }` and the completed step preserves it.
- [x] Run `corepack pnpm test packages/execution-engine/src/index.test.ts` and confirm usage is absent.
- [x] Add `ExecutionResourceUsage` plus optional `resourceUsage` fields to node and step results, validating finite non-negative cost and non-empty unit/evidence.
- [x] Re-run the focused Execution Engine tests.

### Task 2: Governed Plan Accounting Lifecycle

**Files:**

- Modify: `apps/runtime/src/plan-orchestrator.test.ts`
- Modify: `apps/runtime/src/plan-orchestrator.ts`

- [x] Add failing tests proving no reservation while waiting for approval, reservation immediately before execution, and successful settlement.
- [x] Run `corepack pnpm test apps/runtime/src/plan-orchestrator.test.ts` and confirm accounting hooks and state are absent.
- [x] Extend plan-run input with `budgetId` and `costUnit`, inject reserve/settle/release hooks, and persist accounting state on `PlanRun`.
- [x] Aggregate typed usage deterministically and enforce matching units and authorized reservation limits.
- [x] Re-run Plan Orchestrator tests.

### Task 3: Runtime Internal Economy Binding

**Files:**

- Modify: `apps/runtime/src/index.test.ts`
- Modify: `apps/runtime/src/index.ts`

- [x] Add a failing Runtime test that creates a budget, starts an approval-gated plan without reserving, approves it, resumes it, and observes reservation plus settlement ledger entries.
- [x] Add a failing insufficient-funds test proving execution never starts.
- [x] Add explicit provider `costUnit`, validate plan-run budget/unit compatibility, report fixture-metered usage, and bind orchestrator hooks to Internal Economy.
- [x] Record every accepted ledger transition through existing Memory/Audit evidence and return accounting conflicts as governed API errors.
- [x] Re-run Runtime and end-to-end demo tests.

### Task 4: Documentation And Verification

**Files:**

- Modify: `IMPLEMENTATION_CHECKLIST.md`
- Modify: `docs/architecture/service-boundaries.md`
- Modify: `docs/superpowers/plans/2026-07-20-execution-cost-accounting.md`

- [x] Mark automatic execution reservation and settlement complete while leaving provider invoice reconciliation open.
- [x] Document provider usage evidence and reconciliation-required behavior.
- [x] Run `corepack pnpm format`.
- [x] Run `corepack pnpm check` and require formatting, lint, typecheck, all tests, and build to pass.
- [x] Commit and push the verified slice to `main`.
