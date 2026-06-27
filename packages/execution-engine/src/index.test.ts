import { describe, expect, it } from "vitest";

import type {
  DecisionAlternative,
  DecisionAuditSeverity,
  DecisionOutcome,
  DecisionOutcomeType
} from "@atlas-aios/decision-engine";
import { createProviderRegistry, registerProvider } from "@atlas-aios/providers-sdk";
import {
  createExecutionSession,
  createProviderBackedCapabilityHandler,
  evaluateExecutionGate,
  runSequentialWorkflow,
  validateWorkflow
} from "./index.js";

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

describe("workflow execution", () => {
  it("validates workflows before execution", () => {
    expect(
      validateWorkflow({
        id: "workflow:create-resource",
        version: "0.1",
        nodes: [
          {
            id: "node:create-resource",
            type: "capability",
            inputs: { capabilityId: "capability:create-resource" }
          }
        ],
        edges: []
      })
    ).toEqual({ valid: true, errors: [] });

    expect(
      validateWorkflow({
        id: "workflow:invalid",
        version: "0.1",
        nodes: [],
        edges: [
          {
            fromNodeId: "missing:start",
            toNodeId: "missing:end"
          }
        ]
      })
    ).toEqual({
      valid: false,
      errors: [
        "Workflow must include at least one node.",
        "Edge source node not found: missing:start",
        "Edge target node not found: missing:end"
      ]
    });
  });

  it("creates execution sessions and runs workflow nodes sequentially", async () => {
    const session = createExecutionSession({
      id: "execution:create-resource:1",
      workflowId: "workflow:create-resource",
      startedAt: "2026-06-28T00:00:00.000Z"
    });

    const result = await runSequentialWorkflow({
      session,
      workflow: {
        id: "workflow:create-resource",
        version: "0.1",
        nodes: [
          {
            id: "node:prepare",
            type: "capability",
            inputs: { value: "invoice" }
          },
          {
            id: "node:create",
            type: "capability",
            inputs: { from: "node:prepare" }
          }
        ],
        edges: [
          {
            fromNodeId: "node:prepare",
            toNodeId: "node:create"
          }
        ]
      },
      handlers: {
        capability: async ({ node, previousOutputs }) => ({
          outputs: {
            nodeId: node.id,
            previousCount: previousOutputs.length
          },
          evidenceRefs: [`trace:${node.id}`]
        })
      }
    });

    expect(result.status).toBe("completed");
    expect(result.steps.map((step) => step.status)).toEqual(["completed", "completed"]);
    expect(result.steps[1]?.outputs).toEqual({
      nodeId: "node:create",
      previousCount: 1
    });
    expect(result.events.map((event) => event.type)).toEqual([
      "execution.session.started",
      "execution.step.started",
      "execution.step.completed",
      "execution.step.started",
      "execution.step.completed",
      "execution.session.completed"
    ]);
  });

  it("runs capability nodes through the Provider SDK registry", async () => {
    const registry = createProviderRegistry();
    registerProvider(registry, {
      manifest: {
        id: "provider:rest:create-resource",
        name: "REST Create Resource Provider",
        version: "0.1.0",
        lifecycle: "healthy",
        capabilityIds: ["capability:create-resource"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: [],
        inputSchema: [{ name: "name", type: "string", required: true }],
        outputSchema: [{ name: "resourceId", type: "string", required: true }]
      },
      handler: async (request) => ({
        outputs: { resourceId: `resource:${request.inputs.name}` },
        evidence: ["trace:provider:create-resource"]
      })
    });

    const result = await runSequentialWorkflow({
      session: createExecutionSession({
        id: "execution:create-resource:provider",
        workflowId: "workflow:create-resource",
        startedAt: "2026-06-28T00:00:00.000Z"
      }),
      workflow: {
        id: "workflow:create-resource",
        version: "0.1",
        nodes: [
          {
            id: "node:create-resource",
            type: "capability",
            inputs: {
              providerId: "provider:rest:create-resource",
              capabilityId: "capability:create-resource",
              inputs: { name: "invoice" }
            }
          }
        ],
        edges: []
      },
      handlers: {
        capability: createProviderBackedCapabilityHandler({ registry })
      }
    });

    expect(result.status).toBe("completed");
    expect(result.steps).toEqual([
      {
        nodeId: "node:create-resource",
        status: "completed",
        outputs: { resourceId: "resource:invoice" },
        evidenceRefs: ["trace:provider:create-resource"]
      }
    ]);
  });
});
