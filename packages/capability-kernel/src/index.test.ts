import { describe, expect, it } from "vitest";

import type { ExperienceArtifact } from "@atlas-aios/experience";
import { lookupProviderExperience } from "./index.js";

describe("lookupProviderExperience", () => {
  it("returns provider-scoped Experience for each provider candidate", () => {
    const artifacts: ExperienceArtifact[] = [
      {
        id: "experience:decision-pattern:billing-provider",
        type: "decision_pattern",
        summary: "Billing API produced duplicate resources before.",
        evidenceMemoryEventIds: ["memory:event:1", "memory:event:2"],
        applicability: ["capability:create-resource", "provider:billing-api"],
        confidence: 0.8
      },
      {
        id: "experience:decision-pattern:crm-provider",
        type: "decision_pattern",
        summary: "CRM API has separate evidence.",
        evidenceMemoryEventIds: ["memory:event:3", "memory:event:4"],
        applicability: ["capability:create-resource", "provider:crm-api"],
        confidence: 0.7
      }
    ];

    const result = lookupProviderExperience({
      artifacts,
      request: {
        goalId: "goal:unknown-system",
        capabilityId: "capability:create-resource",
        inputs: {},
        governanceContextId: "governance:default"
      },
      candidates: [
        {
          providerId: "provider:billing-api",
          capabilityId: "capability:create-resource",
          confidence: 0.9,
          riskScore: 0.2,
          estimatedCost: 1
        }
      ],
      minimumConfidence: 0.6
    });

    expect(result).toEqual([
      {
        providerId: "provider:billing-api",
        capabilityId: "capability:create-resource",
        artifacts: [artifacts[0]]
      }
    ]);
  });
});
