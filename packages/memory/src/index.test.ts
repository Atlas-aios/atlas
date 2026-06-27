import { describe, expect, it } from "vitest";

import type { DecisionOutcome, DecisionRequest } from "@atlas-aios/decision-engine";
import {
  createDecisionRequestFromMemoryRejection,
  recordDecisionOutcomeAsMemoryEvent,
  type MemoryDecisionRejection
} from "./index.js";

const decisionRequest: DecisionRequest = {
  id: "decision_req_create_resource",
  goalId: "goal_unknown_system",
  action: "Create a billing resource",
  actionType: "capability_execution",
  rationale: "The user asked Atlas to create the resource.",
  reversibility: "reversible",
  externalImpacts: [],
  risks: [],
  alternatives: [],
  evidenceRefs: ["knowledge:openapi:create-resource"],
  requesterIdentityId: "identity:user",
  authorityMode: "broad"
};

const decisionOutcome: DecisionOutcome = {
  requestId: decisionRequest.id,
  type: "approve",
  rationale: "The action is low-risk.",
  constraints: [],
  discussionPoints: [],
  approvalRequired: false,
  auditSeverity: "low",
  evidenceRefs: decisionRequest.evidenceRefs
};

describe("decision memory", () => {
  it("records Decision Engine outcomes as immutable Memory events", () => {
    const event = recordDecisionOutcomeAsMemoryEvent({
      id: "memory:event:decision:1",
      occurredAt: "2026-06-27T15:30:00.000Z",
      decisionOutcome,
      summary: "Decision Engine approved Create Resource."
    });

    expect(event).toEqual({
      id: "memory:event:decision:1",
      kind: "decision",
      occurredAt: "2026-06-27T15:30:00.000Z",
      summary: "Decision Engine approved Create Resource.",
      sourceIds: ["decision_req_create_resource", "knowledge:openapi:create-resource"]
    });
  });

  it("sends Memory rejection reasons back through the Decision Engine", () => {
    const memoryRejection: MemoryDecisionRejection = {
      id: "memory:rejection:duplicate-billing-resource",
      reason:
        "A previous execution created duplicate billing resources for this provider.",
      severity: "high",
      evidenceRefs: ["memory:event:failure:duplicate-billing-resource"],
      occurredAt: "2026-06-27T15:35:00.000Z"
    };

    const reconsiderationRequest = createDecisionRequestFromMemoryRejection({
      originalRequest: decisionRequest,
      memoryRejection
    });

    expect(reconsiderationRequest.id).toBe(
      "decision_req_create_resource:memory_reconsideration:memory:rejection:duplicate-billing-resource"
    );
    expect(reconsiderationRequest.risks).toContainEqual({
      kind: "memory_rejection",
      severity: "high",
      description:
        "A previous execution created duplicate billing resources for this provider.",
      requiresRejection: true
    });
    expect(reconsiderationRequest.evidenceRefs).toEqual([
      "knowledge:openapi:create-resource",
      "memory:event:failure:duplicate-billing-resource"
    ]);
  });
});
