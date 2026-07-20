# Brain Model Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a stored Atlas goal into a model-generated, strictly validated `AtlasPlan` through `POST /brain/plan`.

**Architecture:** Extend `@atlas-aios/brain` with a provider-neutral planning service that uses the existing Core router and NVIDIA NIM client. Runtime injects providers and enforces server-owned remote policy; missing providers and malformed model output fail explicitly.

**Tech Stack:** TypeScript, Fetch API, Vitest, existing pnpm workspace packages

---

### Task 1: Model-backed Brain planning

**Files:**

- Create: `packages/brain/src/model-runtime.ts`
- Create: `packages/brain/src/model-runtime.test.ts`
- Modify: `packages/brain/src/index.ts`

- [ ] **Step 1: Write failing tests for valid plan generation**

Test an injected provider returning strict JSON. Assert the service routes the request, supplies a bounded prompt, and returns an `AtlasPlan` whose id and goal id come from trusted request data.

- [ ] **Step 2: Run the focused test and confirm it fails because the API does not exist**

Run: `corepack pnpm test packages/brain/src/model-runtime.test.ts`

- [ ] **Step 3: Implement the provider-neutral contract and validated parser**

Add `BrainPlanningModelProvider`, `GenerateModelBackedPlanInput`, `ModelBackedPlanResult`, `BrainModelUnavailableError`, `InvalidBrainModelOutputError`, and `generateModelBackedPlan`. Bound context size before invocation and validate all strings, arrays, booleans, and plan steps.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `corepack pnpm test packages/brain/src/model-runtime.test.ts`

- [ ] **Step 5: Add failing tests for missing providers and malformed model output**

Assert the service throws typed errors and never returns a synthetic fallback plan.

- [ ] **Step 6: Implement only the error behavior required by those tests**

- [ ] **Step 7: Re-run the focused tests**

Run: `corepack pnpm test packages/brain/src/model-runtime.test.ts`

### Task 2: Runtime Brain API

**Files:**

- Modify: `apps/runtime/src/index.ts`
- Modify: `apps/runtime/src/index.test.ts`
- Modify: `apps/runtime/package.json`
- Modify: `apps/runtime/tsconfig.json`

- [ ] **Step 1: Write failing endpoint tests**

Cover successful injected planning, unknown goals, selected-provider absence, and malformed output. Assert that client input cannot override server remote policy.

- [ ] **Step 2: Run the focused runtime tests and confirm the new endpoint fails**

Run: `corepack pnpm test apps/runtime/src/index.test.ts`

- [ ] **Step 3: Implement `POST /brain/plan`**

Add runtime model policy and provider options. Load the goal, build a bounded context packet from trusted runtime state, call `generateModelBackedPlan`, and map typed failures to `400`, `404`, `502`, or `503` responses.

- [ ] **Step 4: Run the focused runtime tests**

Run: `corepack pnpm test apps/runtime/src/index.test.ts`

### Task 3: Real NVIDIA NIM wiring

**Files:**

- Modify: `apps/runtime/src/server.ts`
- Modify: `apps/runtime/src/server.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write a failing server-configuration test**

Inject environment-like configuration and a fetcher, then assert that the Nemotron profile is wired only when all server gates and `NVIDIA_API_KEY` are present.

- [ ] **Step 2: Run the focused server test and confirm failure**

Run: `corepack pnpm test apps/runtime/src/server.test.ts`

- [ ] **Step 3: Implement server configuration**

Create the NVIDIA provider using `callNvidiaNimChatCompletion`. Read the key and remote-policy flags only at server startup. Do not log the key.

- [ ] **Step 4: Run server tests**

Run: `corepack pnpm test apps/runtime/src/server.test.ts`

### Task 4: Documentation and checklist

**Files:**

- Modify: `docs/architecture/model-routing.md`
- Modify: `README.md`
- Modify: `IMPLEMENTATION_CHECKLIST.md`

- [ ] **Step 1: Document the endpoint, configuration, and honest local-provider limitation**

- [ ] **Step 2: Mark only implemented Brain/model runtime checklist items complete**

- [ ] **Step 3: Run formatting checks**

Run: `corepack pnpm format:check`

### Task 5: Full verification and publication

- [ ] **Step 1: Run the full repository check**

Run: `corepack pnpm check`

- [ ] **Step 2: Review the diff for secrets, placeholders, and unrelated changes**

Run: `git diff --check` and `git status --short`

- [ ] **Step 3: Commit and push to main**

Commit only this slice and push after every verification succeeds.

## Self-review

- Spec coverage: real provider invocation, deterministic routing, bounded context, strict validation, server-owned policy, typed failures, docs, and tests are covered.
- Placeholder scan: local model serving is explicitly out of scope and represented as unavailable, not as a fake implementation.
- Type consistency: runtime provider maps use the Brain provider contract and Core profile ids throughout.
