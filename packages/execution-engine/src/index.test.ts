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
  createMemoryCheckpointStore,
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

  it("preserves validated provider resource usage on completed steps", async () => {
    const result = await runSequentialWorkflow({
      session: createExecutionSession({
        id: "execution:metered-provider",
        workflowId: "workflow:metered-provider",
        startedAt: "2026-07-20T16:00:00.000Z"
      }),
      workflow: {
        id: "workflow:metered-provider",
        version: "0.1",
        nodes: [
          {
            id: "node:metered",
            type: "capability",
            inputs: {}
          }
        ],
        edges: []
      },
      handlers: {
        capability: async () => ({
          outputs: { resourceId: "resource:metered" },
          evidenceRefs: ["trace:provider:metered"],
          resourceUsage: {
            cost: 0.04,
            unit: "atlas_credit",
            evidenceRef: "meter:provider:request:1"
          }
        })
      }
    });

    expect(result.steps).toEqual([
      {
        nodeId: "node:metered",
        status: "completed",
        outputs: { resourceId: "resource:metered" },
        evidenceRefs: ["trace:provider:metered"],
        resourceUsage: {
          cost: 0.04,
          unit: "atlas_credit",
          evidenceRef: "meter:provider:request:1"
        }
      }
    ]);
  });

  it("retries failed workflow nodes before marking execution failed", async () => {
    const scheduledDelays: number[] = [];
    let attempts = 0;

    const result = await runSequentialWorkflow({
      session: createExecutionSession({
        id: "execution:retrying-node",
        workflowId: "workflow:retrying-node",
        startedAt: "2026-06-28T00:00:00.000Z"
      }),
      workflow: {
        id: "workflow:retrying-node",
        version: "0.1",
        nodes: [
          {
            id: "node:unstable",
            type: "capability",
            retryPolicy: {
              maxAttempts: 3,
              initialDelayMs: 100,
              backoffMultiplier: 2
            },
            inputs: { value: "eventual-success" }
          }
        ],
        edges: []
      },
      handlers: {
        capability: () => {
          attempts += 1;

          if (attempts < 3) {
            throw new Error(`Transient failure ${attempts}`);
          }

          return {
            outputs: { attempts },
            evidenceRefs: ["trace:node:unstable"]
          };
        }
      },
      scheduleDelay: (delayMs) => {
        scheduledDelays.push(delayMs);
      }
    });

    expect(result.status).toBe("completed");
    expect(result.steps).toEqual([
      {
        nodeId: "node:unstable",
        status: "completed",
        outputs: { attempts: 3 },
        evidenceRefs: ["trace:node:unstable"]
      }
    ]);
    expect(scheduledDelays).toEqual([100, 200]);
    expect(result.events).toEqual([
      {
        type: "execution.session.started",
        executionId: "execution:retrying-node"
      },
      {
        type: "execution.step.started",
        executionId: "execution:retrying-node",
        nodeId: "node:unstable"
      },
      {
        type: "execution.step.retrying",
        executionId: "execution:retrying-node",
        nodeId: "node:unstable",
        attempt: 1,
        delayMs: 100
      },
      {
        type: "execution.step.retrying",
        executionId: "execution:retrying-node",
        nodeId: "node:unstable",
        attempt: 2,
        delayMs: 200
      },
      {
        type: "execution.step.completed",
        executionId: "execution:retrying-node",
        nodeId: "node:unstable"
      },
      {
        type: "execution.session.completed",
        executionId: "execution:retrying-node"
      }
    ]);
  });

  it("saves checkpoints after completed steps and session completion", async () => {
    const checkpointStore = createMemoryCheckpointStore();

    const result = await runSequentialWorkflow({
      session: createExecutionSession({
        id: "execution:checkpointed",
        workflowId: "workflow:checkpointed",
        startedAt: "2026-06-28T00:00:00.000Z"
      }),
      workflow: {
        id: "workflow:checkpointed",
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
        capability: ({ node }) => ({
          outputs: { nodeId: node.id },
          evidenceRefs: [`trace:${node.id}`]
        })
      },
      checkpointStore,
      checkpointClock: () => "2026-06-28T00:00:00.000Z"
    });

    expect(result.status).toBe("completed");
    expect(checkpointStore.checkpoints.map((checkpoint) => checkpoint.reason)).toEqual([
      "step_completed",
      "step_completed",
      "session_completed"
    ]);
    expect(checkpointStore.checkpoints[0]).toMatchObject({
      id: "execution:checkpointed:checkpoint:1",
      executionId: "execution:checkpointed",
      workflowId: "workflow:checkpointed",
      reason: "step_completed",
      status: "running",
      lastNodeId: "node:prepare",
      completedNodeIds: ["node:prepare"],
      failedNodeIds: []
    });
    expect(checkpointStore.checkpoints.at(-1)).toMatchObject({
      id: "execution:checkpointed:checkpoint:3",
      reason: "session_completed",
      status: "completed",
      completedNodeIds: ["node:prepare", "node:create"],
      failedNodeIds: []
    });
  });

  it("streams execution events as the workflow runs", async () => {
    const streamedEvents: string[] = [];

    const result = await runSequentialWorkflow({
      session: createExecutionSession({
        id: "execution:streamed",
        workflowId: "workflow:streamed",
        startedAt: "2026-06-28T00:00:00.000Z"
      }),
      workflow: {
        id: "workflow:streamed",
        version: "0.1",
        nodes: [
          {
            id: "node:streamed",
            type: "capability",
            inputs: { value: "event-stream" }
          }
        ],
        edges: []
      },
      handlers: {
        capability: ({ node }) => ({
          outputs: { nodeId: node.id },
          evidenceRefs: [`trace:${node.id}`]
        })
      },
      onEvent: (event) => {
        streamedEvents.push(
          event.nodeId === undefined ? event.type : `${event.type}:${event.nodeId}`
        );
      }
    });

    expect(result.status).toBe("completed");
    expect(streamedEvents).toEqual([
      "execution.session.started",
      "execution.step.started:node:streamed",
      "execution.step.completed:node:streamed",
      "execution.session.completed"
    ]);
  });

  it("executes wait nodes with the workflow scheduler", async () => {
    const scheduledDelays: number[] = [];

    const result = await runSequentialWorkflow({
      session: createExecutionSession({
        id: "execution:wait-node",
        workflowId: "workflow:wait-node",
        startedAt: "2026-06-28T00:00:00.000Z"
      }),
      workflow: {
        id: "workflow:wait-node",
        version: "0.1",
        nodes: [
          {
            id: "node:wait",
            type: "wait",
            inputs: { delayMs: 250 }
          }
        ],
        edges: []
      },
      handlers: {},
      scheduleDelay: (delayMs) => {
        scheduledDelays.push(delayMs);
      }
    });

    expect(result.status).toBe("completed");
    expect(scheduledDelays).toEqual([250]);
    expect(result.steps).toEqual([
      {
        nodeId: "node:wait",
        status: "completed",
        outputs: { waitedMs: 250 },
        evidenceRefs: ["execution.wait:node:wait"]
      }
    ]);
  });

  it("pauses workflow execution on approval nodes", async () => {
    const result = await runSequentialWorkflow({
      session: createExecutionSession({
        id: "execution:approval-node",
        workflowId: "workflow:approval-node",
        startedAt: "2026-06-28T00:00:00.000Z"
      }),
      workflow: {
        id: "workflow:approval-node",
        version: "0.1",
        nodes: [
          {
            id: "node:approval",
            type: "approval",
            inputs: {
              approvalRequestId: "approval:deploy-production",
              reason: "Production deployment requires owner approval."
            }
          },
          {
            id: "node:deploy",
            type: "capability",
            inputs: { value: "deploy" }
          }
        ],
        edges: [
          {
            fromNodeId: "node:approval",
            toNodeId: "node:deploy"
          }
        ]
      },
      handlers: {
        capability: () => ({
          outputs: { deployed: true },
          evidenceRefs: ["trace:deploy"]
        })
      }
    });

    expect(result.status).toBe("waiting");
    expect(result.session.status).toBe("waiting");
    expect(result.steps).toEqual([
      {
        nodeId: "node:approval",
        status: "waiting",
        outputs: {
          approvalRequestId: "approval:deploy-production",
          reason: "Production deployment requires owner approval."
        },
        evidenceRefs: ["execution.approval:approval:deploy-production"]
      }
    ]);
    expect(result.events.map((event) => event.type)).toEqual([
      "execution.session.started",
      "execution.step.started",
      "execution.step.waiting",
      "execution.session.waiting"
    ]);
  });

  it("pauses workflow execution on human provider nodes", async () => {
    const result = await runSequentialWorkflow({
      session: createExecutionSession({
        id: "execution:human-provider-node",
        workflowId: "workflow:human-provider-node",
        startedAt: "2026-06-28T00:00:00.000Z"
      }),
      workflow: {
        id: "workflow:human-provider-node",
        version: "0.1",
        nodes: [
          {
            id: "node:human-review",
            type: "human_provider",
            inputs: {
              humanProviderId: "human:moksh",
              task: "Review generated production deployment plan.",
              instructions: "Approve only if rollback evidence is attached."
            }
          }
        ],
        edges: []
      },
      handlers: {}
    });

    expect(result.status).toBe("waiting");
    expect(result.steps).toEqual([
      {
        nodeId: "node:human-review",
        status: "waiting",
        outputs: {
          humanProviderId: "human:moksh",
          task: "Review generated production deployment plan.",
          instructions: "Approve only if rollback evidence is attached."
        },
        evidenceRefs: ["execution.human_provider:human:moksh"]
      }
    ]);
  });

  it("rolls back completed provider-backed steps when a later node fails", async () => {
    const registry = createProviderRegistry();
    const compensations: string[] = [];
    const streamedEvents: string[] = [];

    registerProvider(registry, {
      manifest: {
        id: "provider:resource:create",
        name: "Resource Create Provider",
        version: "0.1.0",
        lifecycle: "healthy",
        capabilityIds: ["capability:resource:create"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: [],
        inputSchema: [{ name: "name", type: "string", required: true }],
        outputSchema: [{ name: "resourceId", type: "string", required: true }]
      },
      handler: async (request) => ({
        outputs: { resourceId: `resource:${request.inputs.name}` },
        evidence: ["trace:create-resource"],
        compensationRef: `resource:${request.inputs.name}`
      }),
      compensate: async (request) => {
        compensations.push(request.compensationRef);
        return {
          outputs: { deletedResourceId: request.compensationRef },
          evidence: ["trace:delete-resource"]
        };
      }
    });

    registerProvider(registry, {
      manifest: {
        id: "provider:resource:update",
        name: "Resource Update Provider",
        version: "0.1.0",
        lifecycle: "healthy",
        capabilityIds: ["capability:resource:update"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: [],
        inputSchema: [{ name: "resourceId", type: "string", required: true }],
        outputSchema: [{ name: "updated", type: "boolean", required: true }]
      },
      handler: async () => {
        throw new Error("update failed after create");
      }
    });

    const result = await runSequentialWorkflow({
      session: createExecutionSession({
        id: "execution:rollback-provider",
        workflowId: "workflow:rollback-provider",
        startedAt: "2026-06-28T00:00:00.000Z"
      }),
      workflow: {
        id: "workflow:rollback-provider",
        version: "0.1",
        nodes: [
          {
            id: "node:create",
            type: "capability",
            inputs: {
              providerId: "provider:resource:create",
              capabilityId: "capability:resource:create",
              inputs: { name: "invoice" }
            }
          },
          {
            id: "node:update",
            type: "capability",
            inputs: {
              providerId: "provider:resource:update",
              capabilityId: "capability:resource:update",
              inputs: { resourceId: "resource:invoice" }
            }
          }
        ],
        edges: [
          {
            fromNodeId: "node:create",
            toNodeId: "node:update"
          }
        ]
      },
      handlers: {
        capability: createProviderBackedCapabilityHandler({ registry })
      },
      providerRegistry: registry,
      onEvent: (event) => {
        streamedEvents.push(
          event.nodeId === undefined ? event.type : `${event.type}:${event.nodeId}`
        );
      }
    });

    expect(result.status).toBe("failed");
    expect(compensations).toEqual(["resource:invoice"]);
    expect(result.rollback).toEqual({
      status: "completed",
      compensations: [
        {
          nodeId: "node:create",
          status: "compensated",
          outputs: { deletedResourceId: "resource:invoice" },
          evidenceRefs: ["trace:delete-resource"]
        }
      ]
    });
    expect(streamedEvents).toContain("execution.rollback.started");
    expect(streamedEvents).toContain("execution.compensation.started:node:create");
    expect(streamedEvents).toContain("execution.compensation.completed:node:create");
    expect(streamedEvents).toContain("execution.rollback.completed");
  });

  it("runs parallel node branches and returns grouped branch results", async () => {
    const completionOrder: string[] = [];

    const result = await runSequentialWorkflow({
      session: createExecutionSession({
        id: "execution:parallel-node",
        workflowId: "workflow:parallel-node",
        startedAt: "2026-06-28T00:00:00.000Z"
      }),
      workflow: {
        id: "workflow:parallel-node",
        version: "0.1",
        nodes: [
          {
            id: "node:parallel",
            type: "parallel",
            inputs: {
              branches: [
                {
                  id: "branch:a",
                  nodes: [
                    {
                      id: "node:a",
                      type: "capability",
                      inputs: { value: "a" }
                    }
                  ],
                  edges: []
                },
                {
                  id: "branch:b",
                  nodes: [
                    {
                      id: "node:b",
                      type: "capability",
                      inputs: { value: "b" }
                    }
                  ],
                  edges: []
                }
              ]
            }
          }
        ],
        edges: []
      },
      handlers: {
        capability: async ({ node }) => {
          completionOrder.push(node.id);
          return {
            outputs: { value: node.inputs.value },
            evidenceRefs: [`trace:${node.id}`]
          };
        }
      }
    });

    expect(result.status).toBe("completed");
    expect(completionOrder.sort()).toEqual(["node:a", "node:b"]);
    expect(result.steps).toEqual([
      {
        nodeId: "node:parallel",
        status: "completed",
        outputs: {
          branches: [
            {
              branchId: "branch:a",
              status: "completed",
              steps: [
                {
                  nodeId: "node:a",
                  status: "completed",
                  outputs: { value: "a" },
                  evidenceRefs: ["trace:node:a"]
                }
              ]
            },
            {
              branchId: "branch:b",
              status: "completed",
              steps: [
                {
                  nodeId: "node:b",
                  status: "completed",
                  outputs: { value: "b" },
                  evidenceRefs: ["trace:node:b"]
                }
              ]
            }
          ]
        },
        evidenceRefs: ["execution.parallel:node:parallel"]
      }
    ]);
  });
});
