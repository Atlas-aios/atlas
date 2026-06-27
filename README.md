# Atlas

Main implementation monorepo for Atlas AIOS.

Atlas is a governed, capability-first cognitive operating system designed to become the user's digital counterpart.

## Planned Structure

```text
apps/
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

## Implementation Tracker

Use [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) as the living checklist for building Atlas AIOS.

## Architecture Docs

- [Twelve Pillars](docs/architecture/twelve-pillars.md)
- [Twelve-Pillar Service Boundaries](docs/architecture/service-boundaries.md)
- [Cross-Pillar Contracts](docs/architecture/cross-pillar-contracts.md)
- [Context Builder](docs/architecture/context-builder.md)
- [Decision Engine](docs/architecture/decision-engine.md)
- [MVP Roadmap](docs/roadmap/mvp.md)
- [Foundation Implementation Notes](docs/implementation/foundation.md)
- [Pillar Implementation And Model Strategy Research](docs/research/pillar-implementation-and-model-strategy.md)
