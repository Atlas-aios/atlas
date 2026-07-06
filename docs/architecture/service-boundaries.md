# Twelve-Pillar Service Boundaries

Atlas is built around capabilities rather than named applications. Each pillar owns a distinct part of the AIOS and communicates through explicit contracts instead of hidden coupling.

## Boundary Rules

- A pillar owns the data it is listed as owning.
- Other pillars read through published APIs, events, or query contracts.
- Cross-pillar writes happen through commands or events, not direct storage mutation.
- Providers and interface drivers are implementation details behind capabilities.
- The Decision Engine reviews proposed actions and can approve, constrain, discuss, improve, simulate, reject, or delegate before execution.
- Repository boundaries are also architecture boundaries: `atlas-research` explores options, `atlas-docs` records accepted architecture, and `atlas` implements tested runtime behavior.

## Repository Boundaries

The three core repositories map to different levels of certainty:

| Repository       | Architectural Layer | Responsibility                                                                  |
| ---------------- | ------------------- | ------------------------------------------------------------------------------- |
| `atlas-research` | Exploratory         | Compare papers, models, algorithms, providers, interface strategies, and risks. |
| `atlas-docs`     | Canonical decision  | Store ADRs, architecture specs, diagrams, and accepted design constraints.      |
| `atlas`          | Runtime             | Implement packages, services, tests, benchmarks, and executable contracts.      |

A research result should not directly become production behavior. It should first become a documented decision or spec, then a checklist item, then implementation with tests.

```text
Question
-> research note
-> accepted ADR/spec
-> checklist item
-> package/service implementation
-> benchmark and governance review
```

## Pillar Map

| Pillar                | Package                         | Owns                                                                  | Consumes                                                                                             | Persistence                                       |
| --------------------- | ------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Brain Engines         | `@atlas-aios/brain`             | reasoning, planning, plan explanation, context assembly               | Capability Kernel, SWM, World State, Memory, Experience, Self Model, Identity, Learning & Governance | PostgreSQL, event log                             |
| Capability Kernel     | `@atlas-aios/capability-kernel` | capability resolution, provider ranking, approval gate detection      | Capability Graph, Experience, Learning & Governance, Self Model                                      | PostgreSQL, event log                             |
| AGOE                  | `@atlas-aios/agoe`              | goal lifecycle, decomposition, recovery, waiting states               | Brain Engines, World State, Learning & Governance                                                    | PostgreSQL, event log                             |
| Semantic World Model  | `@atlas-aios/swm`               | entities, relationships, ontology, semantic provenance                | Identity, Memory, knowledge ingestion outputs                                                        | PostgreSQL, vector store, event log               |
| World State           | `@atlas-aios/world-state`       | operational snapshots, active goals, blockers, deadlines              | AGOE, Execution Engine, Memory, Observability                                                        | PostgreSQL, event log                             |
| Memory                | `@atlas-aios/memory`            | immutable events, conversation records, execution records             | Cognitive Loop, Execution Engine, Learning & Governance                                              | PostgreSQL, vector store, object store, event log |
| Experience Engine     | `@atlas-aios/experience`        | heuristics, playbooks, anti-patterns, decision patterns               | Memory, Learning & Governance, Self Model                                                            | PostgreSQL, vector store, event log               |
| Capability Graph      | `@atlas-aios/capability-graph`  | capability ontology, composition, confidence                          | knowledge ingestion outputs, Learning & Governance                                                   | PostgreSQL, vector store, event log               |
| Identity Engine       | `@atlas-aios/identity`          | identity resolution, aliases, roles, delegation context               | SWM, Memory, Learning & Governance                                                                   | PostgreSQL, event log                             |
| Self Model            | `@atlas-aios/self-model`        | capability confidence, known limitations, granted authority           | Memory, Experience, Learning & Governance                                                            | PostgreSQL, event log                             |
| Learning & Governance | `@atlas-aios/governance`        | policy decisions, critic reports, defender reports, judge validation  | Memory, Experience, Execution Engine, Self Model                                                     | PostgreSQL, object store, event log               |
| Cognitive Loop        | `@atlas-aios/cognitive-loop`    | loop phases, attention allocation, curiosity triggers, bounded cycles | Brain Engines, AGOE, World State, Memory, Experience, Self Model                                     | PostgreSQL, event log                             |

## Decision Engine Overlay

The Decision Engine sits between planning and execution. It is not a separate restriction-first pillar in the twelve-pillar core; it is the active decision layer that uses Learning & Governance, Memory, Experience, Identity, World State, and Self Model to decide how Atlas should proceed.

It receives intent and action proposals, then returns one of: approve, approve with constraints, discuss, suggest alternative, simulate first, reject, or delegate to human.

## Ownership Principles

### Brain Engines

Brain Engines decide how Atlas reasons about a goal. They do not execute provider calls directly. They produce plans, explanations, clarification requests, and approval requests.

Plan explanations are structured outputs, not free-form prose only. The Brain explanation boundary includes the plan id, goal id, rationale, risk summary, approval-gated step ids, selected model lane, model profile id, and active guardrails. UI and API layers can render that structure for humans without losing machine-readable governance context.

Brain Thought objects begin as `draft` and move through explicit lifecycle states: `ready`, `scheduled`, `blocked`, `resolved`, or `discarded`. Thoughts carry provenance references and model lane metadata so reasoning artifacts can be audited later.

Clarification and approval outputs are blocking structured outputs. A clarification output records the exact question, reason, required planning decision, choices, evidence references, and model metadata. An approval output records the plan, gated steps, reason, risks, constraints, and model metadata. These outputs are intended to feed AGOE waiting states, approval inboxes, and Memory records without scraping prose.

Thought scheduling is a deterministic hook, not a model call. The scheduler moves `ready` thoughts to `scheduled` when no blockers exist, moves them to `blocked` when blocker references are present, and rejects invalid lifecycle transitions with a typed error. Scheduling emits machine-readable `thought.scheduled` or `thought.blocked` events for later Memory, AGOE, and Cognitive Loop integration.

Brain reads SWM through a context lookup adapter. The adapter converts permissioned, confidence-filtered SWM entities and relationships into bounded Brain context items with source references. Brain does not mutate SWM storage; it consumes SWM context for planning and records dropped item ids when evidence is too low-confidence or outside permission scope.

### Capability Kernel

The Capability Kernel converts requested capabilities into ranked provider choices. It does not know application names; it ranks capability providers through capability fit, policy risk, experience, self-model confidence, cost, and latency.

### AGOE

The Autonomous Goal Ownership Engine owns goals from creation to completion. It tracks waiting states, blockers, decompositions, recovery attempts, and completion criteria.

### Semantic World Model

The SWM owns the semantic understanding of entities and relationships. It stores meaning, provenance, confidence, and temporal validity.

### World State

World State owns the current operational reality: active work, blockers, deadlines, incidents, waiting states, and workload.

### Memory

Memory records what happened. It is append-first, provenance-first, and used as evidence for learning and experience.

### Experience Engine

The Experience Engine distills raw memory into reusable heuristics, playbooks, anti-patterns, decision patterns, and risk patterns.

### Capability Graph

The Capability Graph represents what Atlas can do and how capabilities compose. It carries confidence and maturity state from draft to production.

### Identity Engine

Identity resolves humans, organizations, systems, providers, aliases, roles, and delegation context without unsafe assumptions.

### Self Model

The Self Model tracks what Atlas believes about its own abilities, limitations, confidence, authority, and failure modes.

### Learning & Governance

Learning & Governance validates evolution. It owns policy decisions, human approval rules, critic/defender/judge outputs, audit impact, and promotion gates.

### Cognitive Loop

The Cognitive Loop orchestrates observe, update, remember, distill, plan, simulate, execute, evaluate, learn, and rest cycles. It coordinates pillars without replacing their ownership.
