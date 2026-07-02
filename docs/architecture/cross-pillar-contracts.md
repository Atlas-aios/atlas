# Cross-Pillar Contracts

Cross-pillar communication in Atlas uses explicit contracts. The first contract layer is implemented in `@atlas-aios/core`.

## Event Envelope

Every cross-pillar event uses this envelope:

```ts
interface AtlasEventEnvelope<TPayload> {
  id: string;
  type: string;
  schemaVersion: "1.0";
  sourcePillar: PillarId;
  occurredAt: string;
  correlationId: string;
  payload: TPayload;
}
```

## Event Naming

Event names use dot-separated domain language:

- `goal.created`
- `goal.blocked`
- `capability.resolved`
- `capability.resolution.blocked`
- `swm.entity.updated`
- `memory.event.recorded`
- `experience.artifact.created`
- `governance.decision.created`
- `cognitive-loop.cycle.completed`

## ACB Topic Naming

Atlas Cognitive Bus topics use deterministic dot-separated names:

```text
acb.<scope>.<event-type>
```

Object lifecycle events include the ACR object type as the scope:

- `acb.goal.object.created`
- `acb.goal.object.validated`
- `acb.execution.object.completed`

Relationship, evidence, and policy events use the event domain directly:

- `acb.relationship.added`
- `acb.relationship.removed`
- `acb.evidence.attached`
- `acb.evidence.detached`
- `acb.policy.attached`

Topic names are derived from committed ACT events by `@atlas-aios/core`. ACB subscribers should route by topic, then fetch full payloads through object references such as `dataRef`, `actId`, and `objectId`.

## Persistence Ownership

Atlas uses ownership boundaries rather than shared mutable tables.

| Store        | Use                                                                           |
| ------------ | ----------------------------------------------------------------------------- |
| PostgreSQL   | relational state, lifecycle records, policies, graph metadata                 |
| Vector store | semantic retrieval, memory retrieval, experience retrieval, capability search |
| Object store | large artifacts, traces, uploaded documents, generated outputs                |
| Event log    | cross-pillar facts, replay, audit reconstruction                              |

Rules:

- A pillar writes only to storage areas it owns.
- Other pillars read through APIs, events, or read models.
- Shared IDs are references, not permission to mutate another pillar's records.
- Governance events are durable audit inputs and cannot be silently rewritten.

## Observability Contract

Every pillar must report:

- health status
- latency for key operations
- error count and error category
- event emission count
- governance decision count where applicable
- correlation identifiers for goal, execution, and event flows

Pillar-specific signals:

| Pillar                | Signals                                                          |
| --------------------- | ---------------------------------------------------------------- |
| Brain Engines         | planning latency, plan acceptance rate, clarification rate       |
| Capability Kernel     | resolution latency, fallback rate, provider confidence           |
| AGOE                  | goal age, blocked goal count, completion rate                    |
| SWM                   | entity confidence, relationship confidence, ontology drift       |
| World State           | state freshness, active workload, incident count                 |
| Memory                | recording latency, retrieval quality, source coverage            |
| Experience Engine     | artifact confidence, reuse count, staleness                      |
| Capability Graph      | graph coverage, graph confidence, unresolved capability requests |
| Identity Engine       | identity confidence, unsafe assumption blocks, merge reversals   |
| Self Model            | confidence calibration, known failure modes, authority drift     |
| Learning & Governance | approval latency, policy denials, unsafe proposal rate           |
| Cognitive Loop        | cycle duration, attention allocation, idle recovery              |

## Governance Impact

Cross-pillar contracts are governance-relevant because they define how authority moves through Atlas. Any future change that adds a new event type, storage owner, or approval bypass must include a governance review.
