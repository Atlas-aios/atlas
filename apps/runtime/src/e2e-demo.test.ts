import { describe, expect, it } from "vitest";

import { runAtlasRuntimeE2EDemo } from "./e2e-demo.js";

describe("Atlas runtime E2E demo", () => {
  it("starts Atlas and demonstrates goal to observe loop over HTTP", async () => {
    await expect(runAtlasRuntimeE2EDemo()).resolves.toMatchObject({
      goalId: "goal:e2e:create-resource",
      learnedCapabilityCount: 3,
      workflowId: "workflow:e2e:create-resource",
      thoughtId: "thought:e2e:provider-choice",
      simulationId: "simulation:e2e:create-folio",
      simulationStatus: "simulated",
      executionStatus: "completed",
      approvalStatus: "approved",
      browserObservationMatched: true,
      worldStateGoalCount: 1
    });
  });
});
