# Internal Economy Design

**Status:** Approved implementation slice

## Purpose

Atlas currently compares caller-supplied cost estimates, but it does not own a durable
budget or account for reserved and actual spend. The Internal Economy provides the
deterministic accounting boundary used by planning, provider selection, simulation,
and execution.

## Chosen Architecture

`@atlas-aios/internal-economy` owns a pure, append-only budget ledger. Runtime owns API
adaptation, persistence, identity enforcement, Memory evidence, and Audit evidence.

The ledger is denominated in caller-defined resource units. A unit can represent money,
model credits, compute credits, or another governed resource, but entries with different
units cannot share a budget. Currency conversion and provider billing ingestion remain
separate work.

## Budget Contract

A budget has:

- immutable id, scope type, scope id, resource unit, and limit;
- optional parent budget reference for future hierarchy support;
- settled spend;
- active reservations;
- available amount derived as `limit - settled spend - active reservations`;
- immutable ledger entries ordered by creation time and entry id.

This slice supports independent budgets. Parent references are descriptive until
hierarchical allocation is implemented.

## Accounting Commands

- `createBudget` creates an immutable budget.
- `reserveCost` atomically reserves an estimated amount for a goal, plan, execution, or
  provider invocation.
- `settleReservation` converts some or all of a reservation into actual settled spend.
- `releaseReservation` returns an unused reservation to available funds.

Reservation ids are unique within the economy state. Settlement or release is terminal.
Settlement cannot exceed the reserved amount. Duplicate commands with the same id and
identical payload return the existing result; conflicting reuse is rejected.

## Runtime API

- `POST /economy/budgets`
- `GET /economy/budgets`
- `GET /economy/ledger`
- `POST /economy/reservations`
- `POST /economy/reservations/:reservationId/settle`
- `POST /economy/reservations/:reservationId/release`

Runtime persists economy state in its existing durable snapshot and records each
accepted accounting transition in Memory and Audit.

## Simulation Integration

`POST /simulations/compare` may reference a budget id. Runtime derives the effective
maximum cost from the budget's currently available amount. A caller may set a lower
comparison maximum, but cannot raise it above available funds. The comparison result
records the budget evidence used.

Selection still does not reserve funds, approve a plan, or execute it. Execution-time
reservation is a later integration step so accounting remains explicit and auditable.

## Non-goals

- payment processing or invoices;
- exchange rates;
- provider billing reconciliation;
- parent-child budget enforcement;
- execution-time automatic reservation;
- predictive cost estimation.
