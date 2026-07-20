export type EconomyScopeType =
  | "organization"
  | "project"
  | "goal"
  | "execution"
  | "provider";

export interface EconomyBudget {
  id: string;
  scopeType: EconomyScopeType;
  scopeId: string;
  unit: string;
  limit: number;
  createdAt: string;
  parentBudgetId?: string;
}

export type CostReservationStatus = "active" | "settled" | "released";

export interface CostReservation {
  id: string;
  budgetId: string;
  amount: number;
  purpose: string;
  referenceId: string;
  createdAt: string;
  status: CostReservationStatus;
  settlementId?: string;
  settledAmount?: number;
  settledAt?: string;
  releaseId?: string;
  releasedAt?: string;
  releaseReason?: string;
}

export type EconomyLedgerEntryKind =
  | "budget_created"
  | "cost_reserved"
  | "cost_settled"
  | "reservation_released";

export interface EconomyLedgerEntry {
  id: string;
  budgetId: string;
  kind: EconomyLedgerEntryKind;
  amount: number;
  unit: string;
  occurredAt: string;
  reservationId?: string;
  referenceId?: string;
  description: string;
}

export interface InternalEconomyState {
  budgets: EconomyBudget[];
  reservations: CostReservation[];
  ledger: EconomyLedgerEntry[];
}

export interface BudgetBalance {
  budgetId: string;
  limit: number;
  settled: number;
  reserved: number;
  available: number;
  unit: string;
}

export interface CreateBudgetInput {
  id: string;
  scopeType: EconomyScopeType;
  scopeId: string;
  unit: string;
  limit: number;
  createdAt: string;
  parentBudgetId?: string;
}

export interface ReserveCostInput {
  id: string;
  budgetId: string;
  amount: number;
  purpose: string;
  referenceId: string;
  createdAt: string;
}

export interface SettleReservationInput {
  reservationId: string;
  settlementId: string;
  actualAmount: number;
  settledAt: string;
}

export interface ReleaseReservationInput {
  reservationId: string;
  releaseId: string;
  releasedAt: string;
  reason: string;
}

export type EconomyErrorCode =
  | "invalid_input"
  | "invalid_amount"
  | "not_found"
  | "conflict"
  | "insufficient_funds"
  | "invalid_transition";

export class EconomyError extends Error {
  readonly code: EconomyErrorCode;

  constructor(code: EconomyErrorCode, message: string) {
    super(message);
    this.name = "EconomyError";
    this.code = code;
  }
}

export interface BudgetCommandResult {
  state: InternalEconomyState;
  budget: EconomyBudget;
  entry: EconomyLedgerEntry;
}

export interface ReservationCommandResult {
  state: InternalEconomyState;
  reservation: CostReservation;
  entry: EconomyLedgerEntry;
}

export function createInternalEconomyState(
  initial?: InternalEconomyState
): InternalEconomyState {
  return initial === undefined
    ? { budgets: [], reservations: [], ledger: [] }
    : cloneState(initial);
}

export function snapshotInternalEconomy(
  state: InternalEconomyState
): InternalEconomyState {
  return cloneState(state);
}

export function createBudget(
  state: InternalEconomyState,
  input: CreateBudgetInput
): BudgetCommandResult {
  validateRequiredText(input.id, "Budget id");
  validateRequiredText(input.scopeId, "Budget scope id");
  validateRequiredText(input.unit, "Budget unit");
  validateTimestamp(input.createdAt, "Budget creation time");
  validatePositiveAmount(input.limit, "Budget limit");
  if (input.parentBudgetId !== undefined) {
    validateRequiredText(input.parentBudgetId, "Parent budget id");
  }

  const existing = state.budgets.find((budget) => budget.id === input.id);
  if (existing !== undefined) {
    if (!budgetMatchesInput(existing, input)) {
      throw new EconomyError(
        "conflict",
        `Budget ${input.id} already exists with different terms.`
      );
    }
    return existingBudgetResult(state, existing);
  }

  if (
    input.parentBudgetId !== undefined &&
    !state.budgets.some((budget) => budget.id === input.parentBudgetId)
  ) {
    throw new EconomyError(
      "not_found",
      `Parent budget ${input.parentBudgetId} does not exist.`
    );
  }

  const budget: EconomyBudget = { ...input };
  const entry: EconomyLedgerEntry = {
    id: budgetLedgerId(input.id),
    budgetId: input.id,
    kind: "budget_created",
    amount: input.limit,
    unit: input.unit,
    occurredAt: input.createdAt,
    description: `Created ${input.scopeType} budget for ${input.scopeId}.`
  };
  const nextState = cloneState({
    budgets: [...state.budgets, budget],
    reservations: state.reservations,
    ledger: [...state.ledger, entry]
  });

  return {
    state: nextState,
    budget: { ...budget },
    entry: { ...entry }
  };
}

export function reserveCost(
  state: InternalEconomyState,
  input: ReserveCostInput
): ReservationCommandResult {
  validateRequiredText(input.id, "Reservation id");
  validateRequiredText(input.budgetId, "Reservation budget id");
  validateRequiredText(input.purpose, "Reservation purpose");
  validateRequiredText(input.referenceId, "Reservation reference id");
  validateTimestamp(input.createdAt, "Reservation creation time");
  validatePositiveAmount(input.amount, "Reservation amount");

  const existing = state.reservations.find(
    (reservation) => reservation.id === input.id
  );
  if (existing !== undefined) {
    if (!activeReservationMatchesInput(existing, input)) {
      throw new EconomyError(
        "conflict",
        `Reservation ${input.id} already exists with different terms.`
      );
    }
    return existingReservationResult(state, existing, reservationLedgerId(input.id));
  }

  const budget = requireBudget(state, input.budgetId);
  const balance = getBudgetBalance(state, input.budgetId);
  if (input.amount > balance.available) {
    throw new EconomyError(
      "insufficient_funds",
      `Budget ${input.budgetId} has ${balance.available} ${balance.unit} available; ${input.amount} was requested.`
    );
  }

  const reservation: CostReservation = {
    ...input,
    status: "active"
  };
  const entry: EconomyLedgerEntry = {
    id: reservationLedgerId(input.id),
    budgetId: input.budgetId,
    reservationId: input.id,
    referenceId: input.referenceId,
    kind: "cost_reserved",
    amount: input.amount,
    unit: budget.unit,
    occurredAt: input.createdAt,
    description: input.purpose
  };
  const nextState = cloneState({
    budgets: state.budgets,
    reservations: [...state.reservations, reservation],
    ledger: [...state.ledger, entry]
  });

  return {
    state: nextState,
    reservation: { ...reservation },
    entry: { ...entry }
  };
}

export function settleReservation(
  state: InternalEconomyState,
  input: SettleReservationInput
): ReservationCommandResult {
  validateRequiredText(input.reservationId, "Reservation id");
  validateRequiredText(input.settlementId, "Settlement id");
  validateTimestamp(input.settledAt, "Settlement time");
  validateNonNegativeAmount(input.actualAmount, "Settlement amount");

  const reservation = requireReservation(state, input.reservationId);
  if (reservation.status === "settled") {
    if (!settlementMatchesInput(reservation, input)) {
      throw new EconomyError(
        "conflict",
        `Reservation ${input.reservationId} was already settled differently.`
      );
    }
    return existingReservationResult(
      state,
      reservation,
      settlementLedgerId(input.settlementId)
    );
  }
  if (reservation.status !== "active") {
    throw new EconomyError(
      "invalid_transition",
      `Reservation ${input.reservationId} is ${reservation.status} and cannot be settled.`
    );
  }
  if (input.actualAmount > reservation.amount) {
    throw new EconomyError(
      "invalid_amount",
      `Settlement amount cannot exceed reserved amount ${reservation.amount}.`
    );
  }

  ensureTerminalCommandIdAvailable(state, input.settlementId);
  const budget = requireBudget(state, reservation.budgetId);
  const settledReservation: CostReservation = {
    ...reservation,
    status: "settled",
    settlementId: input.settlementId,
    settledAmount: input.actualAmount,
    settledAt: input.settledAt
  };
  const entry: EconomyLedgerEntry = {
    id: settlementLedgerId(input.settlementId),
    budgetId: reservation.budgetId,
    reservationId: reservation.id,
    referenceId: reservation.referenceId,
    kind: "cost_settled",
    amount: input.actualAmount,
    unit: budget.unit,
    occurredAt: input.settledAt,
    description: `Settled reservation ${reservation.id}.`
  };
  const nextState = replaceReservation(state, settledReservation, entry);

  return {
    state: nextState,
    reservation: { ...settledReservation },
    entry: { ...entry }
  };
}

export function releaseReservation(
  state: InternalEconomyState,
  input: ReleaseReservationInput
): ReservationCommandResult {
  validateRequiredText(input.reservationId, "Reservation id");
  validateRequiredText(input.releaseId, "Release id");
  validateRequiredText(input.reason, "Release reason");
  validateTimestamp(input.releasedAt, "Release time");

  const reservation = requireReservation(state, input.reservationId);
  if (reservation.status === "released") {
    if (!releaseMatchesInput(reservation, input)) {
      throw new EconomyError(
        "conflict",
        `Reservation ${input.reservationId} was already released differently.`
      );
    }
    return existingReservationResult(
      state,
      reservation,
      releaseLedgerId(input.releaseId)
    );
  }
  if (reservation.status !== "active") {
    throw new EconomyError(
      "invalid_transition",
      `Reservation ${input.reservationId} is ${reservation.status} and cannot be released.`
    );
  }

  ensureTerminalCommandIdAvailable(state, input.releaseId);
  const budget = requireBudget(state, reservation.budgetId);
  const releasedReservation: CostReservation = {
    ...reservation,
    status: "released",
    releaseId: input.releaseId,
    releasedAt: input.releasedAt,
    releaseReason: input.reason
  };
  const entry: EconomyLedgerEntry = {
    id: releaseLedgerId(input.releaseId),
    budgetId: reservation.budgetId,
    reservationId: reservation.id,
    referenceId: reservation.referenceId,
    kind: "reservation_released",
    amount: reservation.amount,
    unit: budget.unit,
    occurredAt: input.releasedAt,
    description: input.reason
  };
  const nextState = replaceReservation(state, releasedReservation, entry);

  return {
    state: nextState,
    reservation: { ...releasedReservation },
    entry: { ...entry }
  };
}

export function getBudgetBalance(
  state: InternalEconomyState,
  budgetId: string
): BudgetBalance {
  const budget = requireBudget(state, budgetId);
  const settled = roundAmount(
    state.reservations
      .filter(
        (reservation) =>
          reservation.budgetId === budgetId && reservation.status === "settled"
      )
      .reduce((total, reservation) => total + (reservation.settledAmount ?? 0), 0)
  );
  const reserved = roundAmount(
    state.reservations
      .filter(
        (reservation) =>
          reservation.budgetId === budgetId && reservation.status === "active"
      )
      .reduce((total, reservation) => total + reservation.amount, 0)
  );

  return {
    budgetId,
    limit: budget.limit,
    settled,
    reserved,
    available: roundAmount(budget.limit - settled - reserved),
    unit: budget.unit
  };
}

function existingBudgetResult(
  state: InternalEconomyState,
  budget: EconomyBudget
): BudgetCommandResult {
  const entry = requireLedgerEntry(state, budgetLedgerId(budget.id));
  return {
    state: cloneState(state),
    budget: { ...budget },
    entry: { ...entry }
  };
}

function existingReservationResult(
  state: InternalEconomyState,
  reservation: CostReservation,
  entryId: string
): ReservationCommandResult {
  const entry = requireLedgerEntry(state, entryId);
  return {
    state: cloneState(state),
    reservation: { ...reservation },
    entry: { ...entry }
  };
}

function replaceReservation(
  state: InternalEconomyState,
  reservation: CostReservation,
  entry: EconomyLedgerEntry
): InternalEconomyState {
  return cloneState({
    budgets: state.budgets,
    reservations: state.reservations.map((candidate) =>
      candidate.id === reservation.id ? reservation : candidate
    ),
    ledger: [...state.ledger, entry]
  });
}

function requireBudget(state: InternalEconomyState, budgetId: string): EconomyBudget {
  const budget = state.budgets.find((candidate) => candidate.id === budgetId);
  if (budget === undefined) {
    throw new EconomyError("not_found", `Budget ${budgetId} does not exist.`);
  }
  return budget;
}

function requireReservation(
  state: InternalEconomyState,
  reservationId: string
): CostReservation {
  const reservation = state.reservations.find(
    (candidate) => candidate.id === reservationId
  );
  if (reservation === undefined) {
    throw new EconomyError("not_found", `Reservation ${reservationId} does not exist.`);
  }
  return reservation;
}

function requireLedgerEntry(
  state: InternalEconomyState,
  entryId: string
): EconomyLedgerEntry {
  const entry = state.ledger.find((candidate) => candidate.id === entryId);
  if (entry === undefined) {
    throw new EconomyError(
      "conflict",
      `Economy state is missing ledger entry ${entryId}.`
    );
  }
  return entry;
}

function ensureTerminalCommandIdAvailable(
  state: InternalEconomyState,
  commandId: string
): void {
  const settlementIdInUse = state.reservations.some(
    (reservation) => reservation.settlementId === commandId
  );
  const releaseIdInUse = state.reservations.some(
    (reservation) => reservation.releaseId === commandId
  );
  if (settlementIdInUse || releaseIdInUse) {
    throw new EconomyError(
      "conflict",
      `Terminal command id ${commandId} is already in use.`
    );
  }
}

function budgetMatchesInput(budget: EconomyBudget, input: CreateBudgetInput): boolean {
  return (
    budget.scopeType === input.scopeType &&
    budget.scopeId === input.scopeId &&
    budget.unit === input.unit &&
    budget.limit === input.limit &&
    budget.createdAt === input.createdAt &&
    budget.parentBudgetId === input.parentBudgetId
  );
}

function activeReservationMatchesInput(
  reservation: CostReservation,
  input: ReserveCostInput
): boolean {
  return (
    reservation.budgetId === input.budgetId &&
    reservation.amount === input.amount &&
    reservation.purpose === input.purpose &&
    reservation.referenceId === input.referenceId &&
    reservation.createdAt === input.createdAt
  );
}

function settlementMatchesInput(
  reservation: CostReservation,
  input: SettleReservationInput
): boolean {
  return (
    reservation.settlementId === input.settlementId &&
    reservation.settledAmount === input.actualAmount &&
    reservation.settledAt === input.settledAt
  );
}

function releaseMatchesInput(
  reservation: CostReservation,
  input: ReleaseReservationInput
): boolean {
  return (
    reservation.releaseId === input.releaseId &&
    reservation.releasedAt === input.releasedAt &&
    reservation.releaseReason === input.reason
  );
}

function validateRequiredText(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new EconomyError("invalid_input", `${label} is required.`);
  }
}

function validateTimestamp(value: string, label: string): void {
  validateRequiredText(value, label);
  if (!Number.isFinite(Date.parse(value))) {
    throw new EconomyError("invalid_input", `${label} must be an ISO timestamp.`);
  }
}

function validatePositiveAmount(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new EconomyError(
      "invalid_amount",
      `${label} must be a finite amount greater than zero.`
    );
  }
}

function validateNonNegativeAmount(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new EconomyError(
      "invalid_amount",
      `${label} must be a finite non-negative amount.`
    );
  }
}

function budgetLedgerId(budgetId: string): string {
  return `ledger:budget:${budgetId}`;
}

function reservationLedgerId(reservationId: string): string {
  return `ledger:reservation:${reservationId}`;
}

function settlementLedgerId(settlementId: string): string {
  return `ledger:settlement:${settlementId}`;
}

function releaseLedgerId(releaseId: string): string {
  return `ledger:release:${releaseId}`;
}

function roundAmount(value: number): number {
  return Number(value.toFixed(12));
}

function cloneState(state: InternalEconomyState): InternalEconomyState {
  return {
    budgets: state.budgets.map((budget) => ({ ...budget })),
    reservations: state.reservations.map((reservation) => ({ ...reservation })),
    ledger: state.ledger.map((entry) => ({ ...entry }))
  };
}
