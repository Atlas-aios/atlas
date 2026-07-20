import { describe, expect, it } from "vitest";

import {
  completeCognitiveLoopExecution,
  runBoundedCognitiveLoopCycle
} from "./index.js";

describe("runBoundedCognitiveLoopCycle", () => {
  it("observes blockers and recommends approval without executing", () => {
    const cycle = runBoundedCognitiveLoopCycle({
      id: "cognitive-loop:cycle:approval",
      goalId: "goal:runtime-create-resource",
      startedAt: "2026-07-16T12:45:00.000Z",
      completedAt: "2026-07-16T12:45:01.000Z",
      observations: {
        activeGoalIds: ["goal:runtime-create-resource"],
        activeExecutionIds: [],
        blockerIds: [
          "blocker:approval:approval:runtime:execution:runtime:create-folio"
        ],
        memoryEventIds: ["memory:event:mvp:unknown-business:learn-and-execute"],
        experienceArtifactIds: [
          "experience:playbook:unknown-business:openapi-browser-benchmark"
        ],
        capabilityIds: ["capability:create-folio"],
        simulationIds: [],
        identityIds: ["identity:user:moksh"],
        selfModelSnapshotId: "self-model:runtime:2026-07-16T12:45:00.000Z",
        worldStateSnapshotId: "world-state:runtime:2026-07-16T12:45:00.000Z"
      }
    });

    expect(cycle).toEqual({
      id: "cognitive-loop:cycle:approval",
      schemaVersion: "0.1",
      goalId: "goal:runtime-create-resource",
      startedAt: "2026-07-16T12:45:00.000Z",
      completedAt: "2026-07-16T12:45:01.000Z",
      bounded: true,
      executedAction: false,
      observations: {
        activeGoalIds: ["goal:runtime-create-resource"],
        activeExecutionIds: [],
        blockerIds: [
          "blocker:approval:approval:runtime:execution:runtime:create-folio"
        ],
        memoryEventIds: ["memory:event:mvp:unknown-business:learn-and-execute"],
        experienceArtifactIds: [
          "experience:playbook:unknown-business:openapi-browser-benchmark"
        ],
        capabilityIds: ["capability:create-folio"],
        simulationIds: [],
        identityIds: ["identity:user:moksh"],
        selfModelSnapshotId: "self-model:runtime:2026-07-16T12:45:00.000Z",
        worldStateSnapshotId: "world-state:runtime:2026-07-16T12:45:00.000Z"
      },
      phases: [
        {
          phase: "observe",
          status: "completed",
          summary:
            "Observed 1 active goal, 0 active executions, 1 blocker, and 1 capabilities.",
          evidenceRefs: [
            "world-state:runtime:2026-07-16T12:45:00.000Z",
            "self-model:runtime:2026-07-16T12:45:00.000Z"
          ]
        },
        {
          phase: "update_world_state",
          status: "completed",
          summary: "World State snapshot is current for this bounded cycle.",
          evidenceRefs: ["world-state:runtime:2026-07-16T12:45:00.000Z"]
        },
        {
          phase: "update_swm",
          status: "skipped",
          summary: "No new semantic world observations were provided.",
          evidenceRefs: []
        },
        {
          phase: "update_memory",
          status: "completed",
          summary: "Cycle references 1 Memory events.",
          evidenceRefs: ["memory:event:mvp:unknown-business:learn-and-execute"]
        },
        {
          phase: "distill_experience",
          status: "completed",
          summary: "Cycle references 1 Experience artifacts.",
          evidenceRefs: [
            "experience:playbook:unknown-business:openapi-browser-benchmark"
          ]
        },
        {
          phase: "update_self_model",
          status: "completed",
          summary: "Self Model snapshot was included in cycle context.",
          evidenceRefs: ["self-model:runtime:2026-07-16T12:45:00.000Z"]
        },
        {
          phase: "review_goals",
          status: "completed",
          summary: "Reviewed 1 active goals.",
          evidenceRefs: ["goal:runtime-create-resource"]
        },
        {
          phase: "allocate_attention",
          status: "completed",
          summary: "Attention is focused on blocker resolution.",
          evidenceRefs: [
            "blocker:approval:approval:runtime:execution:runtime:create-folio"
          ]
        },
        {
          phase: "plan",
          status: "completed",
          summary: "Next safe action is request_approval.",
          evidenceRefs: [
            "blocker:approval:approval:runtime:execution:runtime:create-folio"
          ]
        },
        {
          phase: "simulate",
          status: "skipped",
          summary: "Simulation is skipped because approval is blocking execution.",
          evidenceRefs: []
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
          summary: "Cycle outcome is waiting_for_approval.",
          evidenceRefs: [
            "blocker:approval:approval:runtime:execution:runtime:create-folio"
          ]
        },
        {
          phase: "learn",
          status: "completed",
          summary: "Cycle is ready to be recorded as Memory evidence.",
          evidenceRefs: ["cognitive-loop:cycle:approval"]
        },
        {
          phase: "rest",
          status: "completed",
          summary: "Loop stops after one bounded cycle.",
          evidenceRefs: []
        }
      ],
      nextAction: {
        type: "request_approval",
        status: "waiting_for_approval",
        reason: "Approval blockers must be resolved before Atlas can execute.",
        targetRefs: ["blocker:approval:approval:runtime:execution:runtime:create-folio"]
      }
    });
  });

  it("recommends learning when no capabilities are available", () => {
    const cycle = runBoundedCognitiveLoopCycle({
      id: "cognitive-loop:cycle:learn",
      startedAt: "2026-07-16T12:00:00.000Z",
      observations: {
        activeGoalIds: ["goal:learn-unknown-system"],
        activeExecutionIds: [],
        blockerIds: [],
        memoryEventIds: [],
        experienceArtifactIds: [],
        capabilityIds: [],
        simulationIds: [],
        identityIds: [],
        worldStateSnapshotId: "world-state:runtime:2026-07-16T12:00:00.000Z"
      }
    });

    expect(cycle.nextAction).toEqual({
      type: "learn_capabilities",
      status: "needs_learning",
      reason: "No capabilities are available for the current goal context.",
      targetRefs: ["goal:learn-unknown-system"]
    });
    expect(cycle.phases.find((phase) => phase.phase === "plan")).toMatchObject({
      status: "completed",
      summary: "Next safe action is learn_capabilities."
    });
  });

  it("requests simulation when executable work has no simulation evidence", () => {
    const cycle = runBoundedCognitiveLoopCycle({
      id: "cognitive-loop:cycle:dispatch",
      goalId: "goal:runtime-create-resource",
      startedAt: "2026-07-16T12:10:00.000Z",
      observations: {
        activeGoalIds: ["goal:runtime-create-resource"],
        activeExecutionIds: [],
        blockerIds: [],
        memoryEventIds: [],
        experienceArtifactIds: [],
        capabilityIds: ["capability:create-folio"],
        simulationIds: [],
        identityIds: [],
        selfModelSnapshotId: "self-model:runtime:2026-07-16T12:10:00.000Z",
        worldStateSnapshotId: "world-state:runtime:2026-07-16T12:10:00.000Z"
      }
    });

    expect(cycle.nextAction).toEqual({
      type: "simulate_capability",
      status: "needs_simulation",
      reason:
        "A goal and capability are available, but no successful simulation evidence is present.",
      targetRefs: ["goal:runtime-create-resource", "capability:create-folio"]
    });
    expect(cycle.phases.find((phase) => phase.phase === "simulate")).toEqual({
      phase: "simulate",
      status: "skipped",
      summary: "Simulation evidence is required before dispatch can be proposed.",
      evidenceRefs: []
    });
    expect(cycle.executedAction).toBe(false);
  });

  it("recommends dispatch only when successful simulation evidence exists", () => {
    const cycle = runBoundedCognitiveLoopCycle({
      id: "cognitive-loop:cycle:dispatch",
      goalId: "goal:runtime-create-resource",
      startedAt: "2026-07-16T12:10:00.000Z",
      observations: {
        activeGoalIds: ["goal:runtime-create-resource"],
        activeExecutionIds: [],
        blockerIds: [],
        memoryEventIds: [],
        experienceArtifactIds: [],
        capabilityIds: ["capability:create-folio"],
        simulationIds: ["simulation:create-folio:passed"],
        identityIds: [],
        selfModelSnapshotId: "self-model:runtime:2026-07-16T12:10:00.000Z",
        worldStateSnapshotId: "world-state:runtime:2026-07-16T12:10:00.000Z"
      }
    });

    expect(cycle.nextAction).toEqual({
      type: "dispatch_capability",
      status: "ready_to_dispatch",
      reason:
        "A goal, capability, and successful simulation are available with no active blockers.",
      targetRefs: [
        "goal:runtime-create-resource",
        "capability:create-folio",
        "simulation:create-folio:passed"
      ]
    });
    expect(cycle.phases.find((phase) => phase.phase === "simulate")).toEqual({
      phase: "simulate",
      status: "completed",
      summary: "Successful simulation evidence supports the dispatch proposal.",
      evidenceRefs: ["simulation:create-folio:passed"]
    });
    expect(cycle.executedAction).toBe(false);
  });

  it("records completed governed execution without mutating the source cycle", () => {
    const cycle = createDispatchReadyCycle();
    const evidenceRefs = ["execution:plan-run:one", "provider:evidence:one"];

    const completed = completeCognitiveLoopExecution({
      cycle,
      outcome: {
        id: "plan-run:one",
        status: "completed",
        occurredAt: "2026-07-20T13:01:00.000Z",
        evidenceRefs
      }
    });
    evidenceRefs.push("mutated:evidence");

    expect(completed.executedAction).toBe(true);
    expect(completed.actionTaken).toEqual({
      type: "dispatch_capability",
      executionId: "plan-run:one",
      status: "completed",
      occurredAt: "2026-07-20T13:01:00.000Z",
      targetRefs: [
        "goal:runtime-create-resource",
        "capability:create-folio",
        "simulation:create-folio:passed"
      ],
      evidenceRefs: ["execution:plan-run:one", "provider:evidence:one"]
    });
    expect(completed.nextAction).toEqual({
      type: "rest",
      status: "idle",
      reason: "The governed dispatch completed successfully.",
      targetRefs: ["plan-run:one"]
    });
    expect(completed.phases.find((phase) => phase.phase === "execute")).toEqual({
      phase: "execute",
      status: "completed",
      summary: "Governed execution plan-run:one completed.",
      evidenceRefs: ["execution:plan-run:one", "provider:evidence:one"]
    });
    expect(cycle.executedAction).toBe(false);
    expect(cycle.actionTaken).toBeUndefined();
    expect(cycle.phases.find((phase) => phase.phase === "execute")).toMatchObject({
      status: "skipped"
    });
  });

  it("records failed execution and requests review", () => {
    const failed = completeCognitiveLoopExecution({
      cycle: createDispatchReadyCycle(),
      outcome: {
        id: "plan-run:failed",
        status: "failed",
        occurredAt: "2026-07-20T13:02:00.000Z",
        evidenceRefs: ["execution:failure:one"]
      }
    });

    expect(failed.executedAction).toBe(true);
    expect(failed.nextAction).toEqual({
      type: "review_execution",
      status: "needs_review",
      reason: "The governed dispatch failed and requires review before retry.",
      targetRefs: ["plan-run:failed", "execution:failure:one"]
    });
    expect(failed.phases.find((phase) => phase.phase === "execute")).toMatchObject({
      status: "failed",
      evidenceRefs: ["execution:failure:one"]
    });
  });

  it("rejects execution continuation for a non-dispatch cycle", () => {
    const cycle = runBoundedCognitiveLoopCycle({
      id: "cognitive-loop:cycle:blocked",
      startedAt: "2026-07-20T13:00:00.000Z",
      observations: {
        activeGoalIds: ["goal:blocked"],
        activeExecutionIds: [],
        blockerIds: ["blocker:approval"],
        memoryEventIds: [],
        experienceArtifactIds: [],
        capabilityIds: ["capability:create-folio"],
        simulationIds: ["simulation:create-folio:passed"],
        identityIds: []
      }
    });

    expect(() =>
      completeCognitiveLoopExecution({
        cycle,
        outcome: {
          id: "plan-run:blocked",
          status: "completed",
          occurredAt: "2026-07-20T13:03:00.000Z",
          evidenceRefs: []
        }
      })
    ).toThrow("does not have a dispatch action ready");
  });

  it("rejects duplicate execution completion", () => {
    const first = completeCognitiveLoopExecution({
      cycle: createDispatchReadyCycle(),
      outcome: {
        id: "plan-run:one",
        status: "completed",
        occurredAt: "2026-07-20T13:01:00.000Z",
        evidenceRefs: ["execution:plan-run:one"]
      }
    });

    expect(() =>
      completeCognitiveLoopExecution({
        cycle: first,
        outcome: {
          id: "plan-run:one",
          status: "completed",
          occurredAt: "2026-07-20T13:01:00.000Z",
          evidenceRefs: ["execution:plan-run:one"]
        }
      })
    ).toThrow("already recorded an executed action");
  });
});

function createDispatchReadyCycle() {
  return runBoundedCognitiveLoopCycle({
    id: "cognitive-loop:cycle:ready-to-execute",
    goalId: "goal:runtime-create-resource",
    startedAt: "2026-07-20T13:00:00.000Z",
    observations: {
      activeGoalIds: ["goal:runtime-create-resource"],
      activeExecutionIds: [],
      blockerIds: [],
      memoryEventIds: [],
      experienceArtifactIds: [],
      capabilityIds: ["capability:create-folio"],
      simulationIds: ["simulation:create-folio:passed"],
      identityIds: []
    }
  });
}
