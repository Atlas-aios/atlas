# Simulation Plan Comparison Design

**Status:** Approved implementation slice

## Purpose

Atlas can simulate one capability action against an isolated World State branch. It
now needs to compare multiple simulated plans without asking an LLM to make an opaque
choice or treating selection as execution permission.

## Chosen Architecture

`@atlas-aios/simulation-engine` owns deterministic comparison because it already owns
World State simulation results and metrics. Runtime resolves persisted simulation ids,
calls the pure comparator, stores the result, and records Memory and Audit evidence.

Alternatives rejected:

1. LLM-as-judge selection. It is expensive, non-deterministic, and difficult to replay.
2. Pareto-only output. It exposes trade-offs but does not produce the ranked selection
   needed by planning; Pareto analysis can be added later as supplementary evidence.
3. Runtime-only scoring. That would hide domain logic inside the HTTP adapter and make
   it unavailable to Brain and future Simulation Planner consumers.

## Candidate Contract

Each candidate contains:

- a unique plan id;
- one completed World State simulation result;
- estimated total cost;
- estimated total latency;
- confidence in the plan and provider evidence.

Candidates must reference unique simulations and share the same source World State
snapshot. This slice compares one aggregate simulation per candidate. Sequential
multi-step branch composition remains separate work.

## Explicit Comparison Policy

The caller supplies:

- maximum cost;
- maximum latency;
- minimum confidence;
- maximum blocker increase;
- maximum critical-blocker increase;
- non-negative weights for confidence, cost, latency, blocker growth, and critical
  blocker growth.

At least one weight must be positive. Limits are not inferred from environment names,
providers, or application-specific conventions.

## Eligibility And Scoring

A candidate is ineligible when its simulation is blocked or failed, it violates a
policy limit, or it lacks a projected snapshot. Ineligible candidates remain in the
result with machine-readable rejection reasons but cannot be selected.

Eligible component scores are normalized to `[0, 1]` against explicit policy limits:

- confidence uses the candidate confidence directly;
- cost and latency reward remaining budget;
- blocker components reward no increase and penalize increases toward the ceiling.

The total score is the weighted mean. Ties are resolved by higher confidence, lower
cost, lower latency, then lexical plan id. The result includes every component score,
total score, rank, evidence references, and selected plan id when an eligible candidate
exists.

## Runtime API

- `POST /simulations/compare` creates an immutable comparison record.
- `GET /simulations/comparisons` lists stored comparisons.

The create request references persisted Runtime simulation ids. Duplicate comparison
ids return conflict rather than overwriting prior evidence. Runtime stores comparison
records in its state snapshot and records the selected plan as Memory and Audit
evidence.

## Governance Boundary

A selected plan is a planning recommendation. It does not approve, resume, or execute
a plan run. The chosen plan must still pass Decision Engine, Execution Gate,
simulation-evidence binding, approval, and Cognitive Loop execution continuation.

## Non-goals

- automatic execution;
- LLM judgment;
- probabilistic outcome models;
- sequential multi-step simulation composition;
- organization-wide budget accounting;
- Pareto-front visualization.
