import { describe, expect, it } from "vitest";

import {
  EconomyError,
  createBudget,
  createInternalEconomyState,
  getBudgetBalance,
  releaseReservation,
  reserveCost,
  settleReservation,
  snapshotInternalEconomy
} from "./index.js";

describe("Internal Economy", () => {
  it("creates a budget with an auditable opening balance", () => {
    const result = createBudget(createInternalEconomyState(), {
      id: "budget:project:atlas",
      scopeType: "project",
      scopeId: "project:atlas",
      unit: "usd",
      limit: 100,
      createdAt: "2026-07-20T10:00:00.000Z"
    });

    expect(getBudgetBalance(result.state, result.budget.id)).toEqual({
      budgetId: "budget:project:atlas",
      limit: 100,
      settled: 0,
      reserved: 0,
      available: 100,
      unit: "usd"
    });
    expect(result.entry).toMatchObject({
      id: "ledger:budget:budget:project:atlas",
      kind: "budget_created",
      amount: 100
    });
  });

  it("reserves funds and prevents oversubscription", () => {
    const opened = openBudget(100);
    const reserved = reserveCost(opened.state, {
      id: "reservation:plan:a",
      budgetId: opened.budget.id,
      amount: 70,
      purpose: "Execute selected plan",
      referenceId: "plan:a",
      createdAt: "2026-07-20T10:01:00.000Z"
    });

    expect(getBudgetBalance(reserved.state, opened.budget.id)).toMatchObject({
      settled: 0,
      reserved: 70,
      available: 30
    });
    expect(() =>
      reserveCost(reserved.state, {
        id: "reservation:plan:b",
        budgetId: opened.budget.id,
        amount: 31,
        purpose: "Execute alternate plan",
        referenceId: "plan:b",
        createdAt: "2026-07-20T10:02:00.000Z"
      })
    ).toThrowError(expect.objectContaining({ code: "insufficient_funds" }));
  });

  it("settles actual spend below the reservation and releases the remainder", () => {
    const opened = openBudget(100);
    const reserved = reserveCost(opened.state, {
      id: "reservation:plan:a",
      budgetId: opened.budget.id,
      amount: 70,
      purpose: "Execute selected plan",
      referenceId: "execution:a",
      createdAt: "2026-07-20T10:01:00.000Z"
    });
    const settled = settleReservation(reserved.state, {
      reservationId: reserved.reservation.id,
      settlementId: "settlement:execution:a",
      actualAmount: 55,
      settledAt: "2026-07-20T10:10:00.000Z"
    });

    expect(settled.reservation).toMatchObject({
      status: "settled",
      settledAmount: 55,
      settlementId: "settlement:execution:a"
    });
    expect(getBudgetBalance(settled.state, opened.budget.id)).toMatchObject({
      settled: 55,
      reserved: 0,
      available: 45
    });
    expect(settled.entry).toMatchObject({
      kind: "cost_settled",
      amount: 55,
      reservationId: "reservation:plan:a"
    });
  });

  it("releases an active reservation without recording spend", () => {
    const opened = openBudget(100);
    const reserved = reserveCost(opened.state, {
      id: "reservation:plan:a",
      budgetId: opened.budget.id,
      amount: 40,
      purpose: "Hold plan capacity",
      referenceId: "plan:a",
      createdAt: "2026-07-20T10:01:00.000Z"
    });
    const released = releaseReservation(reserved.state, {
      reservationId: reserved.reservation.id,
      releaseId: "release:plan:a",
      releasedAt: "2026-07-20T10:05:00.000Z",
      reason: "Plan was not selected"
    });

    expect(released.reservation).toMatchObject({
      status: "released",
      releaseId: "release:plan:a",
      releaseReason: "Plan was not selected"
    });
    expect(getBudgetBalance(released.state, opened.budget.id)).toMatchObject({
      settled: 0,
      reserved: 0,
      available: 100
    });
  });

  it("enforces terminal reservation transitions and settlement limits", () => {
    const opened = openBudget(100);
    const reserved = reserveCost(opened.state, {
      id: "reservation:plan:a",
      budgetId: opened.budget.id,
      amount: 40,
      purpose: "Execute plan",
      referenceId: "plan:a",
      createdAt: "2026-07-20T10:01:00.000Z"
    });

    expect(() =>
      settleReservation(reserved.state, {
        reservationId: reserved.reservation.id,
        settlementId: "settlement:too-high",
        actualAmount: 41,
        settledAt: "2026-07-20T10:02:00.000Z"
      })
    ).toThrowError(expect.objectContaining({ code: "invalid_amount" }));

    const settled = settleReservation(reserved.state, {
      reservationId: reserved.reservation.id,
      settlementId: "settlement:plan:a",
      actualAmount: 35,
      settledAt: "2026-07-20T10:03:00.000Z"
    });
    expect(() =>
      releaseReservation(settled.state, {
        reservationId: reserved.reservation.id,
        releaseId: "release:after-settlement",
        releasedAt: "2026-07-20T10:04:00.000Z",
        reason: "Invalid reversal"
      })
    ).toThrowError(expect.objectContaining({ code: "invalid_transition" }));
  });

  it("is idempotent for identical commands and rejects conflicting reuse", () => {
    const input = {
      id: "budget:project:atlas",
      scopeType: "project" as const,
      scopeId: "project:atlas",
      unit: "usd",
      limit: 100,
      createdAt: "2026-07-20T10:00:00.000Z"
    };
    const opened = createBudget(createInternalEconomyState(), input);
    const replayedOpen = createBudget(opened.state, input);
    expect(replayedOpen.state.ledger).toHaveLength(1);

    const reservationInput = {
      id: "reservation:plan:a",
      budgetId: opened.budget.id,
      amount: 25,
      purpose: "Execute plan",
      referenceId: "plan:a",
      createdAt: "2026-07-20T10:01:00.000Z"
    };
    const reserved = reserveCost(opened.state, reservationInput);
    const replayedReservation = reserveCost(reserved.state, reservationInput);
    expect(replayedReservation.state.ledger).toHaveLength(2);

    const settlementInput = {
      reservationId: reserved.reservation.id,
      settlementId: "settlement:plan:a",
      actualAmount: 20,
      settledAt: "2026-07-20T10:03:00.000Z"
    };
    const settled = settleReservation(reserved.state, settlementInput);
    const replayedSettlement = settleReservation(settled.state, settlementInput);
    expect(replayedSettlement.state.ledger).toHaveLength(3);

    expect(() => createBudget(opened.state, { ...input, limit: 200 })).toThrowError(
      EconomyError
    );
    expect(() =>
      reserveCost(reserved.state, { ...reservationInput, amount: 30 })
    ).toThrowError(expect.objectContaining({ code: "conflict" }));
  });

  it("returns defensive snapshots of budgets, reservations, and ledger", () => {
    const opened = openBudget(100);
    const reserved = reserveCost(opened.state, {
      id: "reservation:plan:a",
      budgetId: opened.budget.id,
      amount: 25,
      purpose: "Execute plan",
      referenceId: "plan:a",
      createdAt: "2026-07-20T10:01:00.000Z"
    });
    const snapshot = snapshotInternalEconomy(reserved.state);

    snapshot.budgets[0]!.limit = 999;
    snapshot.reservations[0]!.amount = 999;
    snapshot.ledger[0]!.amount = 999;

    expect(getBudgetBalance(reserved.state, opened.budget.id)).toMatchObject({
      limit: 100,
      reserved: 25,
      available: 75
    });
  });
});

function openBudget(limit: number) {
  return createBudget(createInternalEconomyState(), {
    id: "budget:project:atlas",
    scopeType: "project",
    scopeId: "project:atlas",
    unit: "usd",
    limit,
    createdAt: "2026-07-20T10:00:00.000Z"
  });
}
