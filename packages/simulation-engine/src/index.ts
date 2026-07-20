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
