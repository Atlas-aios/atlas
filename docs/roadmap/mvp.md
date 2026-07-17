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
- `GET /governance/policies` lists explicit governance policies for high-impact action classes.
- `POST /governance/policies` records stricter or custom governance policies, including deny rules.
- `POST /governance/evaluate` evaluates an action against governance policies, detects sensitive impacts, returns approval/deny/allow decisions, and records an audit event.
- `POST /memory/events` records a raw append-first Memory event with subject ids, source ids, evidence refs, and metadata.
- `GET /memory/events` lists Memory events and filters them by `kind`, `subjectId`, and `sourceId`.
- `POST /experience/artifacts` records a reusable Experience artifact with evidence Memory links and applicability scope.
- `GET /experience/artifacts` lists Experience artifacts and filters them by `type`, `applicability`, and `minimumConfidence`.
- `GET /world-state` returns the current operational snapshot: active Goals, active executions, and approval blockers.
- `POST /swm/entities` records Semantic World Model entities with attributes, confidence, observed time, and evidence refs.
- `GET /swm/entities` lists Semantic World Model entities and filters them by `type` and `evidenceRef`.
- `POST /swm/relationships` records typed Semantic World Model relationships between entities.
- `GET /swm/relationships` lists Semantic World Model relationships and filters them by `type`, `entityId`, and `evidenceRef`.
- `POST /identity/entities` records Identity subjects with kind, aliases, confidence, and evidence refs.
- `GET /identity/entities` lists Identity subjects and filters them by `kind`.
- `GET /identity/entities/resolve` resolves Identity subjects by alias or external account.
- `POST /identity/resolutions` records external account mappings for Identity subjects.
- `GET /identity/resolutions` lists external account mappings and filters them by `subjectId` and `externalSystem`.
- `GET /self-model` returns Atlas's current runtime Self Model with available capabilities, provider confidence, interface maturity, subsystem maturity, granted authority, resource limits, limitations, and known failure modes.
- `POST /cognitive-loop/cycles` runs one bounded Cognitive Loop cycle that observes runtime state, references Memory/Experience/Self Model/World State context, records a Memory trace, and recommends the next safe action without executing automatically.
- `GET /cognitive-loop/cycles` lists bounded Cognitive Loop cycles recorded in the runtime.
- `POST /executions` creates a one-node Execution Engine session for a learned provider against the deterministic unknown-business REST fixture.
- `GET /executions` lists in-memory execution history with status, provider, capability, step, and event counts.
- `GET /executions/:id` returns the full stored execution request and run result.
- `POST /mvp/unknown-business/learn-and-execute` learns the synthetic unknown business system from OpenAPI evidence, extracts browser-fixture capabilities, and runs the `Create Resource` benchmark.

This is the first product-shaped orchestration layer. Goal, learned capability, generated provider, execution, approval, governance policy, audit, Memory event, Experience artifact, World State snapshot, Semantic World Model, Identity, Self Model, and bounded Cognitive Loop cycle storage are currently in-memory runtime state. It is not yet a full autonomous Atlas loop, persistent API, authenticated service, or dashboard.
