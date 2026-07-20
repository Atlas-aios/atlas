import { describe, expect, it } from "vitest";

import { compareSimulationPlans, simulateWorldState } from "./index.js";

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

describe("compareSimulationPlans", () => {
  it("selects the highest weighted eligible plan and explains component scores", () => {
    const result = compareSimulationPlans({
      id: "comparison:weighted",
      comparedAt: "2026-07-20T14:00:00.000Z",
      candidates: [
        {
          planId: "plan:fast-expensive",
          simulation: createComparisonSimulation("simulation:fast"),
          estimatedCost: 8,
          estimatedLatencyMs: 200,
          confidence: 0.9
        },
        {
          planId: "plan:slow-cheap",
          simulation: createComparisonSimulation("simulation:cheap"),
          estimatedCost: 2,
          estimatedLatencyMs: 800,
          confidence: 0.8
        }
      ],
      policy: comparisonPolicy()
    });

    expect(result.selectedPlanId).toBe("plan:slow-cheap");
    expect(result.rankings.map((ranking) => ranking.planId)).toEqual([
      "plan:slow-cheap",
      "plan:fast-expensive"
    ]);
    expect(result.rankings[0]).toMatchObject({
      rank: 1,
      eligible: true,
      componentScores: {
        confidence: 0.8,
        cost: 0.8,
        latency: 0.2,
        blockers: 1,
        criticalBlockers: 1
      },
      rejectionReasons: [],
      evidenceRefs: [
        "simulation:cheap",
        "world-state:comparison-source",
        "world-state:simulation:simulation:cheap"
      ]
    });
    expect(result.rankings[0]?.score).toBeCloseTo(9.2 / 11, 10);
    expect(result.rankings[1]?.score).toBeCloseTo(7.5 / 11, 10);
  });

  it("keeps blocked simulations visible but ineligible for selection", () => {
    const result = compareSimulationPlans({
      id: "comparison:blocked",
      comparedAt: "2026-07-20T14:01:00.000Z",
      candidates: [
        {
          planId: "plan:unsafe",
          simulation: createComparisonSimulation("simulation:unsafe", true),
          estimatedCost: 0,
          estimatedLatencyMs: 10,
          confidence: 1
        },
        {
          planId: "plan:safe",
          simulation: createComparisonSimulation("simulation:safe"),
          estimatedCost: 5,
          estimatedLatencyMs: 500,
          confidence: 0.7
        }
      ],
      policy: comparisonPolicy()
    });

    expect(result.selectedPlanId).toBe("plan:safe");
    expect(result.rankings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          planId: "plan:unsafe",
          eligible: false,
          rejectionReasons: expect.arrayContaining(["simulation_blocked"])
        })
      ])
    );
  });

  it("uses stable tie breakers when weighted scores are equal", () => {
    const result = compareSimulationPlans({
      id: "comparison:tie",
      comparedAt: "2026-07-20T14:02:00.000Z",
      candidates: [
        {
          planId: "plan:b",
          simulation: createComparisonSimulation("simulation:b"),
          estimatedCost: 5,
          estimatedLatencyMs: 500,
          confidence: 0.8
        },
        {
          planId: "plan:a",
          simulation: createComparisonSimulation("simulation:a"),
          estimatedCost: 5,
          estimatedLatencyMs: 500,
          confidence: 0.8
        }
      ],
      policy: comparisonPolicy()
    });

    expect(result.rankings.map((ranking) => ranking.planId)).toEqual([
      "plan:a",
      "plan:b"
    ]);
    expect(result.selectedPlanId).toBe("plan:a");
  });

  it("rejects policies without a positive comparison weight", () => {
    expect(() =>
      compareSimulationPlans({
        id: "comparison:no-weights",
        comparedAt: "2026-07-20T14:03:00.000Z",
        candidates: comparisonCandidates(),
        policy: {
          ...comparisonPolicy(),
          weights: {
            confidence: 0,
            cost: 0,
            latency: 0,
            blockers: 0,
            criticalBlockers: 0
          }
        }
      })
    ).toThrow("at least one positive weight");
  });

  it("rejects duplicate plan candidates", () => {
    const duplicate = comparisonCandidates();
    duplicate[1] = { ...duplicate[1]!, planId: duplicate[0]!.planId };

    expect(() =>
      compareSimulationPlans({
        id: "comparison:duplicate",
        comparedAt: "2026-07-20T14:04:00.000Z",
        candidates: duplicate,
        policy: comparisonPolicy()
      })
    ).toThrow("Duplicate plan candidate");
  });

  it("rejects simulations based on different source snapshots", () => {
    const candidates = comparisonCandidates();
    candidates[1] = {
      ...candidates[1]!,
      simulation: {
        ...candidates[1]!.simulation,
        sourceSnapshotId: "world-state:different-source"
      }
    };

    expect(() =>
      compareSimulationPlans({
        id: "comparison:mismatched-source",
        comparedAt: "2026-07-20T14:05:00.000Z",
        candidates,
        policy: comparisonPolicy()
      })
    ).toThrow("same source World State snapshot");
  });
});

function comparisonCandidates() {
  return [
    {
      planId: "plan:one",
      simulation: createComparisonSimulation("simulation:one:comparison"),
      estimatedCost: 2,
      estimatedLatencyMs: 200,
      confidence: 0.8
    },
    {
      planId: "plan:two",
      simulation: createComparisonSimulation("simulation:two:comparison"),
      estimatedCost: 3,
      estimatedLatencyMs: 300,
      confidence: 0.7
    }
  ];
}

function comparisonPolicy() {
  return {
    maximumCost: 10,
    maximumLatencyMs: 1000,
    minimumConfidence: 0.5,
    maximumBlockerIncrease: 1,
    maximumCriticalBlockerIncrease: 0,
    weights: {
      confidence: 1,
      cost: 4,
      latency: 1,
      blockers: 1,
      criticalBlockers: 4
    }
  };
}

function createComparisonSimulation(id: string, blocked = false) {
  return simulateWorldState({
    id,
    simulatedAt: "2026-07-20T13:59:00.000Z",
    source: {
      id: "world-state:comparison-source",
      capturedAt: "2026-07-20T13:58:00.000Z",
      activeGoalIds: ["goal:comparison"],
      activeExecutionIds: [],
      blockers: []
    },
    effects: blocked
      ? [
          {
            type: "add_blocker",
            blocker: {
              id: `blocker:${id}`,
              summary: "Predicted critical blocker",
              severity: "critical"
            }
          }
        ]
      : [],
    ...(blocked
      ? { thresholds: { maximumBlockers: 0, maximumCriticalBlockers: 0 } }
      : {})
  });
}
