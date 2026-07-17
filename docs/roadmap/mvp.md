# MVP Roadmap

## Objective

Build the smallest useful version of Atlas that can learn an unknown business system and execute `Create Resource` under governance.

## Tracks

1. Architecture baseline
2. Capability ontology and graph
3. Interface drivers: REST, OpenAPI, Browser UI, Filesystem, Local Command Execution
4. Capability Provider runtime and SDK
5. Execution Engine and AtlasFlow
6. SWM, Memory, and Experience
7. Decision Engine and governance gates
8. Unknown business system demo

## Current Runnable Surface

The first local runtime surface lives in `apps/runtime`.

- `GET /health` reports the local runtime status.
- `POST /goals` creates an AGOE Goal in local runtime memory.
- `GET /goals` lists locally created Goals.
- `GET /goals/:id` returns a Goal with linked runtime execution summaries.
- `GET /goals/:id/timeline` returns Goal lifecycle events and linked execution events in one view.
- `POST /goals/:id/status` transitions a Goal through the AGOE state machine and records the lifecycle event.
- `POST /goals/:id/completion-criteria/:criterionId/satisfy` marks a Goal completion criterion satisfied with evidence and auto-completes active Goals when all criteria are satisfied.
- `POST /goals/:id/executions` creates a runtime execution that is bound to the Goal.
- `POST /goals/:id/capabilities/:capabilityId/resolve` resolves a learned capability through the Capability Kernel in Goal scope.
- `POST /goals/:id/capabilities/:capabilityId/dispatch` resolves a learned capability and executes the selected provider in Goal scope.
- `GET /capabilities` lists draft capabilities learned into local runtime memory.
- `POST /capabilities/:id/resolve` asks Capability Kernel to select a provider for a learned capability.
- `GET /providers` lists generated provider candidates learned into local runtime memory.
- `GET /approval-requests` lists runtime approval requests created by approval-gated dispatches.
- `POST /approval-requests/:id/approve` and `POST /approval-requests/:id/reject` record governance decisions for runtime approval requests.
- `POST /memory/events` records a raw append-first Memory event with subject ids, source ids, evidence refs, and metadata.
- `GET /memory/events` lists Memory events and filters them by `kind`, `subjectId`, and `sourceId`.
- `POST /experience/artifacts` records a reusable Experience artifact with evidence Memory links and applicability scope.
- `GET /experience/artifacts` lists Experience artifacts and filters them by `type`, `applicability`, and `minimumConfidence`.
- `GET /world-state` returns the current operational snapshot: active Goals, active executions, and approval blockers.
- `POST /executions` creates a one-node Execution Engine session for a learned provider against the deterministic unknown-business REST fixture.
- `GET /executions` lists in-memory execution history with status, provider, capability, step, and event counts.
- `GET /executions/:id` returns the full stored execution request and run result.
- `POST /mvp/unknown-business/learn-and-execute` learns the synthetic unknown business system from OpenAPI evidence, extracts browser-fixture capabilities, and runs the `Create Resource` benchmark.

This is the first product-shaped orchestration layer. Goal, learned capability, generated provider, execution, approval, audit, Memory event, Experience artifact, and World State snapshot storage are currently in-memory runtime state. It is not yet a full goal-owning Atlas loop, persistent API, authenticated service, or dashboard.
