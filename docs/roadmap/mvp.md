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
- `POST /mvp/unknown-business/learn-and-execute` learns the synthetic unknown business system from OpenAPI evidence, extracts browser-fixture capabilities, and runs the `Create Resource` benchmark.

This is the first product-shaped orchestration layer. Goal storage is currently in-memory runtime state. It is not yet a full goal-owning Atlas loop, persistent API, authenticated service, or dashboard.
