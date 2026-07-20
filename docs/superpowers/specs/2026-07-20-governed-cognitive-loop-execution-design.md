# Governed Cognitive Loop Execution Design

**Status:** Approved implementation slice

## Purpose

The bounded Cognitive Loop can now identify a goal, require simulation, and propose
capability dispatch. It still records every execute phase as skipped. This slice lets
an evidence-backed cycle continue through the already implemented governed plan-run
path without creating a second execution system.

## Chosen Architecture

The pure `@atlas-aios/cognitive-loop` package owns an immutable execution continuation.
Runtime owns orchestration because it already owns persisted cycles, plan runs,
approvals, providers, AtlasFlow execution, Memory, and Audit.

Alternatives rejected:

1. Execute directly inside `runBoundedCognitiveLoopCycle`. This would make a pure
   deterministic package depend on providers and persistence.
2. Mark execution complete when a dispatch is recommended. A recommendation is not
   evidence that an action occurred.
3. Create a second workflow runner for the loop. The existing plan orchestrator,
   Decision Engine, Execution Gate, and AtlasFlow path remain the only execution path.

## Cognitive Loop Continuation

`completeCognitiveLoopExecution` receives an unexecuted cycle whose next action is
`dispatch_capability` and an actual execution outcome. It returns a defensive copy
with:

- `executedAction: true`;
- `actionTaken` containing the original dispatch targets, execution id, status,
  timestamp, and evidence;
- an execute phase marked `completed` or `failed`;
- an evaluation phase grounded in execution evidence;
- `rest` as the next action after success;
- `review_execution` as the next action after failure.

The source cycle is never mutated. Completing a blocked, learning, simulation, or
already-executed cycle is rejected with a typed error.

## Runtime Execution Contract

Runtime exposes:

`POST /cognitive-loop/cycles/:cycleId/execute`

The body contains `planRunId` and `executedAt`. Runtime allows continuation only when:

- the cycle exists and recommends dispatch;
- the plan run exists and belongs to the same goal;
- the cycle target capability matches the first plan-run step;
- every plan-run simulation id is present in the cycle observations;
- every required approval is approved;
- the plan run is waiting for approval or already completed.

A waiting plan run is reconsidered through the existing Decision Engine and resumed
through the existing AtlasFlow/provider execution path. A completed matching plan run
is recorded without re-execution. Mismatches return conflict responses and cause no
provider side effects.

## Idempotency And Evidence

Once a cycle records an action for a plan run, repeating the same request returns the
stored cycle and plan run. A different plan run for the executed cycle is rejected.
Runtime records dedicated Audit and Memory evidence containing cycle, plan,
simulation, approval, and execution references.

## Failure Handling

- Missing or malformed request: `400`.
- Missing cycle or plan run: `404`.
- Cycle/run/evidence mismatch or unsatisfied approval: `409`.
- Governed execution failure: the cycle records a failed execute phase and requests
  execution review; transport or invariant errors return `422` when no trustworthy
  outcome can be recorded.

## Non-goals

- selecting a plan run automatically;
- bypassing approval or Decision Engine reconsideration;
- background scheduling across multiple cycles;
- retrying failed provider execution from the Cognitive Loop;
- multi-plan comparison.

Those remain separate slices so this contract stays exact and auditable.
