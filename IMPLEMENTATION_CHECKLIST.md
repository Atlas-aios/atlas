# Atlas AIOS Implementation Checklist

**Status:** Living implementation tracker

**Purpose:** Track the work required to turn the Atlas AIOS architecture into a working system.

Use this file as the source checklist. Tick items only when the implementation is committed, tested, and documented.

---

## 0. Foundation

- [x] Confirm MVP scope: learn an unknown generic business system and execute `Create Resource`.
- [x] Confirm public/private repo policy for all Atlas repos.
- [x] Define three-core-repo operating model: `atlas`, `atlas-docs`, and `atlas-research`.
- [x] Define contribution model and branch policy.
- [x] Choose initial stack for API, workers, packages, and frontend.
- [x] Create root package manager/workspace setup.
- [x] Add formatting, linting, type-checking, and test commands.
- [x] Add CI for lint, test, type-check, and build.
- [x] Add base logging and configuration conventions.
- [x] Add environment variable and secrets conventions.
- [x] Add architecture docs links to repo README.

---

## 1. Twelve-Pillar Implementation Map

- [x] Define service boundary for Brain Engines.
- [x] Define service boundary for Capability Kernel.
- [x] Define service boundary for AGOE.
- [x] Define service boundary for Semantic World Model.
- [x] Define service boundary for World State.
- [x] Define service boundary for Memory.
- [x] Define service boundary for Experience Engine.
- [x] Define service boundary for Capability Graph.
- [x] Define service boundary for Identity Engine.
- [x] Define service boundary for Self Model.
- [x] Define service boundary for Learning & Governance System.
- [x] Define service boundary for Cognitive Loop.
- [x] Define cross-pillar event contracts.
- [x] Define cross-pillar persistence ownership.
- [x] Define cross-pillar observability requirements.

---

## 2. Core Data And Event Model

- [x] Design PostgreSQL schema baseline.
- [x] Design migration strategy.
- [x] Design event bus topic naming.
- [x] Define event envelope schema.
- [x] Define ACR event-first source-of-truth model.
- [x] Define Atlas Cognitive Transaction schema.
- [x] Define ACT lifecycle states.
- [x] Define ACT validation and commit rules.
- [x] Define ACT publication-after-commit rule.
- [x] Define ACT compensation event rules.
- [x] Define append-only ACR event log schema.
- [x] Define ACR event vocabulary.
- [x] Define Atlas Cognitive Representation object envelope.
- [x] Define ACR primitive object type registry.
- [x] Define ACR relationship model.
- [x] Define ACR provenance and evidence model.
- [x] Define ACR object version projection.
- [x] Define ACR relationship projection.
- [x] Define ACR evidence reference projection.
- [x] Define ACR raw evidence object-storage boundary.
- [x] Define ACR search/vector projection boundary.
- [x] Define ACT-level replay contract.
- [x] Define ACR replay and temporal query contract.
- [x] Define Atlas Cognitive Bus message envelope.
- [x] Define ACB object reference and payload storage rules.
- [x] Define ATL / AtlasDSL source format boundary.
- [x] Define AtlasIR versioning and checksum strategy.
- [x] Define decision request schema.
- [x] Define decision outcome schema.
- [x] Define audit event schema.
- [x] Define approval event schema.
- [x] Define execution event schema.
- [x] Define memory event schema.
- [x] Define SWM entity and relationship schema.
- [x] Define Capability Graph schema.
- [x] Define Experience artifact schema.
- [ ] Define Self Model schema.
- [x] Define Identity resolution schema.
- [x] Add local development database setup.
- [x] Add seed data for synthetic unknown business system.

---

## 3. Brain Engines

- [x] Define Brain Engine interface.
- [ ] Define Atlas compiler interface from natural language to ACR drafts.
- [ ] Define AtlasFlow compiler interface from ACR goals to workflow graphs.
- [ ] Define AtlasIR compiler interface from AtlasFlow to executable IR.
- [x] Define Thought lifecycle model.
- [x] Implement Thought creation.
- [x] Implement Thought scheduling hooks.
- [x] Implement planning context builder.
- [x] Define retrieval adapter contract for context lookups.
- [x] Define optional remote deep reasoning model lane.
- [x] Add NVIDIA NIM remote reasoning client contract.
- [x] Add SWM context lookup.
- [x] Add World State lookup.
- [x] Add Memory lookup.
- [x] Add Experience lookup.
- [x] Add Self Model lookup.
- [x] Add Identity lookup.
- [x] Add Capability Graph lookup.
- [x] Add Governance constraint lookup.
- [x] Implement plan explanation output.
- [x] Implement clarification-needed output.
- [x] Implement approval-needed output.
- [x] Add tests for planning context assembly.

---

## 3A. Decision Engine

- [x] Define Decision Engine service boundary.
- [x] Define `DecisionRequest`.
- [x] Define `DecisionOutcome`.
- [x] Define decision outcome types: approve, approve with constraints, discuss, suggest alternative, simulate first, reject, delegate to human.
- [x] Define `DecisionRisk`.
- [x] Define `DecisionAlternative`.
- [x] Define reversible vs irreversible action classification.
- [x] Define external impact classification: money, production, legal, private data, public communication, destructive action.
- [x] Implement deterministic default Decision Engine.
- [x] Implement approval-with-constraints outcome.
- [x] Implement discuss-for-better-way outcome.
- [x] Implement simulate-first outcome.
- [x] Implement reject outcome.
- [x] Feed Decision Engine outcomes into Execution Engine.
- [x] Record decisions into Memory.
- [x] Feed Memory rejection reasons back into Decision Engine.
- [x] Feed repeated decision patterns into Experience Engine.
- [x] Add tests for approve, discuss, simulate, and reject outcomes.

---

## 4. Autonomous Goal Ownership Engine

- [x] Define Goal data model.
- [x] Define Goal status model.
- [x] Define Goal dependency model.
- [x] Implement goal creation.
- [x] Implement goal decomposition.
- [x] Implement goal priority fields.
- [x] Implement goal waiting states.
- [x] Implement goal monitoring loop.
- [x] Implement goal recovery behavior.
- [x] Implement goal completion criteria.
- [x] Add event emissions for goal lifecycle.
- [x] Add tests for long-running goals.

---

## 5. Capability Graph And Registry

- [x] Define layered capability ontology: L0 through L4.
- [x] Implement Capability Registry storage.
- [x] Implement Capability Graph storage.
- [x] Implement capability dependency edges.
- [x] Implement capability composition.
- [x] Implement capability confidence fields.
- [x] Implement capability source tracking.
- [x] Implement Draft Capability Graph status.
- [x] Implement Trusted Capability Graph status.
- [x] Implement Production Capability Graph status.
- [x] Implement graph traversal API.
- [x] Implement capability search API.
- [x] Add tests for capability graph resolution.

---

## 6. Capability Kernel

- [x] Define Capability Kernel API.
- [x] Implement capability resolution.
- [x] Implement provider lookup.
- [x] Implement provider ranking.
- [x] Include permission fit in ranking.
- [x] Include policy risk in ranking.
- [x] Include provider reputation in ranking.
- [x] Define provider Experience lookup contract.
- [x] Include Experience artifacts in ranking.
- [x] Include cost and latency in ranking.
- [x] Implement fallback provider selection.
- [x] Implement approval gate detection.
- [x] Implement simulation requirement detection.
- [x] Add tests for Experience-aware provider ranking.
- [x] Add tests for cost and latency-aware provider ranking.
- [x] Add tests for permission and policy-aware provider ranking.
- [x] Add tests for reputation-aware provider ranking.
- [x] Add tests for provider selection.

---

## 7. Capability Provider Runtime

- [x] Define Provider Manifest v0.
- [x] Define provider lifecycle states.
- [x] Implement provider registration.
- [x] Implement provider versioning.
- [x] Implement provider input validation.
- [x] Implement provider output validation.
- [x] Implement provider execution wrapper.
- [x] Implement provider event emissions.
- [x] Implement provider retry policy.
- [x] Implement rollback/compensation hooks.
- [x] Define AI coding platform provider manifest.
- [ ] Implement Human Provider contract.
- [ ] Implement provider health monitoring.
- [ ] Add provider contract tests.

---

## 8. Interface Drivers

- [x] Define Interface Driver contract.
- [x] Implement REST driver.
- [x] Implement OpenAPI parser/driver.
- [ ] Implement Browser UI driver.
- [ ] Implement Filesystem driver.
- [ ] Implement Local Command Execution driver.
- [ ] Add GraphQL driver placeholder.
- [ ] Add CLI driver placeholder.
- [ ] Add MCP driver placeholder.
- [ ] Add driver test harness.
- [x] Add driver simulation mode.
- [x] Add driver permission model.
- [x] Add driver observability events.

---

## 9. Execution Engine And AtlasFlow

- [x] Define execution gate contract.
- [x] Define AtlasFlow workflow schema.
- [x] Define AtlasFlow node and edge schemas.
- [x] Define AtlasIR instruction schema.
- [x] Define AtlasIR replay contract.
- [x] Define node types.
- [x] Define edge types.
- [x] Define execution state machine.
- [x] Implement workflow validation.
- [x] Implement execution session creation.
- [x] Implement sequential node execution.
- [x] Implement parallel node execution.
- [x] Implement approval node behavior.
- [x] Implement human provider node behavior.
- [x] Implement wait node behavior.
- [x] Implement checkpointing.
- [x] Implement retries.
- [x] Implement rollback.
- [x] Implement compensation.
- [x] Implement streaming execution events.
- [x] Add tests for state transitions.

---

## 10. Semantic World Model

- [ ] Implement entity storage.
- [ ] Implement relationship storage.
- [ ] Implement ontology type registry.
- [ ] Implement ontology inheritance.
- [ ] Implement provenance storage.
- [ ] Implement confidence scores.
- [ ] Implement temporal validity.
- [ ] Implement permission-aware entity reads.
- [ ] Implement relationship traversal.
- [ ] Implement identity links.
- [ ] Implement SWM update events.
- [ ] Add tests for entity/relationship updates.

---

## 11. World State

- [ ] Define World State snapshot model.
- [ ] Implement active goal state.
- [ ] Implement active execution state.
- [ ] Implement blockers.
- [ ] Implement deadlines.
- [ ] Implement waiting states.
- [ ] Implement incidents.
- [ ] Implement alerts.
- [ ] Implement current workload tracking.
- [ ] Implement World State update events.
- [ ] Add tests for stale state and updates.

---

## 12. Memory

- [x] Define Memory event schema.
- [ ] Implement raw event recording.
- [x] Implement decision outcome memory records.
- [x] Implement memory rejection reconsideration request.
- [ ] Implement conversation memory.
- [ ] Implement execution memory.
- [ ] Implement approval/rejection memory.
- [ ] Implement correction memory.
- [ ] Implement meeting memory.
- [ ] Implement failure memory.
- [ ] Implement source/provenance links.
- [ ] Implement memory retrieval API.
- [x] Add tests for decision memory records.
- [ ] Add tests for immutable memory records.

---

## 13. Experience Engine

- [x] Define Experience artifact schema.
- [ ] Define heuristic artifact type.
- [ ] Define playbook artifact type.
- [ ] Define anti-pattern artifact type.
- [x] Define decision pattern artifact type.
- [ ] Define risk pattern artifact type.
- [x] Implement decision Memory-to-Experience distillation pipeline.
- [x] Implement evidence linking for decision patterns.
- [x] Implement confidence scoring for decision patterns.
- [x] Implement scope/applicability conditions for decision patterns.
- [ ] Implement staleness/review policy.
- [x] Implement Experience lookup API.
- [x] Implement Experience lookup API for Brain.
- [x] Implement Experience lookup API for Kernel.
- [ ] Add governance review for high-impact artifacts.
- [x] Add tests for avoiding overgeneralization.

---

## 14. Identity Engine

- [x] Define identity entity model.
- [x] Define alias model.
- [x] Define external account mapping.
- [ ] Define role model.
- [ ] Define permission context model.
- [ ] Define delegation model.
- [ ] Implement identity resolution.
- [ ] Implement merge workflow.
- [ ] Implement split/rollback workflow.
- [ ] Implement identity confidence.
- [ ] Implement identity-aware governance checks.
- [ ] Add tests for unsafe identity assumptions.

---

## 15. Self Model

- [ ] Define Self Model schema.
- [ ] Track available capabilities.
- [ ] Track provider confidence.
- [ ] Track interface maturity.
- [ ] Track known limitations.
- [ ] Track known failure modes.
- [ ] Track granted authority.
- [ ] Track resource and cost limits.
- [ ] Track subsystem maturity.
- [ ] Update Self Model from execution outcomes.
- [ ] Update Self Model from Experience.
- [ ] Add tests for confidence updates.

---

## 16. Learning & Governance

- [ ] Define Learning report schema.
- [ ] Implement Critic review.
- [ ] Implement Defender review.
- [ ] Implement Judge validation.
- [ ] Implement development promotion gate.
- [ ] Implement production promotion gate.
- [ ] Implement human approval workflow.
- [ ] Implement audit logging.
- [ ] Implement policy engine.
- [ ] Implement sensitive action detection.
- [ ] Implement governance-blocked result type.
- [ ] Add tests for approval-required actions.

---

## 17. Cognitive Loop

- [ ] Define loop cycle schema.
- [ ] Implement observe phase.
- [ ] Implement update World State phase.
- [ ] Implement update SWM phase.
- [ ] Implement update Memory phase.
- [ ] Implement distill Experience phase.
- [ ] Implement update Self Model phase.
- [ ] Implement review goals phase.
- [ ] Implement allocate attention phase.
- [ ] Implement plan phase.
- [ ] Implement simulate phase.
- [ ] Implement execute phase.
- [ ] Implement evaluate phase.
- [ ] Implement learn phase.
- [ ] Implement rest/idle phase.
- [ ] Add loop observability.
- [ ] Add tests for bounded cycles.

---

## 18. Curiosity, Attention, Simulation, Economy, Time, Reputation

- [ ] Implement Curiosity Engine knowledge-gap backlog.
- [ ] Implement curiosity value/risk scoring.
- [ ] Implement curiosity approval gating.
- [ ] Implement Attention Engine scoring.
- [ ] Implement processing frequency decisions.
- [ ] Implement escalation decisions.
- [ ] Implement Simulation Engine World State clone.
- [ ] Implement simulation metrics.
- [ ] Implement plan comparison.
- [ ] Implement Internal Economy cost model.
- [ ] Implement Time Engine deadlines.
- [ ] Implement Time Engine recurrence.
- [ ] Implement waiting-time detection.
- [ ] Implement Reputation Engine provider scoring.
- [ ] Feed reputation into Capability Kernel.

---

## 18A. Adaptive Specialist Engine

- [ ] Define Adaptive Specialist Engine service boundary.
- [ ] Define Interface Specialist artifact schema.
- [ ] Define Site Knowledge Pack schema.
- [ ] Define specialist dataset schema from Memory, Experience, interface observations, workflows, tests, and corrections.
- [ ] Define specialist training provider contract.
- [ ] Add Tinker/Inkling research track as a candidate training provider.
- [ ] Add specialist model registry.
- [ ] Add specialist provider registration flow.
- [ ] Add governance gate before training on private data.
- [ ] Add benchmark gate before specialist promotion.
- [ ] Add drift detection for stale site/interface specialists.
- [ ] Add retirement workflow for unsafe or stale specialists.
- [ ] Route repeated site/domain tasks to specialist providers through Capability Kernel.
- [ ] Add tests for specialist promotion only after benchmark and governance approval.

---

## 19. Knowledge Engine And Interface Learning

- [ ] Implement document ingestion.
- [x] Implement OpenAPI ingestion.
- [ ] Implement Browser UI observation.
- [ ] Implement source chunking.
- [ ] Implement embeddings.
- [ ] Extract candidate SWM entities.
- [ ] Extract candidate relationships.
- [x] Extract candidate capabilities.
- [x] Generate Draft Capability Graph.
- [x] Generate Draft Capability Providers.
- [x] Generate Draft Interface Driver mappings.
- [ ] Add confidence ladder.
- [ ] Add review workflow for low-confidence outputs.

---

## 20. MVP Unknown Business System

- [ ] Design synthetic domain model.
- [ ] Implement REST API fixture.
- [ ] Implement OpenAPI fixture.
- [ ] Implement browser UI fixture.
- [ ] Implement authentication fixture.
- [ ] Add sample data.
- [ ] Add example workflows.
- [ ] Add unknown terminology.
- [ ] Add benchmark scenario for `Create Resource`.
- [ ] Test Atlas learns the system without handwritten app-specific code.

---

## 21. APIs

- [ ] Implement `/goals`.
- [ ] Implement `/capabilities`.
- [ ] Implement `/capability-graphs`.
- [ ] Implement `/providers`.
- [ ] Implement `/interface-drivers`.
- [ ] Implement `/workflows`.
- [ ] Implement `/executions`.
- [ ] Implement `/approvals`.
- [ ] Implement `/world-state`.
- [ ] Implement `/swm/entities`.
- [ ] Implement `/swm/relationships`.
- [ ] Implement `/memory/events`.
- [ ] Implement `/experience/artifacts`.
- [ ] Implement `/identity/entities`.
- [ ] Implement `/self-model`.
- [ ] Implement `/thoughts`.
- [ ] Implement `/simulations`.
- [ ] Implement `/learning/reports`.
- [ ] Implement `/governance/policies`.
- [ ] Add API auth and audit checks.

---

## 22. Frontend / Admin UI

- [ ] Create Atlas dashboard shell.
- [ ] Add goals view.
- [ ] Add execution timeline view.
- [ ] Add approval inbox.
- [ ] Add Capability Graph view.
- [ ] Add provider registry view.
- [ ] Add SWM entity explorer.
- [ ] Add Memory explorer.
- [ ] Add Experience artifact explorer.
- [ ] Add Self Model view.
- [ ] Add policy/governance view.
- [ ] Add logs/traces view.
- [ ] Add benchmark reports view.

---

## 23. Testing And Benchmarks

- [ ] Unit test core packages.
- [ ] Contract test APIs.
- [ ] Contract test providers.
- [ ] Contract test drivers.
- [ ] Test workflow state machine.
- [ ] Test governance gates.
- [ ] Test simulation outputs.
- [x] Test ACT atomic commit behavior.
- [x] Test ACT publication-after-commit behavior.
- [x] Test ACT compensation replay behavior.
- [x] Test ACR event replay determinism.
- [x] Test ACR temporal queries.
- [x] Test ACR graph projection rebuilds.
- [ ] Test Experience distillation.
- [ ] Test unknown business system learning.
- [ ] Benchmark `Create Resource`.
- [ ] Benchmark provider reliability.
- [ ] Benchmark plan correctness.
- [ ] Benchmark cost and latency.
- [ ] Add regression suite before production promotion.

---

## 24. Deployment And Operations

- [ ] Add Docker Compose development environment.
- [ ] Add production Dockerfiles.
- [ ] Add Kubernetes manifests.
- [ ] Add secrets manager integration.
- [ ] Add observability stack.
- [ ] Add migrations runner.
- [ ] Add backup and restore plan.
- [ ] Add deployment rollback plan.
- [ ] Add health checks.
- [ ] Add readiness checks.
- [ ] Add production runbook.

---

## 25. Documentation And Research

- [ ] Keep ADRs current.
- [ ] Keep architecture diagrams current.
- [ ] Maintain RFC process.
- [ ] Maintain research backlog.
- [x] Evaluate Nemotron 3 for agentic reasoning backbone.
- [ ] Evaluate TurboQuant for long-context KV-cache and memory compression.
- [ ] Evaluate LocateAnything for desktop vision grounding.
- [ ] Compare LocateAnything with existing UI grounding models for computer control.
- [ ] Document every subsystem.
- [ ] Document every provider contract.
- [ ] Document every interface driver.
- [ ] Document every governance policy.
- [ ] Document benchmark methodology.
- [ ] Link implementation tasks to docs.

---

## Completion Rule

An item is complete only when:

- [ ] Code or document is committed.
- [ ] Tests or validation are included where applicable.
- [ ] Docs are updated.
- [ ] Relevant architecture decision is linked.
- [ ] Governance impact is considered.
