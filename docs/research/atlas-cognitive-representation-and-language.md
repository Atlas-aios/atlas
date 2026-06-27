# Atlas Cognitive Representation And Language Research

**Status:** Research note  
**Date:** 2026-06-28  
**Source:** ADR-010 - AtlasFlow & Atlas Language (ATL), Volume X - Atlas Cognitive Representation & Cognitive Bus

## Executive Recommendation

Atlas should not treat its internal language as a human-first programming language.

The stronger architecture is a layered cognitive representation stack:

```text
Natural Language
-> ATL / AtlasDSL
-> AtlasFlow
-> AtlasIR
-> ACR Objects
-> ACB Transport
-> Runtime / Providers / Interface Drivers
```

This stack exists to stop Atlas subsystems from passing long prompts to each other. Natural language should be used at the boundary with humans and external systems. Inside Atlas, subsystems should exchange compact, typed, versioned, graph-native cognitive objects.

## Naming Decision

Use these terms consistently:

| Term      | Meaning                         | Human Edited | Runtime Role                                |
| --------- | ------------------------------- | ------------ | ------------------------------------------- |
| ACR       | Atlas Cognitive Representation  | No           | Canonical object model for cognition        |
| ACB       | Atlas Cognitive Bus             | No           | Transports ACR objects between pillars      |
| ATL       | Atlas Language                  | Sometimes    | Umbrella language family                    |
| AtlasDSL  | Human-readable ATL layer        | Yes          | Developer-facing goal and capability syntax |
| AtlasFlow | Workflow graph layer            | Rarely       | Execution graph for goals and capabilities  |
| AtlasIR   | Compact immutable internal form | No           | Deterministic runtime representation        |

ACR is not separate from ATL. ACR is the canonical object model that ATL compiles into and serializes from.

## What Existing Research Teaches Atlas

### Semantic Graphs

RDF is the closest mature precedent for graph-native semantic representation. RDF models information as subject-predicate-object triples, supports datasets and named graphs, and distinguishes abstract graph meaning from concrete syntax. Atlas should borrow the idea of graph semantics, stable identifiers, named graph snapshots, and syntax-independent meaning, but ACR must go beyond RDF because Atlas needs goals, policies, execution, confidence, lifecycle, authority, and learning as first-class concepts.

PROV-O is the closest precedent for provenance. Atlas should make provenance mandatory on every important ACR object: source object ids, creator subsystem, evidence references, derived-from links, generated-at time, confidence, and governance status.

### Planning Languages

PDDL is the closest mature precedent for intent-to-plan representation. It separates domain definitions from problem instances and models actions through preconditions and effects. Atlas should borrow goals, preconditions, effects, typed objects, and planner validation, but ATL cannot stop at classical planning because Atlas needs partial confidence, permissions, policies, experience, human approval, simulation, and dynamic provider selection.

HTN planning is relevant because Atlas often needs hierarchical decomposition: a high-level goal becomes subgoals, then capability requests, then executable steps. AtlasFlow should support this without forcing every goal into a flat DAG.

### Workflow Languages

BPMN is the closest mature precedent for business-process notation. It is useful for human-readable process modeling, approvals, gateways, and business flow semantics, but AtlasFlow should not copy BPMN directly. AtlasFlow needs capability resolution, provider ranking, governance gates, simulation branches, evidence links, and feedback loops.

Temporal-style durable execution is relevant for long-running workflows: Atlas should persist workflow state, replay deterministically, and treat non-deterministic external activity as recorded events rather than invisible side effects.

### Agent Reasoning

ReAct shows that reasoning and acting can be interleaved, with actions grounding reasoning in external environments. Atlas should preserve this pattern, but Thoughts and Actions should be ACR objects rather than prompt text.

Tree of Thoughts shows the value of exploring multiple reasoning paths with self-evaluation and backtracking. Atlas should represent those paths as Thought, Hypothesis, Decision, Simulation, and Evaluation objects.

Reflexion shows that agents can improve across trials by storing verbal feedback in memory. Atlas should translate that idea into Memory and Experience objects with evidence, scope, confidence, and governance review.

LLMCompiler is especially relevant to ATL because it treats planning as compilation and demonstrates that parallel function calling can improve latency and cost. AtlasFlow and AtlasIR should explicitly represent dependency edges so independent capability calls can run in parallel.

### Tool And Interface Learning

Toolformer and ToolLLM are useful precedents for teaching models when and how to use external tools and APIs. Atlas should not expose raw tools directly to the Brain. Instead, tool/API knowledge should compile into Capability, Provider, InterfaceDriver, Test, and Benchmark ACR objects.

Mind2Web and OSWorld show why Atlas needs compact internal representation for web and desktop control. Raw HTML, screenshots, and UI histories are too large to pass around repeatedly. Interface Drivers should convert observations into ACR Observation, Entity, Action, and State objects, then keep raw evidence by reference.

### Agent Interoperability

MCP and A2A show that the ecosystem is moving toward explicit protocols for tools, context, capability discovery, agent communication, task lifecycle, and artifacts. Atlas should interoperate with these protocols at the boundary, but the internal format should remain ACR because Atlas needs stronger semantics, governance, provenance, learning, and cross-pillar replay.

### Event And Bus Standards

CloudEvents is a useful precedent for event envelopes. ACB should borrow the idea of a small required envelope around every object movement: id, source, type, subject, time, data schema, and extension fields. Atlas should extend this with cognitive fields: goal id, object id, version id, causality id, trace id, authority context, policy context, confidence, and evidence references.

## Core Design

### ACR Object Envelope

Every ACR object should use one base envelope:

```ts
interface CognitiveObject<TPayload> {
  id: string;
  type: CognitiveObjectType;
  schemaVersion: string;
  version: number;
  lifecycle: CognitiveLifecycle;
  createdAt: string;
  createdBy: CognitiveActorRef;
  goalId?: string;
  parentObjectIds: string[];
  evidenceObjectIds: string[];
  relationships: CognitiveRelationship[];
  confidence: number;
  governance: GovernanceRef;
  payload: TPayload;
}
```

The envelope should be stable. Payloads can evolve by object type.

### Primitive Object Types

Start with a finite primitive set:

- Goal
- Thought
- Decision
- Capability
- Provider
- InterfaceDriver
- Workflow
- Execution
- Constraint
- Policy
- Entity
- Relationship
- WorldState
- Memory
- Experience
- Simulation
- Observation
- Risk
- Approval
- Task
- Resource
- Artifact
- Evaluation
- Event
- Action

Avoid adding new primitive types unless the object cannot be represented cleanly as one of these.

### AtlasFlow Minimum Shape

AtlasFlow should represent executable cognitive workflows:

```ts
interface AtlasFlow {
  id: string;
  goalId: string;
  nodes: AtlasFlowNode[];
  edges: AtlasFlowEdge[];
  constraints: ConstraintRef[];
  policies: PolicyRef[];
  successCriteria: SuccessCriterion[];
  rollback?: CompensationPlanRef;
}
```

Initial node kinds:

- CapabilityRequest
- DecisionGate
- ApprovalGate
- Simulation
- ParallelGroup
- Wait
- HumanTask
- ProviderExecution
- Evaluation
- Compensation

### AtlasIR Minimum Shape

AtlasIR should be the compact immutable representation created from AtlasFlow:

```ts
interface AtlasIR {
  irId: string;
  irVersion: string;
  sourceFlowId: string;
  objectRefs: string[];
  instructions: AtlasIRInstruction[];
  dependencyGraph: AtlasIRDependencyEdge[];
  checksum: string;
}
```

AtlasIR should be deterministic: same source objects and compiler version should produce the same IR.

### ACB Event Envelope

ACB should not move raw strings. It should move object references and compact patches:

```ts
interface CognitiveBusMessage {
  id: string;
  type: string;
  source: string;
  subject: string;
  time: string;
  traceId: string;
  causalityId?: string;
  goalId?: string;
  objectId: string;
  objectVersion: number;
  dataSchema: string;
  dataRef?: string;
  dataPatch?: unknown;
  authorityContextId: string;
}
```

Large payloads should be stored in object storage, graph storage, or memory storage and referenced by id.

## Compression Strategy

ACR saves context and latency by replacing repeated natural-language reconstruction with object references.

Example:

```text
"We need to finish authentication before Friday because the API team is blocked."
```

becomes:

```json
{
  "type": "Goal",
  "deadline": "Friday",
  "dependsOn": ["capability:authentication"],
  "blocks": ["team:api"],
  "priority": "critical"
}
```

The important rule: Atlas should not summarize away evidence. It should store compact ACR for runtime use and keep raw source evidence by reference.

## Compiler Pipeline

Recommended pipeline:

```text
Human Input
-> Intent Parse
-> ACR Draft Objects
-> Validation
-> AtlasDSL if human review needed
-> AtlasFlow
-> Policy and Decision Checks
-> AtlasIR
-> Execution
-> Memory
-> Experience
```

The compiler should be a Brain Engine, but validation should be deterministic where possible.

## Governance Rules

ACR and ATL must be governed from day one:

- no execution without object ids
- no high-impact execution without policy context
- no irreversible action without Decision object
- no production mutation without approval or explicit delegated authority
- no learned Experience artifact without evidence links
- no object update by mutation; use new versions
- no raw prompt-passing between core pillars except as boundary evidence

## Storage Recommendation

ACR storage should be event-first as the source of truth, with relational, graph, search, and object-storage projections built from the event log.

```text
Canonical truth: Atlas Cognitive Event Store (ACES)
Atomic write unit: Atlas Cognitive Transaction (ACT)
Operational queries: relational projection
Relationship traversal: graph projection
Semantic retrieval: vector/search projection
Raw evidence: object/blob storage
```

This matches ACR's own invariants: immutable objects, explicit versions, replayable cognition, evidence-backed trust, and explainable decisions.

The runtime should usually pass transaction ids, object references, event ids, version ids, and compact patches rather than full payloads.

## Atlas Cognitive Transaction

Atlas Cognitive Transaction (ACT) is the atomic write boundary for cognition.

An ACT groups multiple related ACR events into one meaningful cognitive commit. It is the cognitive equivalent of a database transaction or a Git commit: the events inside the transaction either commit together or fail together.

Example:

```text
ACT-000142
├── goal.created
├── thought.created
├── decision.created
├── relationship.added
├── execution.started
└── world.updated
```

Only committed ACTs should publish their events onto the Atlas Cognitive Bus.

ACT exists to prevent half-formed cognition. A Goal should not become visible without the Decision, Thought, relationships, and execution context that justify it. ACB subscribers should observe coherent cognitive steps, not partial writes.

### ACT Lifecycle

```text
proposed
-> validated
-> committed
-> published
```

Failure states:

```text
failed
aborted
compensated
```

`committed` and `published` are intentionally separate. Atlas should first durably commit the ACT to ACES, then publish the committed event batch to ACB. This preserves atomic cognition even if bus publication is delayed or retried.

### ACT Minimum Shape

```ts
interface AtlasCognitiveTransaction {
  id: string;
  schemaVersion: string;
  status:
    | "proposed"
    | "validated"
    | "committed"
    | "published"
    | "failed"
    | "aborted"
    | "compensated";
  goalId?: string;
  traceId: string;
  causalityId?: string;
  createdAt: string;
  createdBy: string;
  intent: string;
  reason: string;
  preconditions: string[];
  policyRefs: string[];
  evidenceRefs: ACREvidenceRef[];
  events: ACREvent[];
  validation: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };
  committedAt?: string;
  publishedAt?: string;
}
```

### ACT Scope Rule

An ACT should represent one coherent cognitive step, not an entire project.

Good ACT:

```text
Create initial release goal, thought, decision, and relationships.
```

Too-large ACT:

```text
Plan, approve, execute, evaluate, learn, and update every subsystem.
```

Small cognitive transactions are easier to validate, retry, replay, inspect, and compensate.

## ACR Storage Architecture Decision

The primary storage model should be:

```text
ACR command
-> deterministic validator
-> proposed ACT
-> ACT validation
-> append committed ACT to ACES
-> publish committed ACT events to ACB
-> object version projection
-> relationship projection
-> evidence projection
-> search/vector projection
```

### Why Event-First

Event-first storage is the strongest match for ACR because Atlas must answer:

- What did Atlas know at the time?
- Which evidence produced this object?
- Which decision changed the lifecycle?
- Which object version was active during execution?
- Can this state be replayed deterministically?

Relational-first storage is good for current operational state, but it is not the best canonical record of cognitive evolution. Graph-first storage is good for traversal, but it is not the best canonical record of lifecycle history. Vector-first storage is useful for retrieval, but it must never become a source of truth.

### Projection Responsibilities

Use one logical ACR identity system across all stores:

- `act_transactions`: atomic cognitive commits and validation results
- `acr_events`: append-only source of truth for object and relationship changes, grouped by ACT id
- `acr_objects`: current and historical object-version projection
- `acr_relationships`: graph-edge projection for traversal
- `acr_evidence_refs`: structured evidence references and hashes
- object storage: raw documents, transcripts, screenshots, traces, logs, and other large evidence
- vector/search store: semantic retrieval over approved text projections

All projections must be rebuildable from `acr_events`.

Events must include `actId`. Replay can operate at the event level for machine precision, but human debugging should default to ACT-level replay because an ACT represents a meaningful thinking step.

### Required Event Types

Start with a small event vocabulary:

- `object.created`
- `object.validated`
- `object.activated`
- `object.completed`
- `object.rejected`
- `object.superseded`
- `object.archived`
- `relationship.added`
- `relationship.removed`
- `evidence.attached`
- `policy.attached`

### Required Transaction Rules

Start with a small ACT rule set:

- no ACR event may commit without an `actId`
- no ACB publication may happen before ACT commit
- all events in an ACT must share a trace id
- high-impact ACTs must include policy refs
- execution-starting ACTs must include a goal id
- failed ACTs must not update projections
- aborted ACTs may be retained for audit but must not publish to ACB
- compensated ACTs must create explicit compensation events instead of deleting history

### Immutability Correction

ACR objects should not use `updatedAt` as if objects mutate in place. If a field changes, Atlas creates a new object version and links it to the prior version.

Prefer:

```ts
createdAt: Timestamp;
validFrom?: Timestamp;
validTo?: Timestamp;
supersedes?: ObjectId;
supersededBy?: ObjectId;
```

### Replay Requirement

The first implementation must include replay tests:

```text
committed ACT stream
-> projector
-> object state
-> replay same stream
-> identical object state
```

This is non-negotiable. If ACR cannot replay, it is not a cognitive operating-system substrate.

Replay should support two modes:

- event replay for exact machine state
- ACT replay for human-readable cognitive history

## Implementation Phases

### Phase 1 - Schema

- define `CognitiveObject`
- define primitive object types
- define relationship model
- define object versioning
- define provenance fields

### Phase 2 - Bus

- define `CognitiveBusMessage`
- add topic naming
- add trace ids and causality ids
- add object reference transport

### Phase 2A - Storage

- define ACT schema and lifecycle
- define ACT validation and commit rules
- define ACR event vocabulary
- define append-only event log schema
- define object version projection
- define relationship projection
- define evidence reference projection
- define replay contract and deterministic projector tests

### Phase 2B - Publication

- define ACT publication status
- define ACB publication after commit
- define retry behavior for committed but unpublished ACTs
- define audit views grouped by ACT id

### Phase 3 - AtlasFlow

- define workflow schema
- define node and edge kinds
- define validation
- define compiler output contract

### Phase 4 - AtlasIR

- define instruction model
- define deterministic compiler
- define checksum
- define replay contract

### Phase 5 - Runtime Replacement

- replace prompt-passing between Brain, Kernel, Memory, Experience, Decision Engine, and Execution Engine with ACR references
- keep natural language only at human and external-system boundaries

## Research Risks

- Over-designing ATL before the runtime exists.
- Making ACR too abstract to execute.
- Mixing human-readable DSL with machine IR too early.
- Letting models generate trusted ACR without deterministic validation.
- Losing raw evidence during compression.
- Building one graph that becomes too slow for operational state.

## Practical Next Step

The next implementation slice should be small:

1. Add a core ACR schema package.
2. Define `CognitiveObject`, `CognitiveRelationship`, `CognitiveBusMessage`, `AtlasCognitiveTransaction`, and `ACREvent`.
3. Add tests for immutability, versioning, object references, ACT atomicity, and event replay.
4. Add a deterministic projector from committed ACTs to object versions and relationships.
5. Add an ACB publication guard so only committed ACT events can be published.
6. Update the planning context builder to return ACR-style references instead of only natural-language context blocks.

## References

- W3C RDF 1.1 Concepts and Abstract Syntax: https://www.w3.org/TR/rdf11-concepts/
- W3C PROV-O: https://www.w3.org/TR/prov-o/
- OMG BPMN 2.0.2: https://www.omg.org/spec/BPMN/2.0.2/
- CloudEvents: https://cloudevents.io/
- Event Sourcing: https://martinfowler.com/eaaDev/EventSourcing.html
- PostgreSQL JSON Types: https://www.postgresql.org/docs/current/datatype-json.html
- Model Context Protocol Specification: https://modelcontextprotocol.io/specification/2025-06-18
- Google Agent2Agent announcement: https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/
- LLMCompiler: https://arxiv.org/abs/2312.04511
- ReAct: https://arxiv.org/abs/2210.03629
- Tree of Thoughts: https://arxiv.org/abs/2305.10601
- Reflexion: https://arxiv.org/abs/2303.11366
- Toolformer: https://arxiv.org/abs/2302.04761
- ToolLLM: https://arxiv.org/abs/2307.16789
- Mind2Web: https://arxiv.org/abs/2306.06070
- OSWorld: https://arxiv.org/abs/2404.07972
