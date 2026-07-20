# Governed Cognitive Loop Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue a simulated, approved Cognitive Loop dispatch through the existing governed AtlasFlow execution path exactly once.

**Architecture:** Cognitive Loop records immutable execution outcomes without provider dependencies. Runtime validates cycle-to-plan evidence, reuses plan-run resume orchestration, persists the continued cycle, and records Memory and Audit evidence.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, Atlas Runtime, Decision Engine, Execution Gate, AtlasFlow, Memory, Audit.

---

### Task 1: Cognitive Loop Execution Continuation

**Files:**

- Modify: `packages/cognitive-loop/src/index.test.ts`
- Modify: `packages/cognitive-loop/src/index.ts`

- [x] Write failing tests for completed execution, failed execution, source isolation, non-dispatch rejection, and duplicate completion rejection.
- [x] Run `corepack pnpm test packages/cognitive-loop/src/index.test.ts` and confirm the continuation API is missing.
- [x] Implement typed action records, review outcomes, execution phase updates, and defensive cloning.
- [x] Re-run the focused tests and require all Cognitive Loop tests to pass.

### Task 2: Runtime Governed Execution API

**Files:**

- Modify: `apps/runtime/src/index.test.ts`
- Modify: `apps/runtime/src/index.ts`

- [x] Replace the direct plan-run resume in the orchestration test with a cycle creation and cycle execution request.
- [x] Add failing assertions for exact evidence matching, idempotent replay, and no duplicate execution.
- [x] Run `corepack pnpm test apps/runtime/src/index.test.ts` and confirm the cycle execute route returns not found.
- [x] Implement route validation, exact binding checks, plan-run resume reuse, cycle continuation persistence, and conflict responses.
- [x] Record dedicated execution Memory and Audit evidence.
- [x] Re-run Runtime tests and require the full file to pass.

### Task 3: Documentation And Verification

**Files:**

- Modify: `IMPLEMENTATION_CHECKLIST.md`
- Modify: `docs/architecture/service-boundaries.md`
- Modify: `docs/architecture/execution-gate.md`

- [x] Mark only the implemented Cognitive Loop execute phase complete.
- [x] Document exact evidence binding, idempotency, and continued use of the existing execution gate.
- [x] Run `corepack pnpm format`.
- [x] Run `corepack pnpm check` and require formatting, lint, typecheck, all tests, and build to pass.
- [x] Commit and push the verified slice to `main`.
