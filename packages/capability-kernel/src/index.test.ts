import { describe, expect, it } from "vitest";

import type { ExperienceArtifact } from "@atlas-aios/experience";
import { lookupProviderExperience, rankProviderCandidates } from "./index.js";

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

describe("rankProviderCandidates", () => {
  it("penalizes providers with negative Experience patterns", () => {
    const candidates = [
      {
        providerId: "provider:billing-api",
        capabilityId: "capability:create-resource",
        confidence: 0.9,
        riskScore: 0.1,
        estimatedCost: 1
      },
      {
        providerId: "provider:browser-ui",
        capabilityId: "capability:create-resource",
        confidence: 0.7,
        riskScore: 0.2,
        estimatedCost: 1
      }
    ];

    const ranked = rankProviderCandidates({
      artifacts: [
        {
          id: "experience:decision-pattern:billing-provider",
          type: "decision_pattern",
          summary: "Prior evidence repeatedly led to reject.",
          evidenceMemoryEventIds: ["memory:event:1", "memory:event:2"],
          applicability: ["capability:create-resource", "provider:billing-api"],
          confidence: 0.8
        }
      ],
      request: {
        goalId: "goal:unknown-system",
        capabilityId: "capability:create-resource",
        inputs: {},
        governanceContextId: "governance:default"
      },
      candidates,
      minimumExperienceConfidence: 0.6
    });

    expect(ranked.map((candidate) => candidate.providerId)).toEqual([
      "provider:browser-ui",
      "provider:billing-api"
    ]);
    expect(ranked[1]).toMatchObject({
      providerId: "provider:billing-api",
      adjustedConfidence: 0.66,
      adjustedRiskScore: 0.5,
      experienceAdjustment: -0.24,
      experienceArtifactIds: ["experience:decision-pattern:billing-provider"]
    });
  });

  it("boosts providers with helpful Experience but keeps the boost smaller than penalties", () => {
    const ranked = rankProviderCandidates({
      artifacts: [
        {
          id: "experience:playbook:billing-provider",
          type: "playbook",
          summary: "Use idempotency keys with the billing provider.",
          evidenceMemoryEventIds: ["memory:event:3", "memory:event:4"],
          applicability: ["capability:create-resource", "provider:billing-api"],
          confidence: 0.8
        },
        {
          id: "experience:anti-pattern:browser-provider",
          type: "anti_pattern",
          summary: "Browser provider is flaky for this capability.",
          evidenceMemoryEventIds: ["memory:event:5", "memory:event:6"],
          applicability: ["capability:create-resource", "provider:browser-ui"],
          confidence: 0.7
        }
      ],
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
          confidence: 0.7,
          riskScore: 0.2,
          estimatedCost: 1
        },
        {
          providerId: "provider:browser-ui",
          capabilityId: "capability:create-resource",
          confidence: 0.72,
          riskScore: 0.2,
          estimatedCost: 1
        }
      ],
      minimumExperienceConfidence: 0.6
    });

    expect(ranked.map((candidate) => candidate.providerId)).toEqual([
      "provider:billing-api",
      "provider:browser-ui"
    ]);
    expect(ranked[0]).toMatchObject({
      providerId: "provider:billing-api",
      adjustedConfidence: 0.78,
      adjustedRiskScore: 0.12,
      experienceAdjustment: 0.08
    });
    expect(ranked[1]).toMatchObject({
      providerId: "provider:browser-ui",
      adjustedConfidence: 0.44,
      adjustedRiskScore: 0.55,
      experienceAdjustment: -0.28
    });
  });
});
