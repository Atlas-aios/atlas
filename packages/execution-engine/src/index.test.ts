import { describe, expect, it } from "vitest";

import type {
  DecisionAlternative,
  DecisionAuditSeverity,
  DecisionOutcome,
  DecisionOutcomeType
} from "@atlas-aios/decision-engine";
import { evaluateExecutionGate } from "./index.js";

function outcome(
  type: DecisionOutcomeType,
  overrides: Partial<DecisionOutcome> = {}
): DecisionOutcome {
  const base: DecisionOutcome = {
    requestId: "decision-request-1",
    type,
    rationale: "Decision rationale.",
    constraints: [],
    discussionPoints: [],
    approvalRequired: false,
    auditSeverity: "low",
    evidenceRefs: ["memory:event:1"]
  };

  return { ...base, ...overrides };
}

describe("evaluateExecutionGate", () => {
  it("allows execution when the Decision Engine approves the action", () => {
    const gate = evaluateExecutionGate({
      executionId: "execution-1",
      capabilityId: "capability:create-resource",
      providerId: "provider:rest",
      decisionOutcome: outcome("approve")
    });

    expect(gate.status).toBe("allowed");
    expect(gate.executionStatus).toBe("ready");
    expect(gate.requiredAction).toBe("execute");
    expect(gate.auditSeverity).toBe("low");
  });

  it("allows execution with constraints when approval is conditional", () => {
    const gate = evaluateExecutionGate({
      executionId: "execution-1",
      capabilityId: "capability:send-message",
      providerId: "provider:email-draft",
      decisionOutcome: outcome("approve_with_constraints", {
        constraints: ["Draft only.", "Do not send externally."],
        auditSeverity: "medium"
      })
    });

    expect(gate.status).toBe("allowed_with_constraints");
    expect(gate.executionStatus).toBe("ready");
    expect(gate.requiredAction).toBe("execute_with_constraints");
    expect(gate.constraints).toEqual(["Draft only.", "Do not send externally."]);
    expect(gate.auditSeverity).toBe("medium");
  });

  it("pauses execution for discussion when the decision needs a better path", () => {
    const suggestedAlternative: DecisionAlternative = {
      action: "Create a reversible plan first.",
      reason: "Reduces irreversible impact.",
      safetyGain: "high"
    };

    const gate = evaluateExecutionGate({
      executionId: "execution-1",
      capabilityId: "capability:delete-resource",
      providerId: "provider:filesystem",
      decisionOutcome: outcome("discuss", {
        approvalRequired: true,
        auditSeverity: "high",
        discussionPoints: ["This action is irreversible."],
        suggestedAlternative
      })
    });

    expect(gate.status).toBe("waiting");
    expect(gate.executionStatus).toBe("waiting_for_discussion");
    expect(gate.requiredAction).toBe("discuss");
    expect(gate.discussionPoints).toEqual(["This action is irreversible."]);
    expect(gate.suggestedAlternative).toEqual(suggestedAlternative);
  });

  it("pauses execution for simulation before high-impact work", () => {
    const gate = evaluateExecutionGate({
      executionId: "execution-1",
      capabilityId: "capability:update-production",
      providerId: "provider:deployment",
      decisionOutcome: outcome("simulate_first", {
        approvalRequired: true,
        auditSeverity: "high",
        simulationRequirement: "Run against a World State clone first."
      })
    });

    expect(gate.status).toBe("waiting");
    expect(gate.executionStatus).toBe("waiting_for_simulation");
    expect(gate.requiredAction).toBe("simulate");
    expect(gate.simulationRequirement).toBe("Run against a World State clone first.");
  });

  it("blocks execution when the Decision Engine rejects the action", () => {
    const gate = evaluateExecutionGate({
      executionId: "execution-1",
      capabilityId: "capability:unsafe-action",
      providerId: "provider:unknown",
      decisionOutcome: outcome("reject", {
        approvalRequired: true,
        auditSeverity: "critical" satisfies DecisionAuditSeverity
      })
    });

    expect(gate.status).toBe("blocked");
    expect(gate.executionStatus).toBe("blocked_by_decision");
    expect(gate.requiredAction).toBe("stop");
  });

  it("pauses execution for human delegation when authority is not available", () => {
    const gate = evaluateExecutionGate({
      executionId: "execution-1",
      capabilityId: "capability:sign-contract",
      providerId: "provider:human",
      decisionOutcome: outcome("delegate_to_human", {
        approvalRequired: true,
        auditSeverity: "critical"
      })
    });

    expect(gate.status).toBe("waiting");
    expect(gate.executionStatus).toBe("waiting_for_human");
    expect(gate.requiredAction).toBe("delegate");
  });
});
