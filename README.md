# Atlas

Main implementation monorepo for Atlas AIOS.

Atlas is a governed, capability-first cognitive operating system designed to become the user's digital counterpart.

## Planned Structure

```text
apps/
  runtime/
  web/
  api/
  worker/
  admin/
packages/
  core/
  agoe/
  brain/
  capability-kernel/
  capability-graph/
  decision-engine/
  execution-engine/
  providers-sdk/
  interface-drivers/
  workflow-dsl/
  swm/
  world-state/
  memory/
  experience/
  identity/
  self-model/
  governance/
  learning/
  cognitive-loop/
  observability/
  shared/
services/
  gateway/
  execution-engine/
  knowledge-engine/
  provider-runtime/
  simulation-engine/
docs/
examples/
infra/
```

## MVP Goal

Demonstrate Atlas learning and operating a deliberately generic unknown business system through interfaces rather than app-specific integrations.

Initial universal capability:

```text
Create Resource
```

## Local Runtime

The first runnable API surface is `apps/runtime`.

```powershell
corepack pnpm build
corepack pnpm --filter @atlas-aios/runtime start
```

Run the current end-to-end MVP demo:

```powershell
corepack pnpm build
corepack pnpm demo:mvp
```

The demo creates a goal, runs the unknown-business learning fixture, dispatches the learned `Create Resource` capability through the governed provider path, approves the runtime decision, satisfies the goal criterion, and prints the final goal, approval, dispatch, and timeline state.

Initial endpoints:

- `GET /health`
- `POST /goals`
- `GET /goals`
- `GET /goals/:id`
- `GET /goals/:id/timeline`
- `POST /goals/:id/status`
- `POST /goals/:id/completion-criteria/:criterionId/satisfy`
- `POST /goals/:id/executions`
- `POST /goals/:id/capabilities/:capabilityId/resolve`
- `POST /goals/:id/capabilities/:capabilityId/dispatch`
- `GET /capabilities`
- `GET /capability-graphs`
- `GET /interface-drivers`
- `POST /capabilities/:id/resolve`
- `GET /providers`
- `GET /approval-requests`
- `POST /approval-requests/:id/approve`
- `POST /approval-requests/:id/reject`
- `POST /executions`
- `GET /executions`
- `GET /executions/:id`
- `GET /learning/reports`
- `POST /mvp/unknown-business/learn-and-execute`

## Implementation Tracker

Use [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) as the living checklist for building Atlas AIOS.

## Repository Model

Atlas development uses three core repositories together:

- `atlas` - implementation monorepo for runtime packages, services, tests, benchmarks, and implementation-adjacent docs.
- `atlas-docs` - canonical architecture, ADRs, long-form specs, volume documents, and Notion-ready documentation.
- `atlas-research` - research backlog, paper reviews, model/provider evaluations, experiments, and benchmark findings before they are promoted into implementation.

Flow:

```text
Research finding
-> atlas-research
-> ADR or spec
-> atlas-docs
-> implementation checklist item
-> atlas package/service
-> tests and benchmarks
```

`atlas` can contain short architecture notes that are close to code, but canonical decisions should be promoted into `atlas-docs`.

## Architecture Docs

- [Twelve Pillars](docs/architecture/twelve-pillars.md)
- [Twelve-Pillar Service Boundaries](docs/architecture/service-boundaries.md)
- [Cross-Pillar Contracts](docs/architecture/cross-pillar-contracts.md)
- [Context Builder](docs/architecture/context-builder.md)
- [Decision Engine](docs/architecture/decision-engine.md)
- [Decision Memory Loop](docs/architecture/decision-memory-loop.md)
- [Experience Distillation](docs/architecture/experience-distillation.md)
- [Execution Gate](docs/architecture/execution-gate.md)
- [MVP Roadmap](docs/roadmap/mvp.md)
- [Foundation Implementation Notes](docs/implementation/foundation.md)
- [Local Database](docs/implementation/local-database.md)
- [Model Routing](docs/architecture/model-routing.md)
- [Pillar Implementation And Model Strategy Research](docs/research/pillar-implementation-and-model-strategy.md)
