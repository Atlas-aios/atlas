# World State Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build deterministic isolated World State simulations and connect their evidence to governed plan runs and bounded Cognitive Loop records.

**Architecture:** A new Simulation Engine package applies explicit effects to cloned World State snapshots and compares metrics. Runtime composes that engine with Interface Driver preview and persists the combined record; plan orchestration and Cognitive Loop consume only successful evidence.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, project references, existing Atlas Runtime and World State contracts.

---

### Task 1: Simulation Engine Contract

**Files:**

- Create: `packages/simulation-engine/src/index.test.ts`
- Create: `packages/simulation-engine/src/index.ts`
- Create: `packages/simulation-engine/package.json`
- Create: `packages/simulation-engine/tsconfig.json`
- Modify: `tsconfig.packages.json`

- [x] Write failing tests proving source isolation, ordered effects, metric deltas, threshold blocking, and invalid-effect failure.
- [x] Run `corepack pnpm test packages/simulation-engine/src/index.test.ts` and confirm module-resolution failure.
- [x] Implement the minimal typed engine and defensive cloning required by the tests.
- [x] Re-run the focused tests and confirm they pass.

### Task 2: Runtime Simulation Composition

**Files:**

- Modify: `apps/runtime/package.json`
- Modify: `apps/runtime/tsconfig.json`
- Modify: `apps/runtime/src/index.test.ts`
- Modify: `apps/runtime/src/index.ts`

- [x] Write failing API tests for combined Interface Driver and World State simulation, blocked projected state, persistence, and live-state isolation.
- [x] Run the focused Runtime tests and confirm expected failures.
- [x] Add predicted effects to simulation and plan-step requests, store projected results, and return combined evidence.
- [x] Re-run focused Runtime tests and confirm they pass.

### Task 3: Governed Plan And Cognitive Loop Integration

**Files:**

- Modify: `apps/runtime/src/plan-orchestrator.test.ts`
- Modify: `apps/runtime/src/plan-orchestrator.ts`
- Modify: `packages/cognitive-loop/src/index.test.ts`
- Modify: `packages/cognitive-loop/src/index.ts`

- [x] Write failing tests proving plan policy forwards explicit effects and Cognitive Loop does not claim simulation without an artifact.
- [x] Run both focused suites and confirm expected failures.
- [x] Thread effects through the orchestrator and add simulation evidence to bounded cycle observations.
- [x] Re-run both focused suites and confirm they pass.

### Task 4: Documentation And Verification

**Files:**

- Modify: `IMPLEMENTATION_CHECKLIST.md`
- Modify: `docs/architecture/service-boundaries.md`
- Modify: `docs/architecture/model-routing.md`

- [x] Mark only implemented World State simulation and Cognitive Loop simulation items complete.
- [x] Document deterministic effects, isolation, thresholds, and the remaining lack of probabilistic environment models.
- [x] Run `corepack pnpm format`.
- [x] Run `corepack pnpm check` and require all formatting, lint, typecheck, tests, and build stages to pass.
- [x] Commit and push the verified slice to `main`.
