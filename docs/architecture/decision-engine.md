# Decision Engine

Atlas should be powerful enough to do anything that can be done, but it should not act blindly. The Decision Engine is the reasoning gate between planning and execution.

It is not a restriction-first governance layer. It is an authority and judgment layer.

## Purpose

Atlas gives the Decision Engine:

- what it is trying to achieve
- what action it wants to take
- why the action is needed
- expected outcome
- inputs and affected entities
- risks
- reversibility
- alternatives
- required capabilities/providers
- current world state
- relevant user preferences

The Decision Engine returns a decision:

- approve
- approve with constraints
- discuss with user
- suggest safer or better alternative
- simulate first
- reject
- delegate to human

## Flow

```text
Goal
-> Brain plans
-> Capability Kernel resolves capability/provider
-> Decision Engine reviews intent, action, risks, alternatives, and authority
-> Execution Gate maps the decision into execution readiness
-> Execution Engine acts
-> Memory records result
-> Memory can reject a proposed decision from prior evidence
-> Decision Engine reconsiders with the Memory rejection reason
-> Experience Engine learns decision patterns
```

## Decision Request

`DecisionRequest` should include:

- goal id
- proposed action
- action type
- capability id
- provider id
- rationale
- inputs
- affected entities
- expected outcome
- risks
- reversibility
- external impact
- alternatives
- evidence refs
- requester identity
- current authority mode

## Decision Outcome

`DecisionOutcome` should include:

- outcome type
- rationale
- constraints
- required user discussion points
- suggested alternative
- simulation requirement
- approval requirement
- audit severity
- source evidence refs

## Default Deterministic Engine

The initial implementation lives in `@atlas-aios/decision-engine`.

It implements deterministic baseline outcomes:

- `approve` for low-risk reversible local actions
- `approve_with_constraints` for communication drafts
- `discuss` for destructive or irreversible actions
- `simulate_first` for production or high-impact external actions
- `reject` for explicitly forbidden or rejection-required risks
- `delegate_to_human` for human-only decisions

This engine is intentionally simple. It provides a safe, auditable baseline while later versions can incorporate user preferences, Memory, Experience, Self Model confidence, and richer simulations.

## Execution Gate Integration

The initial execution integration lives in `@atlas-aios/execution-engine`.

The execution package does not re-decide the action. It accepts a `DecisionOutcome` and maps it to an execution gate result:

- `approve` -> ready to execute
- `approve_with_constraints` -> ready to execute with constraints attached
- `discuss` -> waiting for discussion
- `suggest_alternative` -> waiting for plan revision
- `simulate_first` -> waiting for simulation
- `reject` -> blocked by decision
- `delegate_to_human` -> waiting for human delegation

This keeps judgment in the Decision Engine while giving the Execution Engine a deterministic state transition before any provider call is allowed.

## Memory Feedback Loop

The Memory package records `DecisionOutcome` values as immutable Memory events. These records provide evidence for future decisions.

If Memory rejects a proposed decision because prior evidence shows the action is unsafe, duplicate, stale, or contradicted by past execution, Atlas does not execute directly from Memory. Memory creates a reconsideration request that goes back through the Decision Engine with:

- the original action and rationale
- the Memory rejection reason
- Memory evidence refs
- a `memory_rejection` risk

The default Decision Engine treats a blocking `memory_rejection` risk as a rejection and preserves the Memory reason in the outcome rationale. This keeps Memory as evidence and Decision Engine as the judgment layer.

## Simulation And Approval Evidence

Decision requests may include a deterministic provider simulation requirement plus
simulation and approval evidence references. The default engine applies a three-step
transition:

```text
simulation required without evidence -> simulate_first
simulation evidence without approval -> delegate_to_human
simulation plus approval evidence -> approve_with_constraints
```

The final constraints bind execution to the exact simulated provider, capability, and
inputs. Runtime must re-enter Decision Engine after approval; it cannot change an
Execution Gate from waiting to allowed by itself.

## Risk Model

The Decision Engine should classify risk without assuming Atlas is forbidden from acting.

High-impact signals:

- spending money
- changing production systems
- making legal commitments
- sharing confidential information
- contacting another human or organization
- deleting or overwriting data
- publishing externally
- escalating privileges
- controlling a real desktop outside a sandbox

## Examples

```text
Action: delete generated cache files
Decision: approve
Reason: local, reversible, low impact
```

```text
Action: delete repository branch
Decision: discuss
Reason: destructive and may remove collaboration history
Better path: archive branch or confirm merged status first
```

```text
Action: modify production infrastructure
Decision: simulate first
Reason: external system impact and rollback risk
Constraint: produce plan, risk analysis, and rollback before execution
```

```text
Action: send vendor email
Decision: approve with constraints
Constraint: draft message first and do not include confidential data
```

## Relationship To Governance

Governance remains the durable policy and audit system. The Decision Engine is the active reviewer that uses policy, memory, experience, world state, and user preferences to decide how Atlas should proceed.

The key principle:

```text
Atlas can attempt anything technically possible.
The Decision Engine decides whether to act now, act with constraints, discuss, improve the plan, simulate, reject, or delegate.
```
