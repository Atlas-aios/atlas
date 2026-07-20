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

To enable the real NVIDIA Nemotron planning lane for eligible high-difficulty
public or internal requests:

```powershell
$env:ATLAS_ALLOW_REMOTE_MODELS="true"
$env:ATLAS_ALLOW_FREE_HOSTED_MODEL_ENDPOINTS="true"
$env:NVIDIA_API_KEY="<your NVIDIA API key>"
corepack pnpm build
corepack pnpm --filter @atlas-aios/runtime start
```

Create a goal with `POST /goals`, then call `POST /brain/plan` with its id:

```json
{
  "goalId": "goal:architecture-review",
  "taskClass": "architecture",
  "difficulty": "high",
  "privacyClass": "internal"
}
```

Remote permissions are server-owned; request JSON cannot enable them. Routine and
private requests select the local lane. Configure any local OpenAI-compatible server:

```powershell
$env:ATLAS_LOCAL_MODEL_ID="qwen3:8b"
$env:ATLAS_LOCAL_MODEL_BASE_URL="http://127.0.0.1:11434/v1"
corepack pnpm build
corepack pnpm --filter @atlas-aios/runtime start
```

`ATLAS_LOCAL_MODEL_API_KEY` is optional. If `ATLAS_LOCAL_MODEL_ID` is absent,
the local lane returns `503 model_provider_unavailable` instead of a fabricated
plan.

After generating a plan, start governed execution with
`POST /brain/plans/:planId/run`. Runtime resolves providers, asks Decision Engine,
runs required interface simulations, and either executes one sequential AtlasFlow
or returns a waiting/blocked state. Approve generated requests through the existing
approval API, then call `POST /brain/plan-runs/:runId/resume`.

Run the current end-to-end MVP demo:

```powershell
corepack pnpm build
corepack pnpm demo:mvp
```

The demo creates a goal, runs the unknown-business learning fixture, dispatches the learned `Create Resource` capability through the governed provider path, approves the runtime decision, satisfies the goal criterion, and prints the final goal, approval, dispatch, and timeline state.

Initial endpoints:

- `GET /health`
- `POST /brain/plan`
- `POST /brain/plans/:planId/run`
- `POST /brain/plan-runs/:runId/resume`
- `GET /brain/plan-runs/:runId`
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
- `GET /audit-logs`
- `GET /governance/policies`
- `POST /governance/policies`
- `POST /governance/evaluate`
- `POST /memory/events`
- `GET /memory/events`
- `POST /experience/artifacts`
- `GET /experience/artifacts`
- `GET /world-state`
- `POST /swm/entities`
- `GET /swm/entities`
- `POST /swm/relationships`
- `GET /swm/relationships`
- `POST /identity/entities`
- `GET /identity/entities`
- `GET /identity/entities/resolve`
- `POST /identity/resolutions`
- `GET /identity/resolutions`
- `GET /self-model`
- `POST /cognitive-loop/cycles`
- `GET /cognitive-loop/cycles`
- `POST /executions`
- `GET /executions`
- `GET /executions/:id`
- `GET /learning/reports`
- `POST /learning/promotion-decisions/:stage/approve`
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

## Licensing

Copyright (c) 2026 Moksh Mehndiratta.

Atlas AIOS is dual-licensed:

- Open-source use under the [GNU Affero General Public License v3.0 only](LICENSE).
- Alternative proprietary use under a separate written [commercial license](COMMERCIAL-LICENSE.md).

The AGPL option can be used commercially when its conditions are followed. A commercial agreement is required when an organization wants rights outside the AGPL grant, such as operating a modified proprietary network service without providing the corresponding source under the AGPL.

See [COPYRIGHT.md](COPYRIGHT.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Third-party models, datasets, services, and trademarks remain subject to their own terms.
