import { describe, expect, it } from "vitest";

import { resumePlanRun, startPlanRun } from "./plan-orchestrator.js";

describe("governed Atlas plan orchestration", () => {
  it("resolves and executes an approved multi-step plan as one ordered AtlasFlow", async () => {
    const executed: string[] = [];
    const run = await startPlanRun(
      {
        id: "plan-run:low-risk",
        plan: {
          id: "plan:low-risk",
          goalId: "goal:low-risk",
          rationale: "Inspect then create the local resource.",
          risks: [],
          steps: [
            {
              id: "plan:low-risk:step:1",
              capabilityId: "capability:inspect",
              purpose: "Inspect local evidence.",
              requiresApproval: false
            },
            {
              id: "plan:low-risk:step:2",
              capabilityId: "capability:create-local",
              purpose: "Create a reversible local resource.",
              requiresApproval: false
            }
          ]
        },
        requesterIdentityId: "identity:user:moksh",
        authorityMode: "broad",
        governanceContextId: "governance:local",
        budgetId: "budget:project:atlas",
        costUnit: "atlas_credit",
        startedAt: "2026-07-20T09:00:00.000Z",
        steps: {
          "plan:low-risk:step:1": {
            inputs: { source: "local" },
            reversibility: "reversible",
            externalImpacts: []
          },
          "plan:low-risk:step:2": {
            inputs: { name: "draft" },
            reversibility: "reversible",
            externalImpacts: []
          }
        }
      },
      {
        resolveCapability: async ({ capabilityId }) => ({
          selectedProviderId: `provider:${capabilityId}`,
          candidates: [
            {
              providerId: `provider:${capabilityId}`,
              capabilityId,
              confidence: 0.9,
              riskScore: 0.1,
              estimatedCost: 0.05,
              estimatedLatencyMs: 100
            }
          ],
          approvalRequired: false,
          simulationRequired: false,
          rationale: "Selected the local provider."
        }),
        simulateStep: async () => {
          throw new Error("Simulation must not run for approved low-risk work.");
        },
        requestApproval: () => {
          throw new Error("Approval must not be requested for low-risk work.");
        },
        executeCapability: async ({ node }) => {
          executed.push(node.id);
          return {
            outputs: { nodeId: node.id },
            evidenceRefs: [`execution:${node.id}`],
            resourceUsage: {
              cost: 0.04,
              unit: "atlas_credit",
              evidenceRef: `meter:${node.id}`
            }
          };
        },
        reserveExecutionCost: async () => ({
          reservationId: "reservation:plan-run:low-risk",
          evidenceRefs: ["ledger:reservation:plan-run:low-risk"]
        }),
        settleExecutionCost: async () => ({
          evidenceRefs: ["ledger:settlement:plan-run:low-risk"]
        }),
        releaseExecutionCost: async () => ({ evidenceRefs: [] })
      }
    );

    expect(run.status).toBe("completed");
    expect(run.steps.map((step) => step.decision.type)).toEqual(["approve", "approve"]);
    expect(run.workflow).toEqual({
      id: "atlasflow:plan-run:low-risk",
      version: "0.1",
      nodes: [
        {
          id: "plan:low-risk:step:1",
          type: "capability",
          inputs: {
            providerId: "provider:capability:inspect",
            capabilityId: "capability:inspect",
            inputs: { source: "local" },
            costUnit: "atlas_credit"
          }
        },
        {
          id: "plan:low-risk:step:2",
          type: "capability",
          inputs: {
            providerId: "provider:capability:create-local",
            capabilityId: "capability:create-local",
            inputs: { name: "draft" },
            costUnit: "atlas_credit"
          }
        }
      ],
      edges: [
        {
          id: "atlasflow:plan-run:low-risk:edge:1",
          type: "sequence",
          fromNodeId: "plan:low-risk:step:1",
          toNodeId: "plan:low-risk:step:2"
        }
      ]
    });
    expect(run.execution?.status).toBe("completed");
    expect(executed).toEqual(["plan:low-risk:step:1", "plan:low-risk:step:2"]);
  });

  it("simulates risky provider work and waits for approval without executing", async () => {
    let executionAttempted = false;
    let approvalGovernanceContextId = "";
    let simulatedEffects: unknown[] = [];
    const run = await startPlanRun(
      {
        id: "plan-run:simulation",
        plan: {
          id: "plan:simulation",
          goalId: "goal:simulation",
          rationale: "Use the learned provider after validation.",
          risks: ["The generated mapping may be incomplete."],
          steps: [
            {
              id: "plan:simulation:step:1",
              capabilityId: "capability:create-resource",
              purpose: "Create the resource through the learned provider.",
              requiresApproval: true
            }
          ]
        },
        requesterIdentityId: "identity:user:moksh",
        authorityMode: "broad",
        governanceContextId: "governance:unknown-system",
        budgetId: "budget:project:atlas",
        costUnit: "atlas_credit",
        startedAt: "2026-07-20T09:10:00.000Z",
        steps: {
          "plan:simulation:step:1": {
            inputs: { name: "Atlas test" },
            reversibility: "partially_reversible",
            externalImpacts: [],
            predictedWorldStateEffects: [
              {
                type: "add_active_execution",
                executionId: "execution:projected"
              }
            ]
          }
        }
      },
      {
        resolveCapability: async () => ({
          selectedProviderId: "provider:generated:create-resource",
          candidates: [
            {
              providerId: "provider:generated:create-resource",
              capabilityId: "capability:create-resource",
              confidence: 0.8,
              riskScore: 0.2,
              estimatedCost: 0.25,
              estimatedLatencyMs: 500
            }
          ],
          approvalRequired: true,
          approvalReason: "Generated provider requires approval.",
          simulationRequired: true,
          simulationRequirement: "Dry-run the generated request.",
          rationale: "Selected the best learned provider."
        }),
        simulateStep: async ({ stepId, predictedWorldStateEffects }) => {
          simulatedEffects = predictedWorldStateEffects;
          return {
            id: `simulation:${stepId}`,
            status: "simulated",
            evidenceRefs: [`simulation:${stepId}:request-preview`]
          };
        },
        requestApproval: ({ runId, step, governanceContextId }) => {
          approvalGovernanceContextId = governanceContextId;
          return `approval:${runId}:${step.stepId}`;
        },
        executeCapability: async () => {
          executionAttempted = true;
          return { outputs: {}, evidenceRefs: [] };
        },
        reserveExecutionCost: async () => {
          throw new Error("Waiting work must not reserve cost.");
        },
        settleExecutionCost: async () => {
          throw new Error("Waiting work must not settle cost.");
        },
        releaseExecutionCost: async () => {
          throw new Error("Waiting work must not release cost.");
        }
      }
    );

    expect(run.status).toBe("waiting_for_approval");
    expect(run.execution).toBeUndefined();
    expect(executionAttempted).toBe(false);
    expect(simulatedEffects).toEqual([
      {
        type: "add_active_execution",
        executionId: "execution:projected"
      }
    ]);
    expect(approvalGovernanceContextId).toBe("governance:unknown-system");
    expect(run.steps[0]).toMatchObject({
      decision: { type: "delegate_to_human" },
      gate: { requiredAction: "delegate" },
      simulation: {
        id: "simulation:plan:simulation:step:1",
        status: "simulated",
        evidenceRefs: ["simulation:plan:simulation:step:1:request-preview"]
      },
      approvalRequestId: "approval:plan-run:simulation:plan:simulation:step:1"
    });
  });

  it("reconsiders and executes the simulated AtlasFlow after approval", async () => {
    let simulationCount = 0;
    const executed: string[] = [];
    const accountingEvents: string[] = [];
    const dependencies = {
      resolveCapability: async () => ({
        selectedProviderId: "provider:generated:create-resource",
        candidates: [
          {
            providerId: "provider:generated:create-resource",
            capabilityId: "capability:create-resource",
            confidence: 0.8,
            riskScore: 0.2,
            estimatedCost: 0.25,
            estimatedLatencyMs: 500
          }
        ],
        approvalRequired: true,
        approvalReason: "Generated provider requires approval.",
        simulationRequired: true,
        simulationRequirement: "Dry-run the generated request.",
        rationale: "Selected the best learned provider."
      }),
      simulateStep: async ({ stepId }: { stepId: string }) => {
        simulationCount += 1;
        return {
          id: `simulation:${stepId}`,
          status: "simulated" as const,
          evidenceRefs: [`simulation:${stepId}:request-preview`]
        };
      },
      requestApproval: ({ runId, step }: { runId: string; step: { stepId: string } }) =>
        `approval:${runId}:${step.stepId}`,
      executeCapability: async ({ node }: { node: { id: string } }) => {
        accountingEvents.push("execute");
        executed.push(node.id);
        return {
          outputs: { completed: true },
          evidenceRefs: [`execution:${node.id}`],
          resourceUsage: {
            cost: 0.2,
            unit: "atlas_credit",
            evidenceRef: `meter:${node.id}`
          }
        };
      },
      reserveExecutionCost: async (reservation: {
        estimatedCost: number;
        budgetId: string;
        costUnit: string;
      }) => {
        accountingEvents.push(`reserve:${reservation.estimatedCost}`);
        expect(reservation).toMatchObject({
          budgetId: "budget:project:atlas",
          costUnit: "atlas_credit",
          estimatedCost: 0.25
        });
        return {
          reservationId: "reservation:plan-run:plan-run:resume",
          evidenceRefs: ["ledger:reservation:plan-run:resume"]
        };
      },
      settleExecutionCost: async (settlement: {
        reservationId: string;
        actualCost: number;
        costUnit: string;
      }) => {
        accountingEvents.push(`settle:${settlement.actualCost}`);
        expect(settlement).toMatchObject({
          reservationId: "reservation:plan-run:plan-run:resume",
          actualCost: 0.2,
          costUnit: "atlas_credit"
        });
        return { evidenceRefs: ["ledger:settlement:plan-run:resume"] };
      },
      releaseExecutionCost: async () => {
        accountingEvents.push("release");
        return { evidenceRefs: [] };
      }
    };
    const input = {
      id: "plan-run:resume",
      plan: {
        id: "plan:resume",
        goalId: "goal:resume",
        rationale: "Execute after simulation and approval.",
        risks: [],
        steps: [
          {
            id: "plan:resume:step:1",
            capabilityId: "capability:create-resource",
            purpose: "Create the approved resource.",
            requiresApproval: true
          }
        ]
      },
      requesterIdentityId: "identity:user:moksh",
      authorityMode: "broad" as const,
      governanceContextId: "governance:unknown-system",
      budgetId: "budget:project:atlas",
      costUnit: "atlas_credit",
      startedAt: "2026-07-20T09:20:00.000Z",
      steps: {
        "plan:resume:step:1": {
          inputs: { name: "Approved Atlas test" },
          reversibility: "partially_reversible" as const,
          externalImpacts: []
        }
      }
    };
    const waitingRun = await startPlanRun(input, dependencies);
    expect(waitingRun.accounting).toMatchObject({
      budgetId: "budget:project:atlas",
      costUnit: "atlas_credit",
      estimatedCost: 0.25,
      status: "not_reserved"
    });
    expect(accountingEvents).toEqual([]);

    const completedRun = await resumePlanRun(
      {
        run: waitingRun,
        plan: input.plan,
        approvedApprovalRequestIds: ["approval:plan-run:resume:plan:resume:step:1"],
        resumedAt: "2026-07-20T09:21:00.000Z"
      },
      dependencies
    );

    expect(completedRun.status).toBe("completed");
    expect(completedRun.steps[0]?.decision).toMatchObject({
      type: "approve_with_constraints",
      approvalRequired: false
    });
    expect(completedRun.steps[0]?.gate.status).toBe("allowed_with_constraints");
    expect(completedRun.execution?.status).toBe("completed");
    expect(completedRun.accounting).toEqual({
      budgetId: "budget:project:atlas",
      costUnit: "atlas_credit",
      estimatedCost: 0.25,
      reservationId: "reservation:plan-run:plan-run:resume",
      actualCost: 0.2,
      status: "settled",
      evidenceRefs: [
        "ledger:reservation:plan-run:resume",
        "meter:plan:resume:step:1",
        "ledger:settlement:plan-run:resume"
      ]
    });
    expect(simulationCount).toBe(1);
    expect(executed).toEqual(["plan:resume:step:1"]);
    expect(accountingEvents).toEqual(["reserve:0.25", "execute", "settle:0.2"]);
  });

  it("blocks a rejected step before simulation, approval, or execution", async () => {
    let sideEffects = 0;
    const run = await startPlanRun(
      {
        id: "plan-run:rejected",
        plan: {
          id: "plan:rejected",
          goalId: "goal:rejected",
          rationale: "Attempt the requested capability only if allowed.",
          risks: [],
          steps: [
            {
              id: "plan:rejected:step:1",
              capabilityId: "capability:bypass-access",
              purpose: "Bypass access controls.",
              requiresApproval: true
            }
          ]
        },
        requesterIdentityId: "identity:user:moksh",
        authorityMode: "broad",
        governanceContextId: "governance:security",
        budgetId: "budget:project:atlas",
        costUnit: "atlas_credit",
        startedAt: "2026-07-20T09:30:00.000Z",
        steps: {
          "plan:rejected:step:1": {
            inputs: {},
            reversibility: "irreversible",
            externalImpacts: ["privilege_escalation"],
            risks: [
              {
                kind: "policy_violation",
                severity: "critical",
                description: "The action bypasses access controls.",
                requiresRejection: true
              }
            ]
          }
        }
      },
      {
        resolveCapability: async () => ({
          selectedProviderId: "provider:unsafe",
          candidates: [
            {
              providerId: "provider:unsafe",
              capabilityId: "capability:bypass-access",
              confidence: 0.1,
              riskScore: 1,
              estimatedCost: 0.5,
              estimatedLatencyMs: 100
            }
          ],
          approvalRequired: true,
          simulationRequired: true,
          rationale: "Only candidate."
        }),
        simulateStep: async () => {
          sideEffects += 1;
          return {
            id: "simulation:must-not-run",
            status: "simulated",
            evidenceRefs: []
          };
        },
        requestApproval: () => {
          sideEffects += 1;
          return "approval:must-not-exist";
        },
        executeCapability: async () => {
          sideEffects += 1;
          return { outputs: {}, evidenceRefs: [] };
        },
        reserveExecutionCost: async () => {
          sideEffects += 1;
          return { reservationId: "reservation:must-not-exist", evidenceRefs: [] };
        },
        settleExecutionCost: async () => {
          sideEffects += 1;
          return { evidenceRefs: [] };
        },
        releaseExecutionCost: async () => {
          sideEffects += 1;
          return { evidenceRefs: [] };
        }
      }
    );

    expect(run.status).toBe("blocked");
    expect(run.steps[0]?.decision.type).toBe("reject");
    expect(run.steps[0]?.gate.requiredAction).toBe("stop");
    expect(sideEffects).toBe(0);
  });
});
