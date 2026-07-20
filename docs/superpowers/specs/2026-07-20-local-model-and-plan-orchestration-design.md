# Local Model And Governed Plan Orchestration Design

**Status:** Approved by the user's explicit request to implement this slice

## Goal

Make routine and private Atlas planning usable through a real local OpenAI-compatible model endpoint, then connect generated plans to Capability Kernel resolution, Decision Engine review, interface simulation, approval, and sequential AtlasFlow execution.

## Chosen Architecture

Three approaches were considered:

1. Add a focused orchestration module inside Runtime. This reuses current stores and integration functions without changing pillar ownership.
2. Create a new orchestration package. This would create broad dependencies on Brain, Kernel, Decision Engine, Execution Engine, workflow, and drivers before a stable service boundary exists.
3. Put orchestration directly in Cognitive Loop. This would couple the loop package to runtime provider implementations and persistence.

The first approach is selected for the MVP. Brain remains provider-neutral, Decision Engine remains the judgment owner, Execution Engine remains the workflow owner, and Runtime coordinates their existing contracts. The module can move behind a service boundary once persistence and queues are production-ready.

## Local Provider

`@atlas-aios/brain` will expose a generic OpenAI-compatible planning provider. It sends the existing bounded system and user prompts to:

```text
POST {baseUrl}/chat/completions
```

Runtime configures the provider only when `ATLAS_LOCAL_MODEL_ID` is present. `ATLAS_LOCAL_MODEL_BASE_URL` defaults to `http://127.0.0.1:11434/v1`, which supports an Ollama OpenAI-compatible server, but any compatible vLLM, LM Studio, SGLang, NIM, or other endpoint may be configured. `ATLAS_LOCAL_MODEL_API_KEY` is optional.

No local response is fabricated. Connection failures become `502 model_provider_failed`; missing configuration remains `503 model_provider_unavailable`.

## Plan Run API

`POST /brain/plans/:planId/run` accepts a client-supplied idempotent run id, identity, authority mode, governance context, timestamp, and explicit policy/input data for every plan step. Atlas does not infer external impact or reversibility from prose.

For every step Runtime:

1. resolves the capability and ranked provider through Capability Kernel;
2. creates a deterministic `DecisionRequest` from the plan, provider resolution, declared impact, and risks;
3. evaluates the Decision Engine and Execution Gate;
4. blocks rejected or discussion-required actions;
5. runs the existing interface-driver dry-run when Decision Engine or Kernel requires simulation;
6. creates approval requests for simulated or provider-gated actions;
7. compiles all allowed steps into one sequential AtlasFlow;
8. executes that AtlasFlow only when every gate is allowed.

The existing REST simulation is a real request-preview dry run for supported learned REST providers. It is not a World State clone. The checklist item for a production Simulation Engine remains open.

## Simulation And Approval Reconsideration

`DecisionRequest` gains optional `simulationEvidenceRefs` and `approvalEvidenceRefs`.

- High-impact or provider-risk work without simulation evidence returns `simulate_first`.
- After successful simulation but before approval, it returns `delegate_to_human`.
- `POST /brain/plan-runs/:runId/resume` verifies approved Runtime approval requests, supplies both evidence sets to Decision Engine, and requests a fresh outcome.
- The reconsidered outcome may become `approve_with_constraints`; execution proceeds only if Execution Gate reports an allowed status.

This preserves the rule that Runtime cannot override Decision Engine merely because a simulation or approval exists.

## Plan Run State

Runtime persists each run with:

- run, plan, and goal ids;
- status: `preparing`, `waiting_for_approval`, `waiting_for_discussion`, `blocked`, `executing`, `completed`, or `failed`;
- per-step inputs, policy declaration, provider resolution, decisions, gates, simulation evidence, and approval reference;
- compiled AtlasFlow and Execution Engine result when execution begins;
- audit and Memory evidence references.

`GET /brain/plan-runs/:runId` exposes this state. Reusing a run id with different input is rejected with `409 plan_run_conflict`; reusing the same completed request returns the existing result.

## AtlasFlow Compilation

Each plan step becomes one `capability` node containing the resolved provider id, capability id, and caller-supplied inputs. Sequence edges preserve plan order. The Execution Engine invokes the existing runtime provider handler for every node, including retry, checkpoint, rollback, and compensation behavior already supported by that engine.

## Failure Rules

- Plan or goal missing: `404`
- Invalid or incomplete per-step policy/input declaration: `400`
- Provider cannot resolve: `422`
- Decision rejects: stored run with `blocked`, no provider call
- Discussion or human delegation: stored waiting run, no provider call
- Simulation blocked or failed: stored `failed`, no provider call
- Required approval not approved: `409 approval_not_satisfied`
- Workflow/provider failure: stored `failed` with Execution Engine evidence

## Testing

Tests inject HTTP fetchers and runtime providers; they do not call an external model or service. Red-green tests cover local wire format and response parsing, server configuration, low-risk plan execution, simulation and approval waiting, resume after approval, rejection without execution, AtlasFlow ordering, persistence, and idempotency.
