import { describe, expect, it } from "vitest";

import {
  distillDecisionPatternsFromMemory,
  lookupExperienceArtifacts,
  type ExperienceArtifact,
  type DecisionMemoryObservation
} from "./index.js";

function observation(
  overrides: Partial<DecisionMemoryObservation>
): DecisionMemoryObservation {
  return {
    memoryEventId: "memory:event:decision:1",
    actionType: "capability_execution",
    outcomeType: "reject",
    rationale: "Memory rejected duplicate resource creation.",
    riskKinds: ["memory_rejection"],
    applicability: ["provider:billing-api", "capability:create-resource"],
    occurredAt: "2026-06-27T15:30:00.000Z",
    ...overrides
  };
}

describe("distillDecisionPatternsFromMemory", () => {
  it("creates a decision pattern artifact from repeated scoped decision observations", () => {
    const artifacts = distillDecisionPatternsFromMemory({
      observations: [
        observation({ memoryEventId: "memory:event:decision:1" }),
        observation({
          memoryEventId: "memory:event:decision:2",
          occurredAt: "2026-06-27T16:30:00.000Z"
        })
      ]
    });

    expect(artifacts).toEqual([
      {
        id: "experience:decision-pattern:capability_execution:reject:memory_rejection:capability_create-resource-provider_billing-api",
        type: "decision_pattern",
        summary:
          "For capability_execution with risks memory_rejection, prior evidence repeatedly led to reject.",
        evidenceMemoryEventIds: ["memory:event:decision:1", "memory:event:decision:2"],
        applicability: ["capability:create-resource", "provider:billing-api"],
        confidence: 0.7
      }
    ]);
  });

  it("does not create patterns from a single observation", () => {
    const artifacts = distillDecisionPatternsFromMemory({
      observations: [observation({ memoryEventId: "memory:event:decision:1" })]
    });

    expect(artifacts).toEqual([]);
  });

  it("does not overgeneralize across different applicability scopes", () => {
    const artifacts = distillDecisionPatternsFromMemory({
      observations: [
        observation({
          memoryEventId: "memory:event:decision:1",
          applicability: ["provider:billing-api", "capability:create-resource"]
        }),
        observation({
          memoryEventId: "memory:event:decision:2",
          applicability: ["provider:crm-api", "capability:create-resource"]
        })
      ]
    });

    expect(artifacts).toEqual([]);
  });
});

describe("lookupExperienceArtifacts", () => {
  const artifacts: ExperienceArtifact[] = [
    {
      id: "experience:decision-pattern:create-resource:billing",
      type: "decision_pattern",
      summary: "Billing provider repeatedly rejected duplicate resources.",
      evidenceMemoryEventIds: ["memory:event:decision:1", "memory:event:decision:2"],
      applicability: ["capability:create-resource", "provider:billing-api"],
      confidence: 0.7
    },
    {
      id: "experience:decision-pattern:create-resource:crm",
      type: "decision_pattern",
      summary: "CRM provider has a different scoped pattern.",
      evidenceMemoryEventIds: ["memory:event:decision:3", "memory:event:decision:4"],
      applicability: ["capability:create-resource", "provider:crm-api"],
      confidence: 0.8
    },
    {
      id: "experience:heuristic:create-resource",
      type: "heuristic",
      summary: "Create resources with idempotency keys when available.",
      evidenceMemoryEventIds: ["memory:event:decision:5", "memory:event:decision:6"],
      applicability: ["capability:create-resource"],
      confidence: 0.9
    }
  ];

  it("returns scoped artifacts that match requested applicability", () => {
    const matches = lookupExperienceArtifacts({
      artifacts,
      query: {
        artifactTypes: ["decision_pattern"],
        applicability: ["capability:create-resource", "provider:billing-api"],
        minimumConfidence: 0.6
      }
    });

    expect(matches.map((artifact) => artifact.id)).toEqual([
      "experience:decision-pattern:create-resource:billing"
    ]);
  });

  it("sorts matches by confidence without widening the requested scope", () => {
    const matches = lookupExperienceArtifacts({
      artifacts,
      query: {
        applicability: ["capability:create-resource"],
        minimumConfidence: 0.6
      }
    });

    expect(matches.map((artifact) => artifact.id)).toEqual([
      "experience:heuristic:create-resource",
      "experience:decision-pattern:create-resource:crm",
      "experience:decision-pattern:create-resource:billing"
    ]);
  });
});
