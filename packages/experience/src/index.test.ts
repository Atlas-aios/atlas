import { describe, expect, it } from "vitest";

import {
  distillDecisionPatternsFromMemory,
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
