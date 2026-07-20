export type CognitiveLoopPhase =
  | "observe"
  | "update_world_state"
  | "update_swm"
  | "update_memory"
  | "distill_experience"
  | "update_self_model"
  | "review_goals"
  | "allocate_attention"
  | "plan"
  | "simulate"
  | "execute"
  | "evaluate"
  | "learn"
  | "rest";

export type CognitiveLoopPhaseStatus = "completed" | "skipped";

export type CognitiveLoopNextActionType =
  | "request_approval"
  | "learn_capabilities"
  | "simulate_capability"
  | "dispatch_capability"
  | "rest";

export type CognitiveLoopNextActionStatus =
  | "waiting_for_approval"
  | "needs_learning"
  | "needs_simulation"
  | "ready_to_dispatch"
  | "idle";

export interface CognitiveLoopObservations {
  activeGoalIds: string[];
  activeExecutionIds: string[];
  blockerIds: string[];
  memoryEventIds: string[];
  experienceArtifactIds: string[];
  capabilityIds: string[];
  simulationIds: string[];
  identityIds: string[];
  selfModelSnapshotId?: string;
  worldStateSnapshotId?: string;
}

export interface CognitiveLoopPhaseRecord {
  phase: CognitiveLoopPhase;
  status: CognitiveLoopPhaseStatus;
  summary: string;
  evidenceRefs: string[];
}

export interface CognitiveLoopNextAction {
  type: CognitiveLoopNextActionType;
  status: CognitiveLoopNextActionStatus;
  reason: string;
  targetRefs: string[];
}

export interface CognitiveLoopCycle {
  id: string;
  schemaVersion: "0.1";
  goalId?: string;
  startedAt: string;
  completedAt: string;
  bounded: true;
  executedAction: false;
  observations: CognitiveLoopObservations;
  phases: CognitiveLoopPhaseRecord[];
  nextAction: CognitiveLoopNextAction;
}

export interface RunBoundedCognitiveLoopCycleInput {
  id: string;
  goalId?: string;
  startedAt: string;
  completedAt?: string;
  observations: CognitiveLoopObservations;
}

export function runBoundedCognitiveLoopCycle(
  input: RunBoundedCognitiveLoopCycleInput
): CognitiveLoopCycle {
  const observations = cloneObservations(input.observations);
  const nextAction = chooseNextAction(observations);
  const completedAt = input.completedAt ?? input.startedAt;

  return {
    id: input.id,
    schemaVersion: "0.1",
    ...(input.goalId === undefined ? {} : { goalId: input.goalId }),
    startedAt: input.startedAt,
    completedAt,
    bounded: true,
    executedAction: false,
    observations,
    phases: createPhaseRecords(input.id, observations, nextAction),
    nextAction
  };
}

function chooseNextAction(
  observations: CognitiveLoopObservations
): CognitiveLoopNextAction {
  if (observations.blockerIds.length > 0) {
    return {
      type: "request_approval",
      status: "waiting_for_approval",
      reason: "Approval blockers must be resolved before Atlas can execute.",
      targetRefs: [...observations.blockerIds]
    };
  }

  if (observations.capabilityIds.length === 0) {
    return {
      type: "learn_capabilities",
      status: "needs_learning",
      reason: "No capabilities are available for the current goal context.",
      targetRefs: [...observations.activeGoalIds]
    };
  }

  if (observations.activeGoalIds.length > 0) {
    if (observations.simulationIds.length === 0) {
      return {
        type: "simulate_capability",
        status: "needs_simulation",
        reason:
          "A goal and capability are available, but no successful simulation evidence is present.",
        targetRefs: [observations.activeGoalIds[0]!, observations.capabilityIds[0]!]
      };
    }

    return {
      type: "dispatch_capability",
      status: "ready_to_dispatch",
      reason:
        "A goal, capability, and successful simulation are available with no active blockers.",
      targetRefs: [
        observations.activeGoalIds[0]!,
        observations.capabilityIds[0]!,
        observations.simulationIds[0]!
      ]
    };
  }

  return {
    type: "rest",
    status: "idle",
    reason: "No active goal needs attention in this bounded cycle.",
    targetRefs: []
  };
}

function createPhaseRecords(
  cycleId: string,
  observations: CognitiveLoopObservations,
  nextAction: CognitiveLoopNextAction
): CognitiveLoopPhaseRecord[] {
  return [
    {
      phase: "observe",
      status: "completed",
      summary: `Observed ${countLabel(
        observations.activeGoalIds.length,
        "active goal"
      )}, ${countLabel(
        observations.activeExecutionIds.length,
        "active executions"
      )}, ${countLabel(observations.blockerIds.length, "blocker")}, and ${countLabel(
        observations.capabilityIds.length,
        "capabilities"
      )}.`,
      evidenceRefs: optionalRefs([
        observations.worldStateSnapshotId,
        observations.selfModelSnapshotId
      ])
    },
    {
      phase: "update_world_state",
      status: observations.worldStateSnapshotId === undefined ? "skipped" : "completed",
      summary:
        observations.worldStateSnapshotId === undefined
          ? "No World State snapshot was provided."
          : "World State snapshot is current for this bounded cycle.",
      evidenceRefs: optionalRefs([observations.worldStateSnapshotId])
    },
    {
      phase: "update_swm",
      status: "skipped",
      summary: "No new semantic world observations were provided.",
      evidenceRefs: []
    },
    {
      phase: "update_memory",
      status: observations.memoryEventIds.length === 0 ? "skipped" : "completed",
      summary: `Cycle references ${countLabel(
        observations.memoryEventIds.length,
        "Memory events"
      )}.`,
      evidenceRefs: [...observations.memoryEventIds]
    },
    {
      phase: "distill_experience",
      status: observations.experienceArtifactIds.length === 0 ? "skipped" : "completed",
      summary: `Cycle references ${countLabel(
        observations.experienceArtifactIds.length,
        "Experience artifacts"
      )}.`,
      evidenceRefs: [...observations.experienceArtifactIds]
    },
    {
      phase: "update_self_model",
      status: observations.selfModelSnapshotId === undefined ? "skipped" : "completed",
      summary:
        observations.selfModelSnapshotId === undefined
          ? "No Self Model snapshot was included in cycle context."
          : "Self Model snapshot was included in cycle context.",
      evidenceRefs: optionalRefs([observations.selfModelSnapshotId])
    },
    {
      phase: "review_goals",
      status: observations.activeGoalIds.length === 0 ? "skipped" : "completed",
      summary: `Reviewed ${countLabel(
        observations.activeGoalIds.length,
        "active goals"
      )}.`,
      evidenceRefs: [...observations.activeGoalIds]
    },
    {
      phase: "allocate_attention",
      status: "completed",
      summary: attentionSummary(nextAction),
      evidenceRefs: attentionEvidence(observations, nextAction)
    },
    {
      phase: "plan",
      status: "completed",
      summary: `Next safe action is ${nextAction.type}.`,
      evidenceRefs: [...nextAction.targetRefs]
    },
    {
      phase: "simulate",
      status:
        nextAction.type === "dispatch_capability" &&
        observations.simulationIds.length > 0
          ? "completed"
          : "skipped",
      summary:
        nextAction.type === "request_approval"
          ? "Simulation is skipped because approval is blocking execution."
          : nextAction.type === "dispatch_capability"
            ? "Successful simulation evidence supports the dispatch proposal."
            : nextAction.type === "simulate_capability"
              ? "Simulation evidence is required before dispatch can be proposed."
              : "Simulation is skipped because there is no executable action.",
      evidenceRefs:
        nextAction.type === "dispatch_capability" ? [...observations.simulationIds] : []
    },
    {
      phase: "execute",
      status: "skipped",
      summary: "Bounded cycle does not execute actions automatically.",
      evidenceRefs: []
    },
    {
      phase: "evaluate",
      status: "completed",
      summary: `Cycle outcome is ${nextAction.status}.`,
      evidenceRefs: [...nextAction.targetRefs]
    },
    {
      phase: "learn",
      status: "completed",
      summary: "Cycle is ready to be recorded as Memory evidence.",
      evidenceRefs: [cycleId]
    },
    {
      phase: "rest",
      status: "completed",
      summary: "Loop stops after one bounded cycle.",
      evidenceRefs: []
    }
  ];
}

function attentionSummary(nextAction: CognitiveLoopNextAction): string {
  switch (nextAction.type) {
    case "request_approval":
      return "Attention is focused on blocker resolution.";
    case "learn_capabilities":
      return "Attention is focused on capability learning.";
    case "simulate_capability":
      return "Attention is focused on counterfactual validation.";
    case "dispatch_capability":
      return "Attention is focused on ready execution planning.";
    case "rest":
      return "Attention is idle because no active goal needs work.";
  }
}

function attentionEvidence(
  observations: CognitiveLoopObservations,
  nextAction: CognitiveLoopNextAction
): string[] {
  switch (nextAction.type) {
    case "request_approval":
      return [...observations.blockerIds];
    case "learn_capabilities":
      return [...observations.activeGoalIds];
    case "simulate_capability":
      return [...nextAction.targetRefs];
    case "dispatch_capability":
      return [...nextAction.targetRefs];
    case "rest":
      return [];
  }
}

function cloneObservations(
  observations: CognitiveLoopObservations
): CognitiveLoopObservations {
  return {
    activeGoalIds: [...observations.activeGoalIds],
    activeExecutionIds: [...observations.activeExecutionIds],
    blockerIds: [...observations.blockerIds],
    memoryEventIds: [...observations.memoryEventIds],
    experienceArtifactIds: [...observations.experienceArtifactIds],
    capabilityIds: [...observations.capabilityIds],
    simulationIds: [...observations.simulationIds],
    identityIds: [...observations.identityIds],
    ...(observations.selfModelSnapshotId === undefined
      ? {}
      : { selfModelSnapshotId: observations.selfModelSnapshotId }),
    ...(observations.worldStateSnapshotId === undefined
      ? {}
      : { worldStateSnapshotId: observations.worldStateSnapshotId })
  };
}

function optionalRefs(refs: Array<string | undefined>): string[] {
  return refs.filter((ref): ref is string => ref !== undefined);
}

function countLabel(count: number, label: string): string {
  return `${count} ${label}`;
}
