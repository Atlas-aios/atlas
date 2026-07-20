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

Brain reads World State through a separate context lookup adapter. The adapter summarizes the current snapshot, active goals, active executions, and severity-filtered blockers into bounded planning context. Low-severity blockers can be dropped for a given planning pass while still being reported as dropped ids for auditability.

Brain reads Memory through an episodic context lookup adapter. The adapter filters immutable Memory events by event kind and source references, converts matching records into compact planning context, and preserves the Memory event id plus original source ids for auditability. Memory remains append-first evidence; Brain consumes retrieved events but does not mutate Memory storage.

Brain reads Self Model through a capability-awareness context lookup adapter. The adapter summarizes granted authority, capability confidence, provider-specific confidence, and known limitations into planning context. Low-confidence capability records can be dropped for a planning pass while still being reported as dropped ids so Atlas can explain when it ignored its own uncertain abilities.

Brain reads Identity through a confidence-filtered identity context lookup adapter. The adapter converts identity subjects and external system resolutions into bounded context for planning, preserving aliases, evidence references, and external ids. Brain uses this to reason about humans, systems, organizations, and providers without guessing identity from names alone.

Brain reads Experience through a distilled-knowledge context lookup adapter. The adapter filters heuristics, playbooks, anti-patterns, decision patterns, and risk patterns by applicability and confidence, then converts matching artifacts into compact planning context with evidence Memory event references. Experience remains distilled guidance, not raw fact; Brain consumes it as decision support while preserving dropped artifact ids for auditability.

Brain reads Capability Graph through a capability context lookup adapter. The adapter filters requested capability nodes by confidence and can include dependency, composition, and fallback edges as compact planning context. This lets Brain understand what Atlas can do and what supporting capabilities may be required without mutating the graph or hardcoding application names.

Brain reads Governance through evaluated policy-decision and approval-requirement context. The adapter filters constraints by planned action, drops allowed decisions when the planning pass only needs blockers, and preserves policy or approval references for auditability. Brain may explain or block plans from this context, but policy evaluation and approval authority remain owned by Learning & Governance.

### Capability Kernel

The Capability Kernel converts requested capabilities into ranked provider choices. It does not know application names; it ranks capability providers through capability fit, policy risk, experience, self-model confidence, cost, and latency.

Coding is represented as a capability, not as Atlas becoming another AI IDE. For `capability:modify-code`, the Kernel may rank providers such as external AI coding platforms, local code agents, or human code review workflows by cost, latency, privacy, repository permissions, reliability, and prior Experience. This lets Atlas delegate coding work to Codex-style or Claude-Code-style providers when useful, while still enforcing budgets, approval gates, branch/commit policy, and auditability.

Provider manifests can be adapted into Kernel candidates without making the Kernel depend on application-specific provider implementations. Draft generated OpenAPI providers receive conservative confidence, risk, permission, policy, and reputation defaults so they can be ranked, simulated, and approval-gated before trusted use.

### Interface Drivers

Interface Drivers translate provider-level intent into interface-specific requests. REST execution is handled through an injected transport and explicit permission checks. OpenAPI ingestion currently extracts draft capability graph nodes plus draft REST driver mappings from an unknown API specification; it does not automatically promote the graph or execute generated provider behavior without later evidence, tests, and governance gates.

The `@atlas-aios/learning` package currently owns the OpenAPI interface-learning pipeline: it composes OpenAPI ingestion, draft provider manifest generation, and Kernel candidate creation into one tested contract. This pipeline produces planning artifacts only; execution still flows through provider runtime, simulation, approval, and promotion gates.

The learning pipeline also emits confidence ladder assessments and review items for low-confidence learned outputs. These review items are structured handoff records for later Decision Engine, benchmark, approval, or human review flows; they are not automatic promotion decisions.

The MVP unknown-business-system fixture lives in the learning package as a synthetic OpenAPI document with unfamiliar domain terms. It is used to verify that Atlas can derive draft capabilities and providers from interface evidence without hardcoded application-specific logic.

The fixture also includes an in-memory REST surface for `folio`, `settlement`, and `work packet` operations. This is a deterministic test fixture for learning and benchmarking; it is not a deployed HTTP service yet.

The first benchmark scenario is `Create Resource`, which drives the fixture through folio creation, settlement allocation, and work-packet dispatch, then compares the final state snapshot against expected evidence.

The REST fixture supports opt-in bearer authentication for protected fixture operations. This is test authentication for provider/driver validation, not production identity or tenant security.

The browser UI fixture provides deterministic HTML with Atlas-readable selectors for the same `folio`, `settlement`, and `work packet` workflow. It is a screen-model fixture for UI learning and benchmark flow validation, not a deployed frontend, live browser driver, or Playwright target yet.

### AGOE

The Autonomous Goal Ownership Engine owns goals from creation to completion. It tracks waiting states, blockers, decompositions, recovery attempts, and completion criteria.

AGOE Goal records carry owner, priority, lifecycle status, parent goal reference, child goal ids, dependency ids, waiting states, and explicit completion criteria. Goal lifecycle changes emit typed events such as `goal.created`, `goal.status_changed`, `goal.decomposed`, `goal.dependency_added`, `goal.waiting_state_added`, and `goal.completion_criterion_satisfied` so World State, Memory, and the Cognitive Loop can consume goal changes without scraping free-form text.

The AGOE monitoring pass is deterministic. It inspects current Goal records and emits lifecycle updates when objective state changes, beginning with automatic completion of active goals whose completion criteria are all satisfied.

Goal recovery is explicit and auditable. A waiting or blocked Goal can be recovered to `active` only through a recovery attempt that records strategy, reason, timestamp, and source references, then emits `goal.recovery_attempted` for Memory, World State, and later governance review.

### Semantic World Model

The SWM owns the semantic understanding of entities and relationships. It stores meaning, provenance, confidence, and temporal validity.

### World State

World State owns the current operational reality: active work, blockers, deadlines, incidents, waiting states, and workload.

### Simulation Engine

The Simulation Engine owns deterministic counterfactual branches over World State. It
applies explicit predicted effects to a defensive clone, calculates before/after
metrics, evaluates configured blocker thresholds, and returns `passed`, `blocked`, or
`failed` evidence without changing live operational state.

Runtime composes this projection with Interface Driver request preview. A request
preview alone is not complete simulation evidence: both the interface preview and
World State projection must succeed. Predicted effects are supplied by the governed
plan policy and are never inferred from provider or application names.

The Simulation Engine also compares multiple branches from the same source snapshot.
The caller supplies explicit limits and weights for confidence, cost, latency,
blocker growth, and critical-blocker growth. Blocked, failed, incomplete, or
out-of-policy candidates remain visible with rejection reasons but cannot be selected.
Selection is deterministic evidence for planning and does not grant execution
authority.

### Internal Economy

The Internal Economy owns deterministic resource accounting. Its append-only ledger
records budget creation, cost reservation, actual settlement, and reservation release.
Available funds are derived from the immutable budget limit minus settled spend and
active reservations; callers cannot directly write a balance.

Runtime persists the economy state and exposes authenticated budget, reservation,
settlement, release, and ledger APIs. Accepted transitions emit Memory and Audit
evidence, while conflicting retries and oversubscription are rejected by the domain
boundary.

Simulation comparison may reference a budget. Runtime snapshots its available amount
and tightens the comparison cost ceiling to the lower of caller policy or available
funds. This is planning evidence only: selecting a plan does not reserve funds, approve
execution, or settle provider cost. Automatic reservation and settlement around the
governed execution path remain explicit follow-up work.

### Memory

Memory records what happened. It is append-first, provenance-first, and used as evidence for learning and experience.

### Experience Engine

The Experience Engine distills raw memory into reusable heuristics, playbooks, anti-patterns, decision patterns, and risk patterns.

### Capability Graph

The Capability Graph represents what Atlas can do and how capabilities compose. It carries confidence and maturity state from draft to production.

The current implementation provides an MVP in-memory graph repository plus deterministic traversal and search APIs. It is suitable for local planning and tests; durable PostgreSQL/vector-backed persistence remains the production storage target defined by the service boundary.

Capability Graph maturity is explicit. Draft graphs may be explored, trusted graphs require evidence and sufficient node confidence, and production graphs additionally require governance approval plus benchmark evidence before they can be used as production-grade capability knowledge.

Capability Registry resolves capability ids across registered graphs, preferring higher maturity and confidence so Brain and Capability Kernel can request a capability without hardcoding which graph produced it.

### Identity Engine

Identity resolves humans, organizations, systems, providers, aliases, roles, and delegation context without unsafe assumptions.

### Self Model

The Self Model tracks what Atlas believes about its own abilities, limitations, confidence, authority, and failure modes.

### Learning & Governance

Learning & Governance validates evolution. It owns policy decisions, human approval rules, critic/defender/judge outputs, audit impact, and promotion gates.

### Cognitive Loop

The Cognitive Loop orchestrates observe, update, remember, distill, plan, simulate, execute, evaluate, learn, and rest cycles. It coordinates pillars without replacing their ownership.

The bounded loop now distinguishes a missing simulation from a completed one. It
returns `simulate_capability` when a goal and capability are ready but no successful
simulation artifact exists, and only returns `dispatch_capability` when that evidence
is present.

A dispatch-ready cycle can be continued through Runtime with an explicit plan-run id.
Runtime binds the cycle to the exact goal, first capability, successful simulation
artifacts, and approved requests before reusing Decision Engine reconsideration,
Execution Gate, AtlasFlow, and provider execution. The continued cycle records the
actual execution evidence and becomes idempotent for that plan run. Atlas does not yet
select a plan run or schedule this continuation automatically.
