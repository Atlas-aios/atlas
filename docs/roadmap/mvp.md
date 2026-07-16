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
- `POST /goals/:id/executions` creates a runtime execution that is bound to the Goal.
- `POST /goals/:id/capabilities/:capabilityId/resolve` resolves a learned capability through the Capability Kernel in Goal scope.
- `POST /goals/:id/capabilities/:capabilityId/dispatch` resolves a learned capability and executes the selected provider in Goal scope.
- `GET /capabilities` lists draft capabilities learned into local runtime memory.
- `POST /capabilities/:id/resolve` asks Capability Kernel to select a provider for a learned capability.
- `GET /providers` lists generated provider candidates learned into local runtime memory.
- `POST /executions` creates a one-node Execution Engine session for a learned provider against the deterministic unknown-business REST fixture.
- `GET /executions` lists in-memory execution history with status, provider, capability, step, and event counts.
- `GET /executions/:id` returns the full stored execution request and run result.
- `POST /mvp/unknown-business/learn-and-execute` learns the synthetic unknown business system from OpenAPI evidence, extracts browser-fixture capabilities, and runs the `Create Resource` benchmark.

This is the first product-shaped orchestration layer. Goal, learned capability, and generated provider storage are currently in-memory runtime state. It is not yet a full goal-owning Atlas loop, persistent API, authenticated service, or dashboard.
