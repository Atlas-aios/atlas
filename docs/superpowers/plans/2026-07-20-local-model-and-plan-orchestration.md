# Local Model And Plan Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real local OpenAI-compatible planning and a governed Runtime path from stored AtlasPlan through resolution, decision, simulation, approval, and AtlasFlow execution.

**Architecture:** Brain owns the generic local model adapter. Decision Engine recognizes simulation and approval evidence. A focused Runtime module compiles and coordinates plan runs while existing Kernel, Driver, Gate, and Execution Engine contracts retain ownership of their behavior.

**Tech Stack:** TypeScript, Fetch API, Vitest, pnpm workspace, existing Atlas packages

---

### Task 1: Local OpenAI-Compatible Brain Provider

**Files:**

- Modify: `packages/brain/src/model-runtime.ts`
- Modify: `packages/brain/src/model-runtime.test.ts`
- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/src/server.test.ts`

- [ ] Write a failing Brain test asserting OpenAI-compatible URL, authorization, model, messages, token limit, and response extraction.
- [ ] Run `corepack pnpm test packages/brain/src/model-runtime.test.ts` and confirm the provider API is missing.
- [ ] Implement `createOpenAiCompatiblePlanningProvider` with injected fetch, strict HTTP status handling, and assistant-content validation.
- [ ] Re-run the Brain test and confirm it passes.
- [ ] Write a failing server test for `ATLAS_LOCAL_MODEL_ID`, base URL default/override, and optional API key wiring.
- [ ] Implement environment wiring for profile `qwen-local-default`.
- [ ] Run `corepack pnpm test apps/runtime/src/server.test.ts`.

### Task 2: Decision Evidence Reconsideration

**Files:**

- Modify: `packages/decision-engine/src/index.ts`
- Modify: `packages/decision-engine/src/index.test.ts`

- [ ] Write failing tests for simulate-first without evidence, human approval after simulation, and constrained approval after simulation plus approval evidence.
- [ ] Run `corepack pnpm test packages/decision-engine/src/index.test.ts` and confirm the new evidence behavior is absent.
- [ ] Add `simulationRequired`, `simulationEvidenceRefs`, and `approvalEvidenceRefs` to `DecisionRequest`.
- [ ] Implement deterministic reconsideration without changing rejection, irreversible, communication, or low-risk behavior.
- [ ] Re-run Decision Engine tests.

### Task 3: Runtime Plan Orchestrator Contract

**Files:**

- Create: `apps/runtime/src/plan-orchestrator.ts`
- Create: `apps/runtime/src/plan-orchestrator.test.ts`
- Modify: `apps/runtime/package.json`
- Modify: `apps/runtime/tsconfig.json`

- [ ] Write a failing unit test that resolves two low-risk steps, records approved decisions/gates, compiles ordered AtlasFlow nodes/edges, and executes once.
- [ ] Run `corepack pnpm test apps/runtime/src/plan-orchestrator.test.ts` and confirm the module is missing.
- [ ] Implement focused plan-run types, request validation, orchestration dependencies, resolution, decision requests, gate evaluation, AtlasFlow compilation, and execution.
- [ ] Re-run the focused test.
- [ ] Write failing tests for simulation waiting, rejection, approval resume, and idempotent run ids.
- [ ] Implement only those state transitions and re-run the focused tests.

### Task 4: Runtime APIs And Persistence

**Files:**

- Modify: `apps/runtime/src/index.ts`
- Modify: `apps/runtime/src/index.test.ts`

- [ ] Write failing API tests for `POST /brain/plans/:planId/run`, `POST /brain/plan-runs/:runId/resume`, and `GET /brain/plan-runs/:runId`.
- [ ] Run `corepack pnpm test apps/runtime/src/index.test.ts` and confirm `404` responses.
- [ ] Wire Runtime stores and existing provider/simulation/execution adapters into the orchestrator.
- [ ] Persist plan runs in `RuntimeStateSnapshot` with backward-compatible restore defaults.
- [ ] Record run decisions, simulation, approvals, and execution outcome in Runtime audit/Memory state.
- [ ] Re-run Runtime API tests.

### Task 5: Documentation And Verification

**Files:**

- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/architecture/model-routing.md`
- Modify: `docs/architecture/decision-engine.md`
- Modify: `docs/architecture/execution-gate.md`
- Modify: `IMPLEMENTATION_CHECKLIST.md`

- [ ] Document local endpoint configuration and the governed run/resume flow.
- [ ] Mark only the completed local-provider and orchestration items.
- [ ] Keep production World State simulation, local model installation, and autonomous execution-loop items open.
- [ ] Run `corepack pnpm check`.
- [ ] Run `git diff --check` and scan staged content for credentials.
- [ ] Commit and push the verified slice to `main`.

## Self-review

- Coverage includes real local HTTP inference, explicit policy declarations, Decision Engine reconsideration, Kernel resolution, dry-run simulation, approvals, ordered AtlasFlow execution, persistence, and tests.
- No provider, model response, simulation result, approval, or execution is fabricated.
- Production-grade World State cloning is explicitly outside this slice and remains open.
- Runtime integration is deliberately isolated in one module so it can move to a service later without changing pillar contracts.
