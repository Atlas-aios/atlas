import { describe, expect, it } from "vitest";

import type { ExperienceArtifact } from "@atlas-aios/experience";
import { lookupPlanningExperience } from "./index.js";

describe("lookupPlanningExperience", () => {
  it("returns planning-relevant Experience for requested capabilities", () => {
    const artifacts: ExperienceArtifact[] = [
      {
        id: "experience:heuristic:create-resource",
        type: "heuristic",
        summary: "Use idempotency keys for resource creation.",
        evidenceMemoryEventIds: ["memory:event:1", "memory:event:2"],
        applicability: ["capability:create-resource"],
        confidence: 0.9
      },
      {
        id: "experience:decision-pattern:delete-resource",
        type: "decision_pattern",
        summary: "Delete resource needs extra review.",
        evidenceMemoryEventIds: ["memory:event:3", "memory:event:4"],
        applicability: ["capability:delete-resource"],
        confidence: 0.8
      }
    ];

    const result = lookupPlanningExperience({
      artifacts,
      goalId: "goal:unknown-system",
      capabilityIds: ["capability:create-resource"],
      minimumConfidence: 0.7
    });

    expect(result).toEqual({
      goalId: "goal:unknown-system",
      guidance: [
        {
          capabilityId: "capability:create-resource",
          artifacts: [artifacts[0]]
        }
      ]
    });
  });
});
