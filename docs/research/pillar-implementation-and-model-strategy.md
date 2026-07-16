# Atlas Pillar Implementation And Model Strategy Research

**Status:** Research note  
**Date:** 2026-06-27  
**Scope:** How the Atlas AIOS pillars should be built, which model classes to use, how to optimize performance and efficiency, and which papers should guide implementation.

## Executive Recommendation

Atlas should not use one model for everything. The strongest architecture is a model-agnostic, capability-first system with a router that chooses the cheapest reliable model or deterministic subsystem for each step.

Use this default pattern:

1. Deterministic code first for state machines, permissions, schemas, rankings, retries, and persistence.
2. Small or efficient models for extraction, classification, summarization, routing, and confidence scoring.
3. Strong reasoning models for planning, architectural tradeoffs, hard debugging, and governance-sensitive decisions.
4. Specialized models for embeddings, reranking, vision/browser understanding, code generation, and local/offline tasks.
5. Evaluation-driven routing, where every model choice is justified by Atlas benchmarks rather than brand preference.

Atlas should treat models as providers behind a `Model Provider` interface, exactly like capability providers. The architecture should store model profiles, benchmark scores, cost, latency, context window, tool-use reliability, structured-output reliability, safety behavior, and privacy constraints.

## Model Strategy

### Recommended Model Classes

| Work Type               | Best Model Class                                                | Why                                                             |
| ----------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Strategic planning      | frontier reasoning model                                        | Highest quality for long-horizon decomposition and tradeoffs    |
| Normal planning         | balanced reasoning/chat model                                   | Lower cost for common plans                                     |
| Extraction              | small fast model or local model                                 | High volume, low ambiguity                                      |
| Tool selection          | tool-use-tuned model plus deterministic filters                 | Needs reliable schema following and permission fit              |
| Capability discovery    | strong model for first pass, smaller model for repeated parsing | Mixes semantic understanding and scale                          |
| RAG retrieval           | embedding model plus reranker                                   | Cheaper and more precise than asking a large model to remember  |
| Graph construction      | extraction model plus deterministic entity resolver             | Prevents hallucinated graph writes                              |
| Code generation         | code-capable reasoning model                                    | Better at edits, tests, and system design                       |
| Browser/desktop UI      | multimodal/computer-use model plus driver assertions            | UI state needs vision plus deterministic checks                 |
| Governance review       | strong reasoning model plus hard policy engine                  | Policy must be deterministic; explanation can be model-assisted |
| Experience distillation | medium model with critic review                                 | Converts many memories into reusable heuristics                 |

### OpenAI Baseline

For an OpenAI-first baseline, use the strongest current reasoning model for high-risk planning and architecture, a balanced model for routine agent work, and smaller models for routing/extraction. The OpenAI model docs currently list GPT-5.5 as the flagship model for coding, agentic task execution, and long-context reasoning, GPT-5.4 for complex reasoning and coding, and GPT-5.4 mini/nano variants for efficient and low-latency work.

OpenAI's Agents SDK and Responses API are relevant for Atlas because they provide model calls, tools, handoffs, sessions, guardrails, and tracing. Atlas should still keep its own capability kernel and governance layer above any vendor-specific agent framework.

### Multi-Provider Policy

Atlas should support multiple model providers from the beginning, but it should not hard-code one provider into pillar logic.

Store:

- `model_id`
- `provider`
- `supported_modalities`
- `context_window`
- `tool_call_score`
- `structured_output_score`
- `cost_per_input_token`
- `cost_per_output_token`
- `latency_p50`
- `latency_p95`
- `privacy_tier`
- `benchmark_scores`
- `allowed_data_classes`

Then route by task:

```text
Task
-> required capability
-> model profile filter
-> benchmark score
-> cost/latency budget
-> governance constraints
-> selected model provider
```

## Pillar Build Strategy

### 1. Brain Engines

Build the Brain as multiple engines rather than one monolithic agent:

- Intent Engine
- Planning Engine
- Context Builder
- Reflection Engine
- Simulation Planner
- Explanation Engine
- Prompt/Instruction Compiler

Use ReAct-style reasoning/action loops for tool-grounded planning, Tree of Thoughts only for high-complexity branching, and Reflexion-style feedback loops for improvement after execution failures.

Implementation rule: the Brain proposes plans, but the Capability Kernel resolves execution and Governance decides authority.

### 2. Capability Kernel

Build this mostly deterministic:

- capability request normalization
- provider filtering
- permission fit
- policy risk
- input/output schema compatibility
- cost and latency scoring
- provider reputation
- fallback selection

Use models only to interpret ambiguous capability requests, explain rankings, and detect semantic equivalence between requested and known capabilities. Provider ranking should be auditable and reproducible.

### 3. Autonomous Goal Ownership Engine

Build AGOE as an event-sourced goal state machine:

- proposed
- active
- waiting
- blocked
- recovering
- completed
- cancelled

Models help decompose goals, identify blockers, propose recovery paths, and summarize progress. They should not own the state transition rules.

### 4. Semantic World Model

Build SWM as a knowledge graph plus provenance system:

- entities
- relationships
- attributes
- temporal validity
- confidence
- source evidence
- permission context

Use extraction models to propose entities and relationships. Use deterministic validation, identity resolution, and governance review before trusted graph writes.

### 5. World State

Build World State as a current projection over events:

- active goals
- active executions
- deadlines
- blockers
- incidents
- waiting states
- workload

Models can summarize, detect likely stale state, and suggest missing context. The current operational snapshot itself should come from deterministic event projection.

### 6. Memory

Build Memory as append-first evidence storage:

- raw events
- conversations
- executions
- approvals
- rejections
- corrections
- meetings
- failures

Use embeddings for retrieval, summaries for compression, and source links for provenance. Never let summarized memory replace raw memory.

### 7. Experience Engine

Build Experience as distilled professional knowledge:

- heuristics
- playbooks
- anti-patterns
- decision patterns
- risk patterns

Use scheduled distillation jobs over Memory. Require evidence links and confidence scores. High-impact experience artifacts need governance review before they influence planning.

### 8. Capability Graph

Build the graph as Atlas's map of what can be done:

- capability ontology
- dependencies
- compositions
- providers
- interface drivers
- confidence ladder
- maturity stage

Use Toolformer/ToolLLM-style research as inspiration for tool and API learning, but keep Atlas capability-first. Tool names, application names, and vendor names belong at the provider/interface-driver layer, not the capability layer.

### 9. Identity Engine

Build Identity as a conservative resolver:

- human identities
- organizations
- systems
- providers
- aliases
- roles
- delegations
- external accounts

Use deterministic identifiers where available. Use models only to propose likely matches with confidence. Unsafe merges require review.

### 10. Self Model

Build Self Model as calibrated capability awareness:

- what Atlas can do
- confidence by capability/provider/interface
- known limitations
- known failure modes
- granted authority
- resource limits
- subsystem maturity

Update it from execution outcomes, benchmarks, and reviewed experience artifacts. Use calibration metrics to prevent overconfidence.

### 11. Learning & Governance System

Build this as a hard policy engine plus model-assisted reviewers:

- Critic
- Defender
- Judge
- policy engine
- approval workflows
- audit logs
- promotion gates

Policy decisions must be deterministic and auditable. Models can write explanations, detect risks, compare plans, and propose policy updates. Prompt-injection and indirect instruction attacks must be treated as first-class risks for every interface driver.

### 12. Cognitive Loop

Build the Cognitive Loop as a bounded orchestrator:

```text
observe
-> update world state
-> update SWM
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

The loop should have budgets for tokens, wall-clock time, cost, retries, and authority. It should not run unbounded autonomous cycles.

## Efficiency Strategy

Use these techniques from the start:

- model routing and cascades
- retrieval before generation
- structured outputs
- prompt caching where supported
- deterministic validators
- small-model extraction
- batch jobs for offline distillation
- async execution for slow research tasks
- speculative decoding for self-hosted models
- local models for private/simple classification
- benchmark-based promotion before using expensive models in production

## Benchmark Strategy

Atlas needs internal benchmarks because public leaderboards do not measure the whole system.

Baseline external benchmarks to watch:

- BFCL for function/tool calling
- SWE-bench Verified for coding agents
- Mind2Web for web interaction
- OSWorld for desktop/computer-use agents
- RAG and GraphRAG evaluations for retrieval and synthesis

Atlas-specific MVP benchmark:

```text
Unknown business system
-> documentation/API/OpenAPI/MCP/UI/SDK
-> learned entities
-> learned capabilities
-> generated interface drivers
-> generated provider manifests
-> tests
-> benchmark: Create Resource
```

Primary metrics:

- task success rate
- unsafe action prevention rate
- approval precision
- cost per successful task
- latency p50/p95
- recovery rate after failure
- hallucinated capability rate
- provider selection regret
- graph confidence calibration
- human correction count

## Emerging Model Research Tracks

### Nemotron 3 For Agentic Reasoning Backbone

Research status: remote optional lane accepted for experimentation.

Initial read: Nemotron 3 is relevant to Atlas because it is explicitly positioned around agentic, reasoning, conversational, and multi-step tool-use workloads. The reported family includes Nano, Super, and Ultra variants, with hybrid Mamba-Transformer Mixture-of-Experts architecture, up to 1M-token context, granular reasoning-budget control, and planned open release of weights, recipes, and redistributable data.

Implementation decision: Atlas should not depend on Nemotron as the default local backbone. Instead, Atlas should expose NVIDIA NIM as an optional `remote-deep-reasoning` model lane for high-difficulty public/internal requests. The current candidate profile is `nvidia/nemotron-3-super-120b-a12b` through NVIDIA's OpenAI-compatible endpoint. Local Qwen-style routing remains the default lane.

Remote lane gates:

- difficulty is `high` or `critical`;
- task class is architecture, governance review, hard debugging, or research synthesis;
- privacy class is `public` or `internal`;
- remote models are explicitly allowed;
- free hosted endpoints are explicitly allowed;
- context is bounded and source-referenced, not raw memory or confidential dumps.

Why it matters for Atlas:

- Atlas needs a private or self-hostable reasoning backbone for Brain Engines, planning, reflection, code generation, and high-volume agent work.
- A model family with small, medium, and large tiers maps cleanly onto Atlas model routing: Nano for cheap extraction/routing, Super for collaborative agent work, Ultra for high-risk planning and deep reasoning.
- The open-weight direction fits Atlas's provider-agnostic design and avoids hard dependency on one closed model vendor.

Research questions:

- Can Nemotron 3 reliably produce strict ACR, AtlasFlow, and AtlasIR structured outputs?
- How does its tool-use reliability compare against frontier closed models on Atlas-specific tasks?
- Does the 1M-token context reduce retrieval pressure, or does Atlas still get better cost and correctness from ACR references plus retrieval?
- Can reasoning-budget control become an input to the Atlas model router?
- What hardware/runtime stack is required for local or private deployment at acceptable latency?
- What quota/rate limits apply to the free hosted endpoint under Atlas planning workloads?

Proposed experiment:

```text
Atlas planning benchmark
-> same goal and bounded context packet
-> compare Nemotron 3 tier vs current frontier baseline
-> measure structured-output validity, plan correctness, tool-use validity, latency, cost, and governance explanation quality
```

### Inkling And Tinker For Adaptive Specialist Models

Research status: open, high priority.

Initial read: Inkling/Tinker is relevant to Atlas because it is aimed at open-weight customization and fine-tuning rather than only renting a frozen general model. That matches Atlas's plan to create smaller specialists for repeated sites, domains, and task families.

Atlas should not treat Inkling as the default Brain. The stronger fit is a specialist training provider:

```text
Site or domain usage
-> interface observations
-> Memory and Experience
-> Capability Graph
-> provider execution traces
-> curated specialist dataset
-> Tinker/Inkling or similar training provider
-> benchmarked Interface Specialist
-> specialist provider registered in Atlas
```

Potential Atlas uses:

- fine-tune an `abc.com` Interface Specialist after Atlas has repeatedly operated that site;
- fine-tune an OpenAPI-to-provider synthesis specialist;
- fine-tune an ACR/AtlasFlow structured-output specialist;
- fine-tune a user cognitive-style specialist for communication and planning preferences;
- fine-tune task-family specialists such as code review, deployment planning, document ingestion, or browser workflow mapping.

Governance rule:

```text
No private data enters a training job without explicit policy approval.
No specialist is promoted without benchmark evidence.
No specialist bypasses deterministic validators, tests, or provider ranking.
```

Research questions:

- Can Inkling/Tinker produce strict ACR, AtlasFlow, and AtlasIR examples more reliably than prompting plus retrieval?
- Does fine-tuning a site specialist reduce cost and latency enough to justify training?
- Can Atlas export or self-host resulting adapters or weights?
- What data governance controls exist for hosted fine-tuning?
- How should Atlas detect site/API drift and retire stale specialists?
- Which tasks benefit from fine-tuning, and which are better served by retrieval plus deterministic interface maps?
- Can specialist models improve UI grounding or field mapping without memorizing sensitive data?

Evaluation plan:

```text
Build a synthetic unknown system
-> collect 50-200 task traces
-> create specialist dataset
-> train/fine-tune candidate specialist
-> compare against general local model + retrieval
-> compare cost, latency, success rate, structured-output validity, and drift behavior
```

### TurboQuant For Long-Context KV-Cache And Memory Compression

Research status: open.

Initial read: TurboQuant is an online vector quantization method from Google Research/Google DeepMind researchers. It targets high-dimensional vector compression, KV-cache quantization, and nearest-neighbor search, with reported quality-neutral KV-cache compression around 3.5 bits per channel and marginal degradation around 2.5 bits per channel. Follow-on reporting describes Google positioning it as a training-free method that can reduce KV-cache memory by at least 6x and improve attention-logit computation on Nvidia H100-class hardware.

Why it matters for Atlas:

- Atlas cannot afford to send full history or long prompt state through a large model on every pillar call.
- TurboQuant-style compression could matter in two places: model serving KV-cache efficiency and vector/search storage efficiency.
- It strengthens the case for Atlas's current design: store durable cognition externally as ACR/ACT/ACES, retrieve compact relevant context, and use compression only for active inference/runtime acceleration.

Research questions:

- Is TurboQuant available in a production-ready implementation or only as research?
- Can it be integrated into vLLM, TensorRT-LLM, SGLang, or another serving stack Atlas might use?
- Does it preserve accuracy for tool-use, JSON/schema outputs, and long-context retrieval-heavy prompts, not just generic long-context benchmarks?
- Can similar quantization be used for Atlas embedding/vector indexes without hurting recall for Memory and Experience retrieval?
- What workload threshold makes KV-cache compression worth the added complexity?

Proposed experiment:

```text
Long-context Atlas context packets
-> uncompressed KV-cache baseline
-> TurboQuant or closest available KV-cache quantization baseline
-> measure context length, throughput, p95 latency, output validity, retrieval accuracy, and hallucinated-reference rate
```

### LocateAnything For Desktop Vision Grounding

Research status: open.

Initial read: LocateAnything is a recent vision-language grounding and detection framework that introduces Parallel Box Decoding. Instead of serializing 2D boxes as independent coordinate tokens, it decodes boxes and points as atomic geometric units, improving localization quality and decoding throughput. The paper also reports a large LocateAnything-Data training set with more than 138 million samples.

Why it matters for Atlas:

- Atlas's Browser UI and Desktop UI interface drivers need fast, precise grounding from instruction to screen element.
- UI control becomes laggy when every click requires expensive sequential visual reasoning.
- A fast grounding model can act as a specialist provider under a higher-level planner: the Brain decides intent, the Interface Driver observes the screen, the grounding model proposes target coordinates, and deterministic driver checks verify action safety.

Research questions:

- Does LocateAnything work well on GUI screenshots, or is it primarily general object/region grounding?
- Can it localize small UI controls on high-resolution desktop screens?
- Does it support point targets, bounding boxes, and text-conditioned grounding with enough latency for interactive desktop control?
- Can Atlas combine LocateAnything with OCR/accessibility-tree data for higher confidence?
- What is the failure mode on dense enterprise UIs, remote desktops, dark themes, and scaled Windows displays?

Proposed experiment:

```text
Desktop UI grounding benchmark
-> screenshots + target instructions
-> LocateAnything proposals
-> OCR/accessibility-tree cross-check
-> execute only when target confidence and policy checks pass
```

### Compare LocateAnything With Existing UI Grounding Models

Research status: open.

Initial read: Existing GUI grounding research already shows that computer-use agents fail when grounding is weak. SeeClick focuses on screenshot-only GUI grounding, ScreenSpot-Pro shows professional high-resolution GUI grounding remains hard, Agent S2 uses a compositional generalist/specialist framework and mixture-of-grounding, and GroundCUA/GroundNext emphasizes expert human demonstrations for desktop grounding.

Why it matters for Atlas:

- LocateAnything may be excellent at general visual grounding, but Atlas needs GUI-specific grounding and safe computer control.
- The best architecture is likely not one vision model. It is a grounding cascade: accessibility tree, OCR, UI-specific model, general grounding model, deterministic coordinate validation, then execution.
- The Capability Kernel should treat grounding models as providers with cost, latency, permission, confidence, and Experience scores.

Comparison candidates:

- LocateAnything for fast general visual grounding and detection.
- SeeClick for screenshot-only GUI grounding.
- ScreenSeekeR/ScreenSpot-Pro methodology for high-resolution professional UI evaluation.
- Agent S2 style mixture-of-grounding for planner plus specialist delegation.
- GroundCUA/GroundNext-style desktop grounding data and models.
- OCR plus OS accessibility APIs as deterministic non-model baselines.

Proposed experiment:

```text
Grounding provider shootout
-> same UI task corpus
-> each provider returns target box/point + confidence + evidence
-> driver verifies target through OCR/accessibility/DOM where available
-> score success, false-click rate, latency, cost, and recovery behavior
```

Decision rule:

Atlas should not adopt a desktop vision model because it is impressive in isolation. It should adopt whichever provider or provider cascade gives the best safe-action rate under latency and cost budgets.

## Papers And Research To Use

| Area                          | Paper / Source                                                   | Use In Atlas                               |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| Reasoning + acting            | ReAct: Synergizing Reasoning and Acting in Language Models       | Brain tool-grounded planning               |
| Search over reasoning         | Tree of Thoughts                                                 | High-risk branching plans                  |
| Agent self-improvement        | Reflexion                                                        | Post-execution learning loops              |
| Persistent simulated behavior | Generative Agents                                                | Memory, reflection, behavior modeling      |
| RAG                           | Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks | Knowledge and Memory retrieval             |
| Graph RAG                     | From Local to Global: A GraphRAG Approach                        | SWM and graph-grounded synthesis           |
| Tool learning                 | Toolformer                                                       | Capability/interface discovery inspiration |
| API/tool benchmarks           | ToolLLM                                                          | Capability provider learning and testing   |
| Web agents                    | Mind2Web                                                         | Browser UI driver evaluation               |
| Computer-use agents           | OSWorld                                                          | Desktop/UI execution evaluation            |
| Cost routing                  | FrugalGPT / RouteLLM                                             | Model routing and cascades                 |
| Governance/safety             | Constitutional AI                                                | Critic/Defender/Judge inspiration          |
| Prompt injection              | Indirect prompt-injection research                               | Interface driver security                  |
| Agentic open models           | NVIDIA Nemotron 3                                                | Private/self-hosted reasoning provider     |
| Specialist fine-tuning        | Inkling / Tinker                                                 | Adaptive Interface Specialist candidate    |
| KV-cache compression          | TurboQuant                                                       | Long-context inference and vector memory   |
| Desktop vision grounding      | LocateAnything                                                   | Fast UI element localization candidate     |
| GUI grounding                 | SeeClick, ScreenSpot-Pro, Agent S2, GroundCUA/GroundNext         | Desktop control provider comparison        |

## Immediate Implementation Next Steps

1. Add `packages/core/src/model-profiles.ts` with `ModelProfile`, `ModelBenchmarkScore`, and `ModelRoutingDecision`.
2. Add `packages/core/src/capability-contracts.ts` with capability, provider, driver, and benchmark contracts.
3. Add an internal `docs/research/benchmark-plan.md`.
4. Add a deterministic model router package before using models in runtime flows.
5. Add an evaluation fixture for the unknown business system MVP.

## References

- OpenAI model docs: https://platform.openai.com/docs/models
- OpenAI Agents SDK docs: https://platform.openai.com/docs/guides/agents
- Artificial Analysis model leaderboard: https://artificialanalysis.ai/leaderboards/models
- Berkeley Function Calling Leaderboard: https://gorilla.cs.berkeley.edu/leaderboard.html
- SWE-bench: https://www.swebench.com/
- ReAct: https://arxiv.org/abs/2210.03629
- Tree of Thoughts: https://arxiv.org/abs/2305.10601
- Reflexion: https://arxiv.org/abs/2303.11366
- Generative Agents: https://arxiv.org/abs/2304.03442
- Retrieval-Augmented Generation: https://arxiv.org/abs/2005.11401
- GraphRAG: https://arxiv.org/abs/2404.16130
- Toolformer: https://arxiv.org/abs/2302.04761
- ToolLLM: https://arxiv.org/abs/2307.16789
- Mind2Web: https://arxiv.org/abs/2306.06070
- OSWorld: https://arxiv.org/abs/2404.07972
- FrugalGPT: https://arxiv.org/abs/2305.05176
- RouteLLM: https://arxiv.org/abs/2406.18665
- Constitutional AI: https://arxiv.org/abs/2212.08073
- Indirect prompt injection: https://arxiv.org/abs/2302.12173
- NVIDIA Nemotron 3: https://arxiv.org/abs/2512.20856
- Nemotron 3 Nano Omni: https://arxiv.org/abs/2604.24954
- TurboQuant: https://arxiv.org/abs/2504.19874
- KVQuant: https://arxiv.org/abs/2401.18079
- LocateAnything: https://arxiv.org/abs/2605.27365
- SeeClick: https://arxiv.org/abs/2401.10935
- ScreenSpot-Pro: https://arxiv.org/abs/2504.07981
- Agent S2: https://arxiv.org/abs/2504.00906
- GroundCUA/GroundNext: https://arxiv.org/abs/2511.07332
