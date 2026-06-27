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
          estimatedCost: 1,
          estimatedLatencyMs: 800
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
        estimatedCost: 1,
        estimatedLatencyMs: 800
      },
      {
        providerId: "provider:browser-ui",
        capabilityId: "capability:create-resource",
        confidence: 0.7,
        riskScore: 0.2,
        estimatedCost: 1,
        estimatedLatencyMs: 1200
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
          estimatedCost: 1,
          estimatedLatencyMs: 800
        },
        {
          providerId: "provider:browser-ui",
          capabilityId: "capability:create-resource",
          confidence: 0.72,
          riskScore: 0.2,
          estimatedCost: 1,
          estimatedLatencyMs: 1200
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

  it("uses cost and latency penalties in the ranking score", () => {
    const ranked = rankProviderCandidates({
      artifacts: [],
      request: {
        goalId: "goal:unknown-system",
        capabilityId: "capability:create-resource",
        inputs: {},
        governanceContextId: "governance:default"
      },
      candidates: [
        {
          providerId: "provider:a-slow-api",
          capabilityId: "capability:create-resource",
          confidence: 0.8,
          riskScore: 0.1,
          estimatedCost: 1,
          estimatedLatencyMs: 2000
        },
        {
          providerId: "provider:z-fast-api",
          capabilityId: "capability:create-resource",
          confidence: 0.8,
          riskScore: 0.1,
          estimatedCost: 1,
          estimatedLatencyMs: 200
        }
      ]
    });

    expect(ranked.map((candidate) => candidate.providerId)).toEqual([
      "provider:z-fast-api",
      "provider:a-slow-api"
    ]);
    expect(ranked[0]).toMatchObject({
      providerId: "provider:z-fast-api",
      costPenalty: 0.05,
      latencyPenalty: 0.01,
      rankingScore: 0.64
    });
    expect(ranked[1]).toMatchObject({
      providerId: "provider:a-slow-api",
      costPenalty: 0.05,
      latencyPenalty: 0.1,
      rankingScore: 0.55
    });
  });

  it("lets severe negative Experience outweigh cheap fast execution", () => {
    const ranked = rankProviderCandidates({
      artifacts: [
        {
          id: "experience:anti-pattern:cheap-provider",
          type: "anti_pattern",
          summary: "Cheap provider corrupted outputs for this capability.",
          evidenceMemoryEventIds: ["memory:event:7", "memory:event:8"],
          applicability: ["capability:create-resource", "provider:cheap-fast-api"],
          confidence: 0.8
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
          providerId: "provider:cheap-fast-api",
          capabilityId: "capability:create-resource",
          confidence: 0.9,
          riskScore: 0.1,
          estimatedCost: 0.1,
          estimatedLatencyMs: 100
        },
        {
          providerId: "provider:stable-api",
          capabilityId: "capability:create-resource",
          confidence: 0.75,
          riskScore: 0.15,
          estimatedCost: 2,
          estimatedLatencyMs: 1200
        }
      ],
      minimumExperienceConfidence: 0.6
    });

    expect(ranked.map((candidate) => candidate.providerId)).toEqual([
      "provider:stable-api",
      "provider:cheap-fast-api"
    ]);
  });

  it("penalizes low permission fit and high policy risk", () => {
    const ranked = rankProviderCandidates({
      artifacts: [],
      request: {
        goalId: "goal:unknown-system",
        capabilityId: "capability:create-resource",
        inputs: {},
        governanceContextId: "governance:default"
      },
      candidates: [
        {
          providerId: "provider:restricted-api",
          capabilityId: "capability:create-resource",
          confidence: 0.95,
          riskScore: 0.05,
          estimatedCost: 1,
          estimatedLatencyMs: 500,
          permissionFit: 0.2,
          policyRiskScore: 0.6
        },
        {
          providerId: "provider:allowed-api",
          capabilityId: "capability:create-resource",
          confidence: 0.75,
          riskScore: 0.1,
          estimatedCost: 1,
          estimatedLatencyMs: 500,
          permissionFit: 1,
          policyRiskScore: 0
        }
      ]
    });

    expect(ranked.map((candidate) => candidate.providerId)).toEqual([
      "provider:allowed-api",
      "provider:restricted-api"
    ]);
    expect(ranked[1]).toMatchObject({
      providerId: "provider:restricted-api",
      permissionPenalty: 0.32,
      policyPenalty: 0.24,
      rankingScore: 0.26
    });
  });

  it("penalizes low provider reputation", () => {
    const ranked = rankProviderCandidates({
      artifacts: [],
      request: {
        goalId: "goal:unknown-system",
        capabilityId: "capability:create-resource",
        inputs: {},
        governanceContextId: "governance:default"
      },
      candidates: [
        {
          providerId: "provider:low-reputation-api",
          capabilityId: "capability:create-resource",
          confidence: 0.9,
          riskScore: 0.1,
          estimatedCost: 1,
          estimatedLatencyMs: 500,
          reputationScore: 0.1
        },
        {
          providerId: "provider:trusted-api",
          capabilityId: "capability:create-resource",
          confidence: 0.75,
          riskScore: 0.1,
          estimatedCost: 1,
          estimatedLatencyMs: 500,
          reputationScore: 1
        }
      ]
    });

    expect(ranked.map((candidate) => candidate.providerId)).toEqual([
      "provider:trusted-api",
      "provider:low-reputation-api"
    ]);
    expect(ranked[1]).toMatchObject({
      providerId: "provider:low-reputation-api",
      reputationPenalty: 0.27,
      rankingScore: 0.45
    });
  });
});
