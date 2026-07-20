# Model Routing

Atlas uses model lanes instead of one global model.

## Default Lane

The default lane is local-first:

```text
qwen-local-default
```

Use this for routine planning, private memory, confidential context, extraction, routing, and normal Brain/Kernel work.

## Optional Remote Deep Reasoning Lane

Atlas can optionally use NVIDIA's hosted NIM endpoint for difficult requests:

```text
nvidia/nemotron-3-super-120b-a12b
https://integrate.api.nvidia.com/v1
```

This lane is only eligible when all gates pass:

- the request difficulty is `high` or `critical`;
- the task class is architecture, governance review, hard debugging, or research synthesis;
- the privacy class is `public` or `internal`;
- remote models are explicitly allowed;
- free hosted endpoints are explicitly allowed.

The remote lane is not the default and must not receive raw private memory, confidential context, secrets, production credentials, or unbounded history dumps.

## Routing Rule

```text
request
-> deterministic privacy and task gates
-> local default unless every remote gate passes
-> bounded context packet
-> selected model provider
-> deterministic validation of structured output
```

The model router is a governance surface. Future changes that broaden remote eligibility must be reviewed as policy changes.

## NVIDIA NIM Client

`@atlas-aios/core` includes a small NVIDIA NIM chat-completion client contract:

- `buildNvidiaNimChatCompletionRequest` builds the OpenAI-compatible HTTP request.
- `callNvidiaNimChatCompletion` executes through an injected fetcher.

The injected fetcher keeps tests offline and allows runtime services to enforce their own retry, timeout, quota, audit, and secret-loading policies. Runtime services must source `NVIDIA_API_KEY` from the configured secret provider, never from code.

## Brain Integration

The Brain package exposes `selectPlanningModel` as its model-selection boundary. Brain callers provide task class, difficulty, privacy class, and remote-endpoint permissions; the helper returns a routing decision without exposing NVIDIA-specific implementation details to planning code.

This keeps Brain planning model-aware but provider-agnostic:

```text
Brain planning request
-> selectPlanningModel
-> core model router
-> local or remote lane decision
-> Brain execution path calls the selected model provider
```

## Implemented Runtime Path

`POST /brain/plan` now connects a stored Goal to the Brain model runtime:

```text
stored Goal
-> server-owned model policy
-> deterministic profile selection
-> configured provider invocation
-> bounded serialized context (maximum 16,000 characters)
-> strict JSON parsing and field validation
-> trusted Atlas plan and step ids
-> AtlasPlan plus routing metadata
```

The request supplies `goalId`, `taskClass`, `difficulty`, and `privacyClass`.
It cannot enable remote inference. The runtime reads remote permission only from:

```text
ATLAS_ALLOW_REMOTE_MODELS=true
ATLAS_ALLOW_FREE_HOSTED_MODEL_ENDPOINTS=true
NVIDIA_API_KEY=<secret>
```

The NVIDIA provider is configured only when all three values are present. Provider
credentials are never included in prompts or responses.

Model output may propose rationale, risks, capability ids, purposes, and approval
requirements. Atlas ignores model-supplied plan and step ids and constructs those
identifiers from trusted runtime state. Markdown-wrapped output, missing fields,
invalid field types, empty steps, and plans over 50 steps are rejected.

The local profile now uses a generic OpenAI-compatible provider. Runtime registers it
only when `ATLAS_LOCAL_MODEL_ID` is configured. The base URL defaults to
`http://127.0.0.1:11434/v1` and can be changed with
`ATLAS_LOCAL_MODEL_BASE_URL`; `ATLAS_LOCAL_MODEL_API_KEY` is optional. This supports
local servers that expose the OpenAI chat-completions contract without making Brain
depend on Ollama, vLLM, LM Studio, SGLang, or another serving implementation.

If no local model id is configured, routine, private, and confidential planning
returns `503 model_provider_unavailable`. Atlas does not substitute fixture output or
silently send private work to NVIDIA.

## Governed Plan Execution

A generated plan can enter Runtime through `POST /brain/plans/:planId/run`:

```text
stored AtlasPlan
-> Capability Kernel provider resolution
-> Decision Engine
-> Execution Gate
-> interface-driver dry-run when required
-> human approval when required
-> Decision Engine reconsideration with evidence
-> sequential AtlasFlow
-> Execution Engine
-> provider execution
-> Audit and Memory evidence
```

Simulation evidence is not permission. A simulated run remains
`waiting_for_approval` until the approval API records a human decision and
`POST /brain/plan-runs/:runId/resume` requests a fresh Decision Engine outcome.
Changed inputs under an existing run id are rejected using a stable request
fingerprint.

The current simulation is the real request-preview dry-run implemented by supported
Interface Drivers. It does not clone World State and does not complete the production
Simulation Engine roadmap item.

Current NVIDIA references:

- https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b
- https://docs.api.nvidia.com/nim/reference/llm-apis

## Adaptive Specialist Lane

Atlas should eventually train or fine-tune smaller specialist models for repeated sites, domains, and task families. These specialists are accelerators, not sources of truth.

Example:

```text
Repeated abc.com work
-> background interface learning
-> Site Knowledge Pack
-> Capability Graph and provider candidates
-> successful and failed executions
-> Memory and Experience artifacts
-> curated specialist dataset
-> fine-tuning provider such as Tinker/Inkling, when approved
-> benchmarked Interface Specialist
-> registered specialist provider
-> routed by Capability Kernel for future abc.com tasks
```

The specialist lane must obey these gates:

- do not train on private data without governance approval;
- do not promote a specialist without benchmark evidence;
- do not let a specialist bypass deterministic validation;
- keep ACR, Memory, Experience, Capability Graph, interface maps, and tests as the source of truth;
- monitor specialists for drift when the target site, API, or workflow changes;
- retire or demote stale specialists.

Specialists should help Atlas avoid relearning the same interface from scratch. They should not replace retrieval, evidence, tests, or provider ranking.

## Candidate Specialist Training Providers

Tinker/Inkling should be tracked as a candidate training provider for Atlas-specific specialists. The likely fit is not general default reasoning, but governed customization:

```text
ACR examples
AtlasFlow examples
provider synthesis examples
interface mapping examples
successful execution traces
corrections and rejected plans
-> fine-tuned specialist
```

Before adoption, Atlas needs benchmarks for strict structured output, provider generation, interface mapping, cost, latency, export/self-hosting options, privacy controls, and whether fine-tuning beats retrieval plus prompting for a specific task family.
