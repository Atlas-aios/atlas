# Atlas Overview

**Status:** Living project overview  
**Last updated:** 2026-06-28  
**Purpose:** Give humans and AI coding agents one clear entry point into what Atlas is, why it exists, what has been designed, what is implemented, and what comes next.

## One-Line Summary

Atlas AIOS is a governed, capability-first Cognitive Operating System designed to become the user's digital counterpart by understanding goals, owning execution, learning from experience, and acting through any software interface under explicit human-defined authority.

## North Star

Atlas is not meant to be a general chatbot or a simple automation tool.

Atlas is designed to become a professional digital counterpart. It should progressively learn:

- how the user thinks
- how the user builds
- how the user manages work
- how the user communicates
- how the user decides
- what standards, risks, and priorities matter

The long-term target is that the user can say:

```text
You know what needs to be done.
```

Atlas should then understand the relevant projects, priorities, context, constraints, risks, and authority boundaries. It should produce an execution plan, explain the reasoning, ask for approval when required, then own the work through completion.

## Core Philosophy

Atlas does not revolve around apps.

It revolves around capabilities.

```text
Goal
-> Capability
-> Capability Kernel
-> Provider
-> Interface Driver
-> Execution Environment
```

Atlas should not know or care whether a capability is fulfilled by GitHub, SAP, a browser, a CLI, a desktop UI, a robot, a human, another Atlas instance, or a generated workflow. Those are providers and interfaces, not core architecture.

The MVP is therefore not:

```text
Learn one named application.
```

The MVP is:

```text
Learn an unknown software system from its interfaces and execute a universal capability.
```

Initial universal capability:

```text
Create Resource
```

## What Makes Atlas Different

Most agent systems pass prompts between components.

Atlas should not.

Atlas performs natural-language understanding at the boundary, then converts meaning into structured cognition.

```text
Human language
-> Brain Engines
-> Atlas Cognitive Representation
-> Atlas Cognitive Transaction
-> Atlas Cognitive Event Store
-> Atlas Cognitive Bus
-> Pillars, projections, runtime, learning
```

The central idea:

```text
Atlas does not pass text internally.
Atlas passes cognition.
```

This reduces repeated context parsing, token cost, latency, ambiguity, hallucination risk, and debugging difficulty.

## Twelve Pillars

Atlas is organized around twelve foundational pillars:

1. Brain Engines
2. Capability Kernel
3. Autonomous Goal Ownership Engine
4. Semantic World Model
5. World State
6. Memory
7. Experience Engine
8. Capability Graph
9. Identity Engine
10. Self Model
11. Learning & Governance System
12. Cognitive Loop

Each pillar owns a distinct part of the AIOS. Pillars communicate through explicit contracts, events, cognitive objects, and read models rather than shared mutable state.

## Pillar Responsibilities

### Brain Engines

Reason, plan, compile intent, build context, explain plans, ask clarifying questions, and propose decisions. Brain Engines do not directly execute provider calls.

### Capability Kernel

Resolve requested capabilities into viable providers. Rank providers using confidence, risk, experience, cost, latency, permission fit, policy risk, reputation, and fallback availability.

### Autonomous Goal Ownership Engine

Own goals from creation through completion. Track decomposition, priority, waiting states, blockers, recovery, and completion criteria.

### Semantic World Model

Represent entities, relationships, ontology, provenance, confidence, temporal validity, and semantic meaning.

### World State

Represent the current operational reality: active goals, active executions, blockers, deadlines, incidents, alerts, workload, and waiting states.

### Memory

Record what happened as immutable evidence. Memory stores raw events, decisions, conversations, executions, approvals, rejections, corrections, failures, and source links.

### Experience Engine

Distill repeated memory evidence into reusable professional knowledge: heuristics, playbooks, anti-patterns, decision patterns, risk patterns, and strategies.

### Capability Graph

Represent what Atlas can do, how capabilities compose, which providers can satisfy them, and how mature or trusted each capability is.

### Identity Engine

Resolve humans, organizations, systems, aliases, roles, delegations, permissions, and external account mappings without unsafe assumptions.

### Self Model

Track what Atlas knows about itself: available capabilities, provider confidence, limitations, failure modes, granted authority, resource limits, and subsystem maturity.

### Learning & Governance System

Continuously improve Atlas while ensuring changes are validated, explainable, auditable, and human-governed. Own critic, defender, judge, policy, audit, approval, and promotion gates.

### Cognitive Loop

Coordinate bounded cycles:

```text
observe
-> update world state
-> update semantic world model
-> record memory
-> distill experience
-> update self model
-> review goals
-> allocate attention
-> plan
-> simulate
-> execute
-> evaluate
-> learn
-> rest
```

## Cognitive Representation Stack

Atlas uses a layered internal language and representation model.

| Layer          | Name             | Purpose                                         |
| -------------- | ---------------- | ----------------------------------------------- |
| Boundary       | Natural Language | Human input and human output                    |
| Human-readable | AtlasDSL         | Optional developer-readable intent syntax       |
| Workflow graph | AtlasFlow        | Goal and capability execution graph             |
| Runtime form   | AtlasIR          | Compact deterministic executable representation |
| Object model   | ACR              | Canonical typed cognitive object model          |
| Atomic write   | ACT              | Atomic cognitive transaction                    |
| Event store    | ACES             | Durable committed cognitive history             |
| Transport      | ACB              | Publishes committed cognitive changes           |

## ACR: Atlas Cognitive Representation

ACR defines what cognition looks like inside Atlas.

Every meaningful concept becomes a typed, versioned, evidence-backed object:

- Goal
- Thought
- Decision
- Capability
- Memory
- Experience
- Execution
- Entity
- Relationship
- Policy
- Constraint
- Risk
- Simulation
- Approval
- Observation

The envelope stays stable. Domain-specific details live inside payloads.

ACR objects must be:

- typed
- immutable
- versioned
- graph-native
- evidence-backed
- explainable
- replayable
- serializable
- model-independent
- provider-independent
- storage-independent

## ACT: Atlas Cognitive Transaction

ACT is the atomic write boundary for cognition.

It groups related ACR events into one meaningful cognitive commit:

```text
ACT-000142
+ goal.created
+ thought.created
+ decision.created
+ relationship.added
+ execution.started
+ world.updated
```

Those events either commit together or fail together. Only committed ACTs publish events onto the Atlas Cognitive Bus.

ACT gives Atlas:

- atomic cognition
- consistent replay
- easier debugging
- better distributed execution
- rollback before publication
- strong auditability
- human-readable reasoning checkpoints

## ACES And Storage Model

The storage model is event-first.

```text
Canonical truth: Atlas Cognitive Event Store
Atomic write unit: Atlas Cognitive Transaction
Operational queries: relational projection
Relationship traversal: graph projection
Semantic retrieval: vector/search projection
Raw evidence: object/blob storage
```

This is the preferred architecture:

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

Relational storage is for operational state. Graph storage is for traversal. Vector storage is for retrieval. Object storage is for large evidence. The event store is the source of truth.

## ACB: Atlas Cognitive Bus

ACB transports committed cognitive changes between pillars.

It should move:

- transaction ids
- object refs
- event ids
- version ids
- compact patches
- publication status

It should not repeatedly move giant payloads or raw natural-language context.

## Decision Engine

Atlas should be capable of doing anything that can be done, but it should not act blindly.

The Decision Engine receives what Atlas wants to do, why it wants to do it, what risks exist, what authority applies, what alternatives exist, and what evidence supports the action.

It can return:

- approve
- approve with constraints
- discuss with user
- suggest safer or better alternative
- simulate first
- reject
- delegate to human

Memory can reject a proposed decision from prior evidence. When that happens, the proposal goes back to the Decision Engine with the Memory rejection reason. Decision Engine remains the judgment layer.

## Execution Gate

The Execution Gate translates a Decision Outcome into execution readiness.

```text
DecisionOutcome
-> ExecutionGateOutcome
-> execution state transition
```

The Execution Engine does not re-decide judgment. It schedules, executes, retries, checkpoints, compensates, and records runtime state.

## Memory And Experience

Memory records what happened.

Experience distills what it means.

Example:

```text
Memory:
Provider failed during invoice creation on Tuesday.

Experience:
This provider is risky for Create Resource when required fields are inferred from UI labels.
```

The Experience Engine already has the first implemented path:

- decision memory observations
- decision pattern artifacts
- scoped applicability
- confidence scoring
- anti-overgeneralization
- lookup API for Brain
- lookup API for Capability Kernel

## Capability Provider Ranking

The Capability Kernel currently supports provider ranking and selection using:

- base confidence
- base risk
- Experience artifacts
- cost penalty
- latency penalty
- permission penalty
- policy penalty
- reputation penalty
- fallback provider selection

Selection answers:

```text
Which provider should Atlas try first, and which providers remain viable fallbacks?
```

Approval gates, simulation requirements, and execution policy remain separate.

## Context And Memory Retrieval

Atlas stores knowledge outside the model.

The Context Builder asks:

```text
What information is needed for this specific decision?
```

It builds bounded context packets from:

- Identity
- Governance
- Decision Engine
- World State
- Semantic World Model
- Memory
- Experience
- Capability Graph
- BM25
- vector retrieval

Permission scope is checked before relevance ranking.

## Model Strategy

Atlas should not use one model for everything.

Default rule:

1. Deterministic code first for schemas, rankings, permissions, retries, state machines, persistence, and validation.
2. Small efficient models for extraction, classification, summarization, routing, and confidence scoring.
3. Strong reasoning models for planning, architecture, difficult debugging, high-risk tradeoffs, and governance-sensitive decisions.
4. Specialized models for embeddings, reranking, vision, browser/desktop understanding, and code generation.
5. Benchmark-driven routing instead of brand preference.

Models are providers. They should be ranked and governed like other providers.

## MVP

Atlas MVP should prove:

```text
Unknown business system
-> documentation/API/OpenAPI/MCP/UI/SDK
-> learned entities
-> learned capabilities
-> generated interface drivers
-> generated capability providers
-> tests
-> benchmark: Create Resource
```

The system should learn a generic unknown application through interfaces, without handwritten app-specific code.

Primary MVP tracks:

1. Architecture baseline
2. Capability ontology and graph
3. Interface drivers: REST, OpenAPI, Browser UI, Filesystem, Local Command Execution
4. Capability Provider runtime and SDK
5. Execution Engine and AtlasFlow
6. SWM, Memory, and Experience
7. Decision Engine and governance gates
8. Unknown business system demo

## Current Implementation State

The repo is a pnpm TypeScript monorepo with packages for the major Atlas pillars.

Implemented or started:

- workspace foundation
- formatting, linting, type-checking, test commands
- CI baseline
- core pillar contracts
- planning context builder
- retrieval adapter contract
- Decision Engine baseline outcomes
- Execution Gate mapping
- decision memory records
- memory rejection reconsideration
- Experience artifact lookup
- decision Memory-to-Experience distillation
- Brain Experience lookup
- Kernel Experience lookup
- Experience-aware provider ranking
- cost and latency provider ranking
- permission and policy provider ranking
- reputation-aware provider ranking
- fallback provider selection
- ACR/ATL/ACT/ACES research and storage implementation plan

The implementation checklist remains the source of truth for what is done and what remains.

## Immediate Direction

The strongest next implementation path is:

1. Define ACR and ACT contracts in `@atlas-aios/core`.
2. Add `ACREvent`, `AtlasCognitiveTransaction`, and lifecycle types.
3. Add deterministic tests for ACT atomicity.
4. Add projector from committed ACTs to object state.
5. Add object, relationship, and evidence projections.
6. Add ACB publication guard so only committed ACT events publish.
7. Connect planning context builder to ACR-style references.
8. Continue toward AtlasFlow and AtlasIR.

## Development Rules

Atlas development should follow these constraints:

- Capability-first, not app-first.
- No application names in core architecture.
- Providers and interface drivers are implementation details.
- Natural language stays at boundaries.
- Internal cognition uses ACR objects.
- Related cognitive events commit through ACT.
- Only committed ACTs publish to ACB.
- Event history is canonical.
- Projections are rebuildable.
- Raw evidence is retained by reference.
- Models propose, deterministic validators decide what becomes trusted.
- High-impact changes require governance review.
- Every meaningful decision must be explainable from evidence.

## Key Documents

- [README](README.md)
- [Implementation Checklist](IMPLEMENTATION_CHECKLIST.md)
- [Twelve Pillars](docs/architecture/twelve-pillars.md)
- [Service Boundaries](docs/architecture/service-boundaries.md)
- [Cross-Pillar Contracts](docs/architecture/cross-pillar-contracts.md)
- [Decision Engine](docs/architecture/decision-engine.md)
- [Execution Gate](docs/architecture/execution-gate.md)
- [Experience Distillation](docs/architecture/experience-distillation.md)
- [Context Builder](docs/architecture/context-builder.md)
- [MVP Roadmap](docs/roadmap/mvp.md)
- [Model Strategy Research](docs/research/pillar-implementation-and-model-strategy.md)
- [ACR And Language Research](docs/research/atlas-cognitive-representation-and-language.md)
- [ACR Storage Architecture Plan](docs/superpowers/plans/2026-06-28-acr-storage-architecture.md)

## Final Principle

Atlas is not a collection of disconnected agents.

Atlas is a Cognitive Operating System.

Its defining innovation is not a larger prompt, a better chatbot, or a named integration. Its defining innovation is that cognition becomes structured, typed, versioned, evidence-backed, transactionally committed, replayable, and shared across every subsystem.

Atlas does not execute prompts.

Atlas executes understanding.
