import type { OperationalBlocker, WorldStateSnapshot } from "@atlas-aios/world-state";

export type WorldStateSimulationEffect =
  | { type: "add_active_goal"; goalId: string }
  | { type: "remove_active_goal"; goalId: string }
  | { type: "add_active_execution"; executionId: string }
  | { type: "remove_active_execution"; executionId: string }
  | { type: "add_blocker"; blocker: OperationalBlocker }
  | { type: "remove_blocker"; blockerId: string };

export interface WorldStateSimulationThresholds {
  maximumBlockers?: number;
  maximumCriticalBlockers?: number;
}

export interface WorldStateSimulationMetrics {
  activeGoals: number;
  activeExecutions: number;
  blockers: number;
  criticalBlockers: number;
}

export interface WorldStateSimulationMetricComparison {
  before: WorldStateSimulationMetrics;
  after: WorldStateSimulationMetrics;
  delta: WorldStateSimulationMetrics;
}

export interface WorldStateSimulationFinding {
  code:
    | "maximum_blockers_exceeded"
    | "maximum_critical_blockers_exceeded"
    | "invalid_effect";
  severity: "warning" | "error";
  summary: string;
  evidenceRefs: string[];
}

export interface SimulateWorldStateInput {
  id: string;
  simulatedAt: string;
  source: WorldStateSnapshot;
  effects: WorldStateSimulationEffect[];
  thresholds?: WorldStateSimulationThresholds;
}

export interface WorldStateSimulationResult {
  id: string;
  status: "passed" | "blocked" | "failed";
  simulatedAt: string;
  sourceSnapshotId: string;
  effects: WorldStateSimulationEffect[];
  metrics: WorldStateSimulationMetricComparison;
  findings: WorldStateSimulationFinding[];
  evidenceRefs: string[];
  projectedSnapshot?: WorldStateSnapshot;
  failureReason?: string;
}

export interface SimulationPlanCandidate {
  planId: string;
  simulation: WorldStateSimulationResult;
  estimatedCost: number;
  estimatedLatencyMs: number;
  confidence: number;
}

export interface SimulationPlanComparisonWeights {
  confidence: number;
  cost: number;
  latency: number;
  blockers: number;
  criticalBlockers: number;
}

export interface SimulationPlanComparisonPolicy {
  maximumCost: number;
  maximumLatencyMs: number;
  minimumConfidence: number;
  maximumBlockerIncrease: number;
  maximumCriticalBlockerIncrease: number;
  weights: SimulationPlanComparisonWeights;
}

export type SimulationPlanRejectionReason =
  | "simulation_blocked"
  | "simulation_failed"
  | "projected_snapshot_missing"
  | "cost_limit_exceeded"
  | "latency_limit_exceeded"
  | "confidence_below_minimum"
  | "blocker_increase_exceeded"
  | "critical_blocker_increase_exceeded";

export interface SimulationPlanComponentScores {
  confidence: number;
  cost: number;
  latency: number;
  blockers: number;
  criticalBlockers: number;
}

export interface SimulationPlanRanking {
  rank: number;
  planId: string;
  simulationId: string;
  eligible: boolean;
  score: number;
  componentScores: SimulationPlanComponentScores;
  rejectionReasons: SimulationPlanRejectionReason[];
  estimatedCost: number;
  estimatedLatencyMs: number;
  confidence: number;
  evidenceRefs: string[];
}

export interface CompareSimulationPlansInput {
  id: string;
  comparedAt: string;
  candidates: SimulationPlanCandidate[];
  policy: SimulationPlanComparisonPolicy;
}

export interface SimulationPlanComparisonResult {
  id: string;
  comparedAt: string;
  status: "selected" | "no_eligible_plan";
  sourceSnapshotId: string;
  policy: SimulationPlanComparisonPolicy;
  rankings: SimulationPlanRanking[];
  selectedPlanId?: string;
}

export class SimulationPlanComparisonError extends Error {
  readonly code = "invalid_simulation_plan_comparison";

  constructor(message: string) {
    super(message);
    this.name = "SimulationPlanComparisonError";
  }
}

export function simulateWorldState(
  input: SimulateWorldStateInput
): WorldStateSimulationResult {
  const source = cloneSnapshot(input.source);
  const effects = input.effects.map(cloneEffect);
  const before = measureSnapshot(source);
  const projectedSnapshot: WorldStateSnapshot = {
    ...cloneSnapshot(source),
    id: `world-state:simulation:${input.id}`,
    capturedAt: input.simulatedAt
  };

  try {
    for (const effect of effects) {
      applyEffect(projectedSnapshot, effect);
    }
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message : "World State effect failed.";

    return {
      id: input.id,
      status: "failed",
      simulatedAt: input.simulatedAt,
      sourceSnapshotId: source.id,
      effects,
      metrics: compareMetrics(before, before),
      findings: [
        {
          code: "invalid_effect",
          severity: "error",
          summary: failureReason,
          evidenceRefs: [source.id]
        }
      ],
      evidenceRefs: [source.id],
      failureReason
    };
  }

  const after = measureSnapshot(projectedSnapshot);
  const findings = evaluateThresholds(projectedSnapshot, after, input.thresholds ?? {});

  return {
    id: input.id,
    status: findings.length === 0 ? "passed" : "blocked",
    simulatedAt: input.simulatedAt,
    sourceSnapshotId: source.id,
    effects,
    metrics: compareMetrics(before, after),
    findings,
    evidenceRefs: [source.id, projectedSnapshot.id],
    projectedSnapshot: cloneSnapshot(projectedSnapshot)
  };
}

export function compareSimulationPlans(
  input: CompareSimulationPlansInput
): SimulationPlanComparisonResult {
  validateComparisonInput(input);
  const policy = cloneComparisonPolicy(input.policy);
  const rankings = input.candidates
    .map((candidate) => rankCandidate(candidate, policy))
    .sort(compareRankings)
    .map((ranking, index) => ({ ...ranking, rank: index + 1 }));
  const selectedPlanId = rankings.find((ranking) => ranking.eligible)?.planId;

  return {
    id: input.id,
    comparedAt: input.comparedAt,
    status: selectedPlanId === undefined ? "no_eligible_plan" : "selected",
    sourceSnapshotId: input.candidates[0]!.simulation.sourceSnapshotId,
    policy,
    rankings: rankings.map(cloneRanking),
    ...(selectedPlanId === undefined ? {} : { selectedPlanId })
  };
}

function validateComparisonInput(input: CompareSimulationPlansInput): void {
  if (input.candidates.length < 2) {
    throw new SimulationPlanComparisonError(
      "Simulation plan comparison requires at least two candidates."
    );
  }

  validateComparisonPolicy(input.policy);
  const planIds = new Set<string>();
  const simulationIds = new Set<string>();
  const sourceSnapshotId = input.candidates[0]!.simulation.sourceSnapshotId;

  for (const candidate of input.candidates) {
    if (planIds.has(candidate.planId)) {
      throw new SimulationPlanComparisonError(
        `Duplicate plan candidate: ${candidate.planId}.`
      );
    }
    if (simulationIds.has(candidate.simulation.id)) {
      throw new SimulationPlanComparisonError(
        `Duplicate simulation candidate: ${candidate.simulation.id}.`
      );
    }
    if (candidate.simulation.sourceSnapshotId !== sourceSnapshotId) {
      throw new SimulationPlanComparisonError(
        "All candidates must use the same source World State snapshot."
      );
    }
    if (!isNonNegativeFinite(candidate.estimatedCost)) {
      throw new SimulationPlanComparisonError(
        `Candidate ${candidate.planId} has invalid estimated cost.`
      );
    }
    if (!isNonNegativeFinite(candidate.estimatedLatencyMs)) {
      throw new SimulationPlanComparisonError(
        `Candidate ${candidate.planId} has invalid estimated latency.`
      );
    }
    if (!isUnitInterval(candidate.confidence)) {
      throw new SimulationPlanComparisonError(
        `Candidate ${candidate.planId} has invalid confidence.`
      );
    }

    planIds.add(candidate.planId);
    simulationIds.add(candidate.simulation.id);
  }
}

function validateComparisonPolicy(policy: SimulationPlanComparisonPolicy): void {
  if (!Number.isFinite(policy.maximumCost) || policy.maximumCost <= 0) {
    throw new SimulationPlanComparisonError(
      "Comparison maximum cost must be greater than zero."
    );
  }
  if (!Number.isFinite(policy.maximumLatencyMs) || policy.maximumLatencyMs <= 0) {
    throw new SimulationPlanComparisonError(
      "Comparison maximum latency must be greater than zero."
    );
  }
  if (!isUnitInterval(policy.minimumConfidence)) {
    throw new SimulationPlanComparisonError(
      "Comparison minimum confidence must be between zero and one."
    );
  }
  if (!isNonNegativeFinite(policy.maximumBlockerIncrease)) {
    throw new SimulationPlanComparisonError(
      "Maximum blocker increase must be non-negative."
    );
  }
  if (!isNonNegativeFinite(policy.maximumCriticalBlockerIncrease)) {
    throw new SimulationPlanComparisonError(
      "Maximum critical blocker increase must be non-negative."
    );
  }

  const weights = Object.values(policy.weights);
  if (weights.some((weight) => !isNonNegativeFinite(weight))) {
    throw new SimulationPlanComparisonError(
      "Comparison weights must be finite and non-negative."
    );
  }
  if (weights.every((weight) => weight === 0)) {
    throw new SimulationPlanComparisonError(
      "Comparison policy requires at least one positive weight."
    );
  }
}

function rankCandidate(
  candidate: SimulationPlanCandidate,
  policy: SimulationPlanComparisonPolicy
): Omit<SimulationPlanRanking, "rank"> {
  const componentScores: SimulationPlanComponentScores = {
    confidence: candidate.confidence,
    cost: remainingBudgetScore(candidate.estimatedCost, policy.maximumCost),
    latency: remainingBudgetScore(
      candidate.estimatedLatencyMs,
      policy.maximumLatencyMs
    ),
    blockers: increaseScore(
      candidate.simulation.metrics.delta.blockers,
      policy.maximumBlockerIncrease
    ),
    criticalBlockers: increaseScore(
      candidate.simulation.metrics.delta.criticalBlockers,
      policy.maximumCriticalBlockerIncrease
    )
  };
  const rejectionReasons = candidateRejectionReasons(candidate, policy);

  return {
    planId: candidate.planId,
    simulationId: candidate.simulation.id,
    eligible: rejectionReasons.length === 0,
    score: weightedScore(componentScores, policy.weights),
    componentScores,
    rejectionReasons,
    estimatedCost: candidate.estimatedCost,
    estimatedLatencyMs: candidate.estimatedLatencyMs,
    confidence: candidate.confidence,
    evidenceRefs: [candidate.simulation.id, ...candidate.simulation.evidenceRefs]
  };
}

function candidateRejectionReasons(
  candidate: SimulationPlanCandidate,
  policy: SimulationPlanComparisonPolicy
): SimulationPlanRejectionReason[] {
  const reasons: SimulationPlanRejectionReason[] = [];
  if (candidate.simulation.status === "blocked") {
    reasons.push("simulation_blocked");
  }
  if (candidate.simulation.status === "failed") {
    reasons.push("simulation_failed");
  }
  if (candidate.simulation.projectedSnapshot === undefined) {
    reasons.push("projected_snapshot_missing");
  }
  if (candidate.estimatedCost > policy.maximumCost) {
    reasons.push("cost_limit_exceeded");
  }
  if (candidate.estimatedLatencyMs > policy.maximumLatencyMs) {
    reasons.push("latency_limit_exceeded");
  }
  if (candidate.confidence < policy.minimumConfidence) {
    reasons.push("confidence_below_minimum");
  }
  if (candidate.simulation.metrics.delta.blockers > policy.maximumBlockerIncrease) {
    reasons.push("blocker_increase_exceeded");
  }
  if (
    candidate.simulation.metrics.delta.criticalBlockers >
    policy.maximumCriticalBlockerIncrease
  ) {
    reasons.push("critical_blocker_increase_exceeded");
  }
  return reasons;
}

function weightedScore(
  scores: SimulationPlanComponentScores,
  weights: SimulationPlanComparisonWeights
): number {
  const weightTotal = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  return roundScore(
    (scores.confidence * weights.confidence +
      scores.cost * weights.cost +
      scores.latency * weights.latency +
      scores.blockers * weights.blockers +
      scores.criticalBlockers * weights.criticalBlockers) /
      weightTotal
  );
}

function remainingBudgetScore(value: number, maximum: number): number {
  return roundScore(Math.max(0, Math.min(1, 1 - value / maximum)));
}

function increaseScore(increase: number, maximumIncrease: number): number {
  if (increase <= 0) {
    return 1;
  }
  return maximumIncrease === 0
    ? 0
    : roundScore(Math.max(0, Math.min(1, 1 - increase / maximumIncrease)));
}

function roundScore(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function compareRankings(
  left: Omit<SimulationPlanRanking, "rank">,
  right: Omit<SimulationPlanRanking, "rank">
): number {
  if (left.eligible !== right.eligible) {
    return left.eligible ? -1 : 1;
  }
  return (
    right.score - left.score ||
    right.confidence - left.confidence ||
    left.estimatedCost - right.estimatedCost ||
    left.estimatedLatencyMs - right.estimatedLatencyMs ||
    left.planId.localeCompare(right.planId)
  );
}

function cloneComparisonPolicy(
  policy: SimulationPlanComparisonPolicy
): SimulationPlanComparisonPolicy {
  return {
    ...policy,
    weights: { ...policy.weights }
  };
}

function cloneRanking(ranking: SimulationPlanRanking): SimulationPlanRanking {
  return {
    ...ranking,
    componentScores: { ...ranking.componentScores },
    rejectionReasons: [...ranking.rejectionReasons],
    evidenceRefs: [...ranking.evidenceRefs]
  };
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function applyEffect(
  snapshot: WorldStateSnapshot,
  effect: WorldStateSimulationEffect
): void {
  switch (effect.type) {
    case "add_active_goal":
      addUnique(snapshot.activeGoalIds, effect.goalId, "Active goal");
      return;
    case "remove_active_goal":
      removeExisting(snapshot.activeGoalIds, effect.goalId, "Active goal");
      return;
    case "add_active_execution":
      addUnique(snapshot.activeExecutionIds, effect.executionId, "Active execution");
      return;
    case "remove_active_execution":
      removeExisting(
        snapshot.activeExecutionIds,
        effect.executionId,
        "Active execution"
      );
      return;
    case "add_blocker":
      if (snapshot.blockers.some((blocker) => blocker.id === effect.blocker.id)) {
        throw new Error(`Blocker already exists: ${effect.blocker.id}.`);
      }
      snapshot.blockers.push({ ...effect.blocker });
      return;
    case "remove_blocker": {
      const index = snapshot.blockers.findIndex(
        (blocker) => blocker.id === effect.blockerId
      );
      if (index < 0) {
        throw new Error(`Blocker does not exist: ${effect.blockerId}.`);
      }
      snapshot.blockers.splice(index, 1);
    }
  }
}

function addUnique(values: string[], value: string, label: string): void {
  if (values.includes(value)) {
    throw new Error(`${label} already exists: ${value}.`);
  }
  values.push(value);
}

function removeExisting(values: string[], value: string, label: string): void {
  const index = values.indexOf(value);
  if (index < 0) {
    throw new Error(`${label} does not exist: ${value}.`);
  }
  values.splice(index, 1);
}

function evaluateThresholds(
  snapshot: WorldStateSnapshot,
  metrics: WorldStateSimulationMetrics,
  thresholds: WorldStateSimulationThresholds
): WorldStateSimulationFinding[] {
  const findings: WorldStateSimulationFinding[] = [];

  if (
    thresholds.maximumBlockers !== undefined &&
    metrics.blockers > thresholds.maximumBlockers
  ) {
    findings.push({
      code: "maximum_blockers_exceeded",
      severity: "error",
      summary: `Projected blockers ${metrics.blockers} exceed maximum ${thresholds.maximumBlockers}.`,
      evidenceRefs: [snapshot.id]
    });
  }

  if (
    thresholds.maximumCriticalBlockers !== undefined &&
    metrics.criticalBlockers > thresholds.maximumCriticalBlockers
  ) {
    findings.push({
      code: "maximum_critical_blockers_exceeded",
      severity: "error",
      summary: `Projected critical blockers ${metrics.criticalBlockers} exceed maximum ${thresholds.maximumCriticalBlockers}.`,
      evidenceRefs: [snapshot.id]
    });
  }

  return findings;
}

function measureSnapshot(snapshot: WorldStateSnapshot): WorldStateSimulationMetrics {
  return {
    activeGoals: snapshot.activeGoalIds.length,
    activeExecutions: snapshot.activeExecutionIds.length,
    blockers: snapshot.blockers.length,
    criticalBlockers: snapshot.blockers.filter(
      (blocker) => blocker.severity === "critical"
    ).length
  };
}

function compareMetrics(
  before: WorldStateSimulationMetrics,
  after: WorldStateSimulationMetrics
): WorldStateSimulationMetricComparison {
  return {
    before: { ...before },
    after: { ...after },
    delta: {
      activeGoals: after.activeGoals - before.activeGoals,
      activeExecutions: after.activeExecutions - before.activeExecutions,
      blockers: after.blockers - before.blockers,
      criticalBlockers: after.criticalBlockers - before.criticalBlockers
    }
  };
}

function cloneSnapshot(snapshot: WorldStateSnapshot): WorldStateSnapshot {
  return {
    ...snapshot,
    activeGoalIds: [...snapshot.activeGoalIds],
    activeExecutionIds: [...snapshot.activeExecutionIds],
    blockers: snapshot.blockers.map((blocker) => ({ ...blocker }))
  };
}

function cloneEffect(effect: WorldStateSimulationEffect): WorldStateSimulationEffect {
  return effect.type === "add_blocker"
    ? { ...effect, blocker: { ...effect.blocker } }
    : { ...effect };
}
