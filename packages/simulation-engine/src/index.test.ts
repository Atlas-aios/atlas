import { describe, expect, it } from "vitest";

import { simulateWorldState } from "./index.js";

const source = {
  id: "world-state:source",
  capturedAt: "2026-07-20T09:00:00.000Z",
  activeGoalIds: ["goal:one"],
  activeExecutionIds: [],
  blockers: [
    {
      id: "blocker:old",
      summary: "Old blocker",
      severity: "low" as const
    }
  ]
};

describe("simulateWorldState", () => {
  it("applies ordered effects to an isolated World State branch", () => {
    const result = simulateWorldState({
      id: "simulation:one",
      simulatedAt: "2026-07-20T09:01:00.000Z",
      source,
      effects: [
        { type: "add_active_execution", executionId: "execution:new" },
        { type: "remove_blocker", blockerId: "blocker:old" },
        {
          type: "add_blocker",
          blocker: {
            id: "blocker:new",
            summary: "Predicted approval wait",
            severity: "medium"
          }
        }
      ]
    });

    expect(result.status).toBe("passed");
    expect(result.projectedSnapshot).toEqual({
      id: "world-state:simulation:simulation:one",
      capturedAt: "2026-07-20T09:01:00.000Z",
      activeGoalIds: ["goal:one"],
      activeExecutionIds: ["execution:new"],
      blockers: [
        {
          id: "blocker:new",
          summary: "Predicted approval wait",
          severity: "medium"
        }
      ]
    });
    expect(result.metrics).toEqual({
      before: {
        activeGoals: 1,
        activeExecutions: 0,
        blockers: 1,
        criticalBlockers: 0
      },
      after: {
        activeGoals: 1,
        activeExecutions: 1,
        blockers: 1,
        criticalBlockers: 0
      },
      delta: {
        activeGoals: 0,
        activeExecutions: 1,
        blockers: 0,
        criticalBlockers: 0
      }
    });
    expect(result.evidenceRefs).toEqual([
      "world-state:source",
      "world-state:simulation:simulation:one"
    ]);
    expect(source).toEqual({
      id: "world-state:source",
      capturedAt: "2026-07-20T09:00:00.000Z",
      activeGoalIds: ["goal:one"],
      activeExecutionIds: [],
      blockers: [
        {
          id: "blocker:old",
          summary: "Old blocker",
          severity: "low"
        }
      ]
    });
  });

  it("blocks a valid projection that exceeds configured safety thresholds", () => {
    const result = simulateWorldState({
      id: "simulation:critical",
      simulatedAt: "2026-07-20T09:02:00.000Z",
      source,
      effects: [
        {
          type: "add_blocker",
          blocker: {
            id: "blocker:critical",
            summary: "Predicted critical incident",
            severity: "critical"
          }
        }
      ],
      thresholds: {
        maximumBlockers: 1,
        maximumCriticalBlockers: 0
      }
    });

    expect(result.status).toBe("blocked");
    expect(result.findings.map((finding) => finding.code)).toEqual([
      "maximum_blockers_exceeded",
      "maximum_critical_blockers_exceeded"
    ]);
    expect(result.projectedSnapshot?.blockers).toHaveLength(2);
  });

  it("fails without a projected snapshot when an effect is invalid", () => {
    const result = simulateWorldState({
      id: "simulation:invalid",
      simulatedAt: "2026-07-20T09:03:00.000Z",
      source,
      effects: [{ type: "remove_active_goal", goalId: "goal:missing" }]
    });

    expect(result).toMatchObject({
      status: "failed",
      failureReason: "Active goal does not exist: goal:missing."
    });
    expect(result.projectedSnapshot).toBeUndefined();
    expect(result.findings).toEqual([
      {
        code: "invalid_effect",
        severity: "error",
        summary: "Active goal does not exist: goal:missing.",
        evidenceRefs: ["world-state:source"]
      }
    ]);
  });

  it("returns defensive copies of nested blockers and effects", () => {
    const inputBlocker = {
      id: "blocker:new",
      summary: "New blocker",
      severity: "medium" as const
    };
    const result = simulateWorldState({
      id: "simulation:copies",
      simulatedAt: "2026-07-20T09:04:00.000Z",
      source,
      effects: [{ type: "add_blocker", blocker: inputBlocker }]
    });

    inputBlocker.summary = "Mutated after simulation";
    source.blockers[0]!.summary = "Mutated source after simulation";

    expect(result.effects[0]).toEqual({
      type: "add_blocker",
      blocker: {
        id: "blocker:new",
        summary: "New blocker",
        severity: "medium"
      }
    });
    expect(result.projectedSnapshot?.blockers[0]?.summary).toBe("Old blocker");
  });
});
