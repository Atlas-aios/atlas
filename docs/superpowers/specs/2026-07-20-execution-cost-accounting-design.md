# Execution Cost Accounting Design

**Status:** Approved implementation slice

## Purpose

Atlas can maintain budgets and compare plans against available funds, but governed plan
execution does not yet reserve or settle cost. This slice makes cost accounting part of
the same plan-run path that already enforces capability resolution, simulation,
Decision Engine outcomes, approval, and the Execution Gate.

## Approaches Considered

### Whole-plan reservation

Reserve the sum of selected-provider estimates immediately before AtlasFlow starts,
then settle aggregate metered usage after execution. This prevents a plan from starting
when only its first steps are affordable and keeps accounting outside provider-specific
code. This is the chosen approach.

### Per-step reservation

Reserve before every node. This uses less capital for long plans, but a later step can
run out of budget after earlier irreversible work has completed. It also requires a
deeper scheduler integration.

### After-the-fact settlement only

Record cost after execution without reserving. This is simplest but permits budget
oversubscription and is rejected.

## Plan Contract

Every Runtime plan-run request declares:

- `budgetId`: the Internal Economy budget that authorizes resource use;
- `costUnit`: the unit used by every selected-provider estimate in that plan.

Runtime verifies that the budget exists and uses the same unit. Provider estimates are
already present in Capability Kernel resolution evidence. The orchestrator sums the
selected candidate estimate for each step and reserves that amount only after all
Decision Engine, simulation, approval, and Execution Gate requirements allow execution.

Waiting, blocked, rejected, or discussion-required runs do not reserve funds.

## Metered Usage Contract

`ExecuteWorkflowNodeResult` and persisted step results gain optional `resourceUsage`:

- non-negative `cost`;
- explicit `unit`;
- evidence reference identifying the meter or provider report.

Cost-accounted plan execution requires usage from every completed capability step and
requires all usage units to match the plan cost unit. The deterministic unknown-system
fixture reports its configured per-call cost as fixture-metered evidence. This does not
claim to be external provider billing.

## Accounting Lifecycle

1. Resolve every capability and complete governance checks.
2. Sum selected-provider estimates.
3. Reserve the total against `budgetId` immediately before AtlasFlow starts.
4. Execute AtlasFlow.
5. Sum metered step usage.
6. Settle the reservation to actual usage. Unused reserved capacity is released by the
   existing settlement operation.

If execution throws before returning a result, Runtime releases the reservation. If a
workflow returns failed after incurring usage, Runtime settles the reported usage. If
usage evidence is missing, has a different unit, or exceeds the reservation, the run is
recorded as failed with an accounting failure and the reservation remains active for
human reconciliation; Atlas does not invent a cost or silently release potentially
spent funds.

## Idempotency And Persistence

Reservation id: `reservation:plan-run:<runId>`.

Settlement id: `settlement:plan-run:<runId>`.

Release id: `release:plan-run:<runId>`.

The Internal Economy already makes identical commands idempotent and rejects conflicting
reuse. PlanRun stores the reservation id and final accounting status so retries and
restart inspection remain deterministic. Ledger, Audit, and Memory evidence use the
existing Runtime accounting path.

## Governance Boundary

Budget availability never grants permission to execute. Reservation occurs only after
Decision Engine, simulation, approval, and Execution Gate requirements are satisfied.
Likewise, approval does not bypass insufficient-funds rejection.

## Non-goals

- provider invoice reconciliation;
- currency conversion;
- hierarchical parent-budget enforcement;
- dynamic estimate updates during execution;
- per-step reservation;
- allowing actual usage above the authorized reservation.
