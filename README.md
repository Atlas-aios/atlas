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

