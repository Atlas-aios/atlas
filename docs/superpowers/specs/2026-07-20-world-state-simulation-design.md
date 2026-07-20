# World State Simulation Design

**Status:** Approved implementation slice

## Purpose

Atlas must evaluate a proposed capability action against an isolated projection of
operational reality before governance treats the action as simulated. Interface
Driver request preview remains useful, but it only proves that a request can be
constructed. This slice adds deterministic World State prediction and comparison.

## Chosen Architecture

A dedicated `@atlas-aios/simulation-engine` package owns simulation branches. It
depends on the World State contract, while World State remains the owner of live
snapshots. Runtime composes the Simulation Engine with Interface Driver preview.
Neither package calls providers or mutates live state.

Alternatives rejected for this slice:

1. Put cloning inside Runtime. This would hide a foundational engine inside an API
   adapter and make reuse by Brain and Cognitive Loop difficult.
2. Put simulation inside World State. World State should describe reality; creating
   counterfactuals and comparing outcomes is separate behavior.

## Simulation Contract

A simulation receives:

- a stable simulation id and timestamp;
- the immutable source World State snapshot;
- explicit predicted effects;
- optional thresholds for blocker growth and critical blockers.

Supported effects add or remove active goals, active executions, and operational
blockers. Effects are applied in order to a cloned branch. Duplicate additions and
removal of absent records are rejected as invalid simulations rather than silently
accepted.

The result contains the source snapshot id, projected snapshot, ordered effects,
before/after metrics, signed deltas, findings, evidence references, and one of:

- `passed`: the branch is valid and within thresholds;
- `blocked`: the branch is valid but violates a safety threshold;
- `failed`: an effect is invalid and no projected result may be used as evidence.

## Runtime Composition

Runtime simulation first previews the provider request through its Interface Driver.
Only a successful preview is followed by a World State branch. The runtime record
stores both artifacts. Decision Engine simulation evidence is emitted only when both
layers pass. Plan-run step policy carries explicit `predictedWorldStateEffects`; no
effect is guessed from capability or provider names.

## Cognitive Loop

Bounded Cognitive Loop observations may include simulation ids. Its simulate phase is
completed only when actual simulation evidence is present. A dispatch recommendation
without simulation evidence leaves the phase skipped and requests simulation as the
next governed operation. The execute phase remains explicit and does not infer that a
recommendation was executed.

## Persistence And Audit

Runtime snapshots persist complete simulation records. Existing snapshots remain
loadable because simulations default to an empty list. Simulation records are
append-or-replace by id and are included in Memory/Audit evidence through plan runs.

## Non-goals

- probabilistic environment emulation;
- provider-specific business logic;
- LLM-generated effects;
- committing a projected snapshot to live World State;
- automatic execution by the bounded Cognitive Loop.

These exclusions keep simulation deterministic, inspectable, and safe enough to
become governance evidence.
