import { describe, expect, it } from "vitest";

import { createAtlasRuntime } from "./index.js";

describe("Atlas runtime API", () => {
  it("reports local runtime health", async () => {
    const runtime = createAtlasRuntime();

    const response = await runtime.handle(
      new Request("http://atlas.local/health", { method: "GET" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "atlas-runtime",
      status: "ok"
    });
  });

  it("runs the unknown business system learn-and-execute MVP flow", async () => {
    const runtime = createAtlasRuntime();

    const response = await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scenario: "Create Resource",
      learnedCapabilities: [
        "capability:create-folio",
        "capability:allocate-settlement",
        "capability:dispatch-work-packet"
      ],
      providerCandidates: [
        "provider:openapi:create-folio",
        "provider:openapi:allocate-settlement",
        "provider:openapi:dispatch-work-packet"
      ],
      browserCapabilities: [
        "capability:create-folio",
        "capability:allocate-settlement",
        "capability:dispatch-work-packet"
      ],
      benchmark: {
        id: "benchmark:unknown-business:create-resource",
        passed: true,
        evidence: [
          "fixture:rest:POST /folios",
          "fixture:rest:POST /settlements/allocate",
          "fixture:rest:POST /work-packets/dispatch"
        ]
      }
    });
  });

  it("creates and lists goals through the runtime API", async () => {
    const runtime = createAtlasRuntime();

    const createResponse = await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          description: "Learn the interface and execute the resource workflow.",
          ownerId: "identity:user:moksh",
          priority: 95,
          successCriteria: ["Create Resource is completed or safely blocked."],
          createdAt: "2026-07-16T12:00:00.000Z"
        })
      })
    );

    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual({
      goal: {
        id: "goal:runtime-create-resource",
        title: "Create Resource in unknown business system",
        description: "Learn the interface and execute the resource workflow.",
        status: "proposed",
        ownerId: "identity:user:moksh",
        priority: 95,
        successCriteria: ["Create Resource is completed or safely blocked."],
        completionCriteria: [
          {
            id: "goal:runtime-create-resource:criterion:1",
            description: "Create Resource is completed or safely blocked.",
            satisfied: false,
            evidenceRefs: []
          }
        ],
        dependencyIds: [],
        childGoalIds: [],
        recoveryAttempts: [],
        waitingStates: [],
        createdAt: "2026-07-16T12:00:00.000Z",
        updatedAt: "2026-07-16T12:00:00.000Z"
      },
      event: {
        id: "goal:runtime-create-resource:event:created",
        type: "goal.created",
        goalId: "goal:runtime-create-resource",
        occurredAt: "2026-07-16T12:00:00.000Z",
        toStatus: "proposed",
        sourceRefs: [],
        summary:
          "Goal goal:runtime-create-resource was created with 1 completion criteria."
      }
    });

    const listResponse = await runtime.handle(
      new Request("http://atlas.local/goals", { method: "GET" })
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      goals: [
        {
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          status: "proposed",
          priority: 95,
          ownerId: "identity:user:moksh"
        }
      ]
    });
  });

  it("transitions a goal status and records the lifecycle event", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          description: "Learn the interface and execute the resource workflow.",
          ownerId: "identity:user:moksh",
          priority: 95,
          successCriteria: ["Create Resource is completed or safely blocked."],
          createdAt: "2026-07-16T12:00:00.000Z"
        })
      })
    );

    const transitionResponse = await runtime.handle(
      new Request("http://atlas.local/goals/goal:runtime-create-resource/status", {
        method: "POST",
        body: JSON.stringify({
          eventId: "goal:runtime-create-resource:event:activated",
          toStatus: "active",
          occurredAt: "2026-07-16T12:05:00.000Z",
          reason: "Begin learning and execution."
        })
      })
    );

    expect(transitionResponse.status).toBe(200);
    await expect(transitionResponse.json()).resolves.toMatchObject({
      goal: {
        id: "goal:runtime-create-resource",
        status: "active",
        updatedAt: "2026-07-16T12:05:00.000Z"
      },
      event: {
        id: "goal:runtime-create-resource:event:activated",
        type: "goal.status_changed",
        goalId: "goal:runtime-create-resource",
        occurredAt: "2026-07-16T12:05:00.000Z",
        fromStatus: "proposed",
        toStatus: "active",
        sourceRefs: [],
        summary: "Begin learning and execution."
      }
    });

    const listResponse = await runtime.handle(
      new Request("http://atlas.local/goals", { method: "GET" })
    );

    await expect(listResponse.json()).resolves.toEqual({
      goals: [
        {
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          status: "active",
          priority: 95,
          ownerId: "identity:user:moksh"
        }
      ]
    });

    const timelineResponse = await runtime.handle(
      new Request("http://atlas.local/goals/goal:runtime-create-resource/timeline", {
        method: "GET"
      })
    );

    await expect(timelineResponse.json()).resolves.toMatchObject({
      events: [
        {
          type: "goal.created",
          goalId: "goal:runtime-create-resource"
        },
        {
          type: "goal.status_changed",
          goalId: "goal:runtime-create-resource",
          fromStatus: "proposed",
          toStatus: "active"
        }
      ]
    });
  });

  it("satisfies a goal completion criterion with evidence", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          description: "Learn the interface and execute the resource workflow.",
          ownerId: "identity:user:moksh",
          priority: 95,
          successCriteria: ["Create Resource is completed or safely blocked."],
          createdAt: "2026-07-16T12:00:00.000Z"
        })
      })
    );

    const response = await runtime.handle(
      new Request(
        "http://atlas.local/goals/goal:runtime-create-resource/completion-criteria/goal:runtime-create-resource:criterion:1/satisfy",
        {
          method: "POST",
          body: JSON.stringify({
            eventId: "goal:runtime-create-resource:event:criterion-1-satisfied",
            evidenceRef: "execution:runtime:create-folio",
            occurredAt: "2026-07-16T12:40:00.000Z"
          })
        }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      goal: {
        id: "goal:runtime-create-resource",
        completionCriteria: [
          {
            id: "goal:runtime-create-resource:criterion:1",
            description: "Create Resource is completed or safely blocked.",
            satisfied: true,
            evidenceRefs: ["execution:runtime:create-folio"]
          }
        ],
        updatedAt: "2026-07-16T12:40:00.000Z"
      },
      event: {
        id: "goal:runtime-create-resource:event:criterion-1-satisfied",
        type: "goal.completion_criterion_satisfied",
        goalId: "goal:runtime-create-resource",
        occurredAt: "2026-07-16T12:40:00.000Z",
        sourceRefs: [
          "goal:runtime-create-resource:criterion:1",
          "execution:runtime:create-folio"
        ],
        summary:
          "Completion criterion goal:runtime-create-resource:criterion:1 was satisfied."
      }
    });

    const timelineResponse = await runtime.handle(
      new Request("http://atlas.local/goals/goal:runtime-create-resource/timeline", {
        method: "GET"
      })
    );

    await expect(timelineResponse.json()).resolves.toMatchObject({
      events: [
        {
          type: "goal.created",
          goalId: "goal:runtime-create-resource"
        },
        {
          type: "goal.completion_criterion_satisfied",
          goalId: "goal:runtime-create-resource",
          sourceRefs: [
            "goal:runtime-create-resource:criterion:1",
            "execution:runtime:create-folio"
          ]
        }
      ]
    });
  });

  it("auto-completes an active goal when all completion criteria are satisfied", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          description: "Learn the interface and execute the resource workflow.",
          ownerId: "identity:user:moksh",
          priority: 95,
          successCriteria: ["Create Resource is completed or safely blocked."],
          createdAt: "2026-07-16T12:00:00.000Z"
        })
      })
    );
    await runtime.handle(
      new Request("http://atlas.local/goals/goal:runtime-create-resource/status", {
        method: "POST",
        body: JSON.stringify({
          eventId: "goal:runtime-create-resource:event:activated",
          toStatus: "active",
          occurredAt: "2026-07-16T12:05:00.000Z",
          reason: "Begin learning and execution."
        })
      })
    );

    const response = await runtime.handle(
      new Request(
        "http://atlas.local/goals/goal:runtime-create-resource/completion-criteria/goal:runtime-create-resource:criterion:1/satisfy",
        {
          method: "POST",
          body: JSON.stringify({
            eventId: "goal:runtime-create-resource:event:criterion-1-satisfied",
            evidenceRef: "execution:runtime:create-folio",
            occurredAt: "2026-07-16T12:40:00.000Z"
          })
        }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      goal: {
        id: "goal:runtime-create-resource",
        status: "completed",
        updatedAt: "2026-07-16T12:40:00.000Z"
      },
      event: {
        type: "goal.completion_criterion_satisfied"
      },
      autoCompletionEvent: {
        type: "goal.status_changed",
        goalId: "goal:runtime-create-resource",
        occurredAt: "2026-07-16T12:40:00.000Z",
        fromStatus: "active",
        toStatus: "completed",
        sourceRefs: ["goal:runtime-create-resource:criterion:1"],
        summary: "All completion criteria are satisfied."
      }
    });

    const timelineResponse = await runtime.handle(
      new Request("http://atlas.local/goals/goal:runtime-create-resource/timeline", {
        method: "GET"
      })
    );

    await expect(timelineResponse.json()).resolves.toMatchObject({
      events: [
        {
          type: "goal.created"
        },
        {
          type: "goal.status_changed",
          toStatus: "active"
        },
        {
          type: "goal.completion_criterion_satisfied"
        },
        {
          type: "goal.status_changed",
          toStatus: "completed"
        }
      ]
    });
  });

  it("gets goal details with linked runtime executions", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          description: "Learn the interface and execute the resource workflow.",
          ownerId: "identity:user:moksh",
          priority: 95,
          successCriteria: ["Create Resource is completed or safely blocked."],
          createdAt: "2026-07-16T12:00:00.000Z"
        })
      })
    );
    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );
    await runtime.handle(
      new Request("http://atlas.local/executions", {
        method: "POST",
        body: JSON.stringify({
          id: "execution:runtime:create-folio",
          goalId: "goal:runtime-create-resource",
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          inputs: {
            name: "Runtime execution folio"
          },
          startedAt: "2026-07-16T12:30:00.000Z"
        })
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/goals/goal:runtime-create-resource", {
        method: "GET"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      goal: {
        id: "goal:runtime-create-resource",
        title: "Create Resource in unknown business system",
        status: "proposed",
        priority: 95,
        ownerId: "identity:user:moksh"
      },
      executions: [
        {
          id: "execution:runtime:create-folio",
          workflowId: "workflow:runtime:execution:runtime:create-folio",
          status: "completed",
          goalId: "goal:runtime-create-resource",
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          startedAt: "2026-07-16T12:30:00.000Z",
          stepCount: 1,
          eventCount: 4
        }
      ]
    });
  });

  it("creates a goal-scoped runtime execution", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          description: "Learn the interface and execute the resource workflow.",
          ownerId: "identity:user:moksh",
          priority: 95,
          successCriteria: ["Create Resource is completed or safely blocked."],
          createdAt: "2026-07-16T12:00:00.000Z"
        })
      })
    );
    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const createResponse = await runtime.handle(
      new Request("http://atlas.local/goals/goal:runtime-create-resource/executions", {
        method: "POST",
        body: JSON.stringify({
          id: "execution:runtime:create-folio",
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          inputs: {
            name: "Runtime execution folio"
          },
          startedAt: "2026-07-16T12:30:00.000Z"
        })
      })
    );

    expect(createResponse.status).toBe(201);

    const goalResponse = await runtime.handle(
      new Request("http://atlas.local/goals/goal:runtime-create-resource", {
        method: "GET"
      })
    );

    await expect(goalResponse.json()).resolves.toMatchObject({
      executions: [
        {
          id: "execution:runtime:create-folio",
          goalId: "goal:runtime-create-resource",
          status: "completed"
        }
      ]
    });
  });

  it("lists capabilities learned during the MVP flow", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/capabilities", { method: "GET" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      capabilities: [
        {
          id: "capability:create-folio",
          name: "Create folio",
          level: "L2",
          confidence: 0.8,
          graphId: "capability-graph:unknown-business-system",
          graphStatus: "draft",
          sourceRefs: ["openapi:POST /folios"]
        },
        {
          id: "capability:allocate-settlement",
          name: "Allocate settlement",
          level: "L2",
          confidence: 0.8,
          graphId: "capability-graph:unknown-business-system",
          graphStatus: "draft",
          sourceRefs: ["openapi:POST /settlements/allocate"]
        },
        {
          id: "capability:dispatch-work-packet",
          name: "Dispatch work packet",
          level: "L2",
          confidence: 0.8,
          graphId: "capability-graph:unknown-business-system",
          graphStatus: "draft",
          sourceRefs: ["openapi:POST /work-packets/dispatch"]
        }
      ]
    });
  });

  it("lists capability graphs learned during the MVP flow", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/capability-graphs", { method: "GET" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      capabilityGraphs: [
        {
          id: "capability-graph:unknown-business-system",
          schemaVersion: "0.1",
          status: "draft",
          generatedAt: "2026-07-16T00:00:00.000Z",
          nodes: [
            {
              id: "capability:create-folio",
              schemaVersion: "0.1",
              name: "Create folio",
              level: "L2",
              confidence: 0.8,
              sourceRefs: ["openapi:POST /folios"]
            },
            {
              id: "capability:allocate-settlement",
              schemaVersion: "0.1",
              name: "Allocate settlement",
              level: "L2",
              confidence: 0.8,
              sourceRefs: ["openapi:POST /settlements/allocate"]
            },
            {
              id: "capability:dispatch-work-packet",
              schemaVersion: "0.1",
              name: "Dispatch work packet",
              level: "L2",
              confidence: 0.8,
              sourceRefs: ["openapi:POST /work-packets/dispatch"]
            }
          ],
          edges: []
        }
      ]
    });
  });

  it("lists provider candidates learned during the MVP flow", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/providers", { method: "GET" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      providers: [
        {
          providerId: "provider:openapi:create-folio",
          capabilityId: "capability:create-folio",
          confidence: 0.62,
          riskScore: 0.6,
          estimatedCost: 0.05,
          estimatedLatencyMs: 900,
          permissionFit: 0.7,
          policyRiskScore: 0.2,
          reputationScore: 0.5
        },
        {
          providerId: "provider:openapi:allocate-settlement",
          capabilityId: "capability:allocate-settlement",
          confidence: 0.62,
          riskScore: 0.6,
          estimatedCost: 0.05,
          estimatedLatencyMs: 900,
          permissionFit: 0.7,
          policyRiskScore: 0.2,
          reputationScore: 0.5
        },
        {
          providerId: "provider:openapi:dispatch-work-packet",
          capabilityId: "capability:dispatch-work-packet",
          confidence: 0.62,
          riskScore: 0.6,
          estimatedCost: 0.05,
          estimatedLatencyMs: 900,
          permissionFit: 0.7,
          policyRiskScore: 0.2,
          reputationScore: 0.5
        }
      ]
    });
  });

  it("lists interface driver mappings learned during the MVP flow", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/interface-drivers", { method: "GET" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      interfaceDrivers: [
        {
          capabilityId: "capability:create-folio",
          driverId: "driver:rest",
          operationId: "createFolio",
          method: "POST",
          path: "/folios",
          requiredPermissions: ["network"]
        },
        {
          capabilityId: "capability:allocate-settlement",
          driverId: "driver:rest",
          operationId: "allocateSettlement",
          method: "POST",
          path: "/settlements/allocate",
          requiredPermissions: ["network"]
        },
        {
          capabilityId: "capability:dispatch-work-packet",
          driverId: "driver:rest",
          operationId: "dispatchWorkPacket",
          method: "POST",
          path: "/work-packets/dispatch",
          requiredPermissions: ["network"]
        }
      ]
    });
  });

  it("lists learning governance reports from the MVP flow", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/learning/reports", { method: "GET" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      learningReview: {
        promotionReady: false,
        blockedReasons: ["high_severity_review_items"]
      },
      promotionDecisions: [
        {
          subjectId: "learning:unknown-business-system",
          stage: "development",
          outcome: "blocked",
          blockedReasons: ["high_severity_review_items"],
          requiredActions: [
            "Resolve high-severity review items before development promotion."
          ]
        },
        {
          subjectId: "learning:unknown-business-system",
          stage: "production",
          outcome: "blocked",
          blockedReasons: [
            "high_severity_review_items",
            "governance_approval_required"
          ],
          requiredActions: [
            "Resolve high-severity review items before production promotion.",
            "Attach governance approval before production promotion."
          ]
        }
      ],
      reports: [
        {
          id: "learning-report:critic:learning:unknown-business-system",
          kind: "critic",
          subjectId: "learning:unknown-business-system",
          requiresGovernanceReview: true
        },
        {
          id: "learning-report:defender:learning:unknown-business-system",
          kind: "defender",
          subjectId: "learning:unknown-business-system",
          requiresGovernanceReview: true
        },
        {
          id: "learning-report:judge:learning:unknown-business-system",
          kind: "judge",
          subjectId: "learning:unknown-business-system",
          requiresGovernanceReview: true
        }
      ]
    });
  });

  it("records human governance approval for learning production promotion", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const approvalResponse = await runtime.handle(
      new Request(
        "http://atlas.local/learning/promotion-decisions/production/approve",
        {
          method: "POST",
          body: JSON.stringify({
            governanceApprovalRef:
              "approval:learning:unknown-business-system:production",
            decidedBy: "identity:user:moksh",
            decidedAt: "2026-07-16T13:00:00.000Z",
            reason: "Approved production promotion gate, pending review cleanup."
          })
        }
      )
    );

    expect(approvalResponse.status).toBe(200);
    await expect(approvalResponse.json()).resolves.toEqual({
      promotionDecision: {
        subjectId: "learning:unknown-business-system",
        stage: "production",
        outcome: "blocked",
        blockedReasons: ["high_severity_review_items"],
        requiredActions: [
          "Resolve high-severity review items before production promotion."
        ],
        governanceApprovalRef: "approval:learning:unknown-business-system:production"
      }
    });

    const reportsResponse = await runtime.handle(
      new Request("http://atlas.local/learning/reports", { method: "GET" })
    );

    await expect(reportsResponse.json()).resolves.toMatchObject({
      promotionDecisions: [
        {
          stage: "development",
          outcome: "blocked"
        },
        {
          stage: "production",
          outcome: "blocked",
          blockedReasons: ["high_severity_review_items"],
          governanceApprovalRef: "approval:learning:unknown-business-system:production"
        }
      ]
    });

    const auditResponse = await runtime.handle(
      new Request("http://atlas.local/audit-logs", { method: "GET" })
    );

    expect(auditResponse.status).toBe(200);
    await expect(auditResponse.json()).resolves.toEqual({
      auditLogs: [
        {
          id: "audit:learning-promotion:production:2026-07-16T13:00:00.000Z",
          type: "learning.promotion.approved",
          actorId: "identity:user:moksh",
          subjectId: "learning:unknown-business-system",
          occurredAt: "2026-07-16T13:00:00.000Z",
          summary:
            "Approved production learning promotion gate: Approved production promotion gate, pending review cleanup.",
          evidenceRefs: ["approval:learning:unknown-business-system:production"],
          metadata: {
            stage: "production",
            governanceApprovalRef:
              "approval:learning:unknown-business-system:production"
          }
        }
      ]
    });
  });

  it("resolves a learned capability through the Capability Kernel", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/capabilities/capability:create-folio/resolve", {
        method: "POST",
        body: JSON.stringify({
          goalId: "goal:runtime-create-resource",
          inputs: {
            name: "Kernel selected folio"
          },
          governanceContextId: "governance:runtime:mvp"
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      selectedProviderId: "provider:openapi:create-folio",
      candidates: [
        {
          providerId: "provider:openapi:create-folio",
          capabilityId: "capability:create-folio",
          confidence: 0.62,
          riskScore: 0.6,
          estimatedCost: 0.05,
          estimatedLatencyMs: 900,
          permissionFit: 0.7,
          policyRiskScore: 0.2,
          reputationScore: 0.5
        }
      ],
      approvalRequired: true,
      approvalReason:
        "Selected provider requires approval because permission fit or policy risk is not fully safe.",
      simulationRequired: true,
      simulationRequirement:
        "Simulate selected provider execution before dispatch because adjusted risk is high.",
      rationale: "Selected provider:openapi:create-folio with 0 fallback providers."
    });
  });

  it("resolves a learned capability in goal scope", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          description: "Learn the interface and execute the resource workflow.",
          ownerId: "identity:user:moksh",
          priority: 95,
          successCriteria: ["Create Resource is completed or safely blocked."],
          createdAt: "2026-07-16T12:00:00.000Z"
        })
      })
    );
    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request(
        "http://atlas.local/goals/goal:runtime-create-resource/capabilities/capability:create-folio/resolve",
        {
          method: "POST",
          body: JSON.stringify({
            inputs: {
              name: "Goal scoped folio"
            },
            governanceContextId: "governance:runtime:mvp"
          })
        }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      selectedProviderId: "provider:openapi:create-folio",
      candidates: [
        {
          providerId: "provider:openapi:create-folio",
          capabilityId: "capability:create-folio"
        }
      ],
      approvalRequired: true,
      simulationRequired: true
    });
  });

  it("dispatches a learned capability in goal scope", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          description: "Learn the interface and execute the resource workflow.",
          ownerId: "identity:user:moksh",
          priority: 95,
          successCriteria: ["Create Resource is completed or safely blocked."],
          createdAt: "2026-07-16T12:00:00.000Z"
        })
      })
    );
    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request(
        "http://atlas.local/goals/goal:runtime-create-resource/capabilities/capability:create-folio/dispatch",
        {
          method: "POST",
          body: JSON.stringify({
            executionId: "execution:runtime:create-folio",
            inputs: {
              name: "Goal dispatched folio"
            },
            governanceContextId: "governance:runtime:mvp",
            startedAt: "2026-07-16T12:30:00.000Z"
          })
        }
      )
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      resolution: {
        selectedProviderId: "provider:openapi:create-folio",
        approvalRequired: true,
        simulationRequired: true
      },
      execution: {
        session: {
          id: "execution:runtime:create-folio",
          status: "completed"
        },
        status: "completed",
        steps: [
          {
            outputs: {
              status: 201,
              body: {
                name: "Goal dispatched folio",
                state: "open"
              }
            }
          }
        ]
      }
    });
  });

  it("records approval requests for approval-gated dispatches", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          description: "Learn the interface and execute the resource workflow.",
          ownerId: "identity:user:moksh",
          priority: 95,
          successCriteria: ["Create Resource is completed or safely blocked."],
          createdAt: "2026-07-16T12:00:00.000Z"
        })
      })
    );
    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const dispatchResponse = await runtime.handle(
      new Request(
        "http://atlas.local/goals/goal:runtime-create-resource/capabilities/capability:create-folio/dispatch",
        {
          method: "POST",
          body: JSON.stringify({
            executionId: "execution:runtime:create-folio",
            inputs: {
              name: "Approval gated folio"
            },
            governanceContextId: "governance:runtime:mvp",
            startedAt: "2026-07-16T12:30:00.000Z"
          })
        }
      )
    );

    expect(dispatchResponse.status).toBe(201);
    await expect(dispatchResponse.json()).resolves.toMatchObject({
      approvalRequest: {
        id: "approval:runtime:execution:runtime:create-folio",
        status: "requested",
        goalId: "goal:runtime-create-resource",
        capabilityId: "capability:create-folio",
        providerId: "provider:openapi:create-folio",
        executionId: "execution:runtime:create-folio",
        governanceContextId: "governance:runtime:mvp",
        requestedAt: "2026-07-16T12:30:00.000Z",
        reason:
          "Selected provider requires approval because permission fit or policy risk is not fully safe."
      }
    });

    const approvalListResponse = await runtime.handle(
      new Request("http://atlas.local/approval-requests", { method: "GET" })
    );

    expect(approvalListResponse.status).toBe(200);
    await expect(approvalListResponse.json()).resolves.toEqual({
      approvalRequests: [
        {
          id: "approval:runtime:execution:runtime:create-folio",
          status: "requested",
          goalId: "goal:runtime-create-resource",
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          executionId: "execution:runtime:create-folio",
          governanceContextId: "governance:runtime:mvp",
          requestedAt: "2026-07-16T12:30:00.000Z",
          reason:
            "Selected provider requires approval because permission fit or policy risk is not fully safe."
        }
      ]
    });
  });

  it("approves runtime approval requests", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          description: "Learn the interface and execute the resource workflow.",
          ownerId: "identity:user:moksh",
          priority: 95,
          successCriteria: ["Create Resource is completed or safely blocked."],
          createdAt: "2026-07-16T12:00:00.000Z"
        })
      })
    );
    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );
    await runtime.handle(
      new Request(
        "http://atlas.local/goals/goal:runtime-create-resource/capabilities/capability:create-folio/dispatch",
        {
          method: "POST",
          body: JSON.stringify({
            executionId: "execution:runtime:create-folio",
            inputs: {
              name: "Approved folio"
            },
            governanceContextId: "governance:runtime:mvp",
            startedAt: "2026-07-16T12:30:00.000Z"
          })
        }
      )
    );

    const approvalResponse = await runtime.handle(
      new Request(
        "http://atlas.local/approval-requests/approval:runtime:execution:runtime:create-folio/approve",
        {
          method: "POST",
          body: JSON.stringify({
            decidedBy: "identity:user:moksh",
            decidedAt: "2026-07-16T12:35:00.000Z",
            reason: "Approved for MVP fixture execution."
          })
        }
      )
    );

    expect(approvalResponse.status).toBe(200);
    await expect(approvalResponse.json()).resolves.toEqual({
      approvalRequest: {
        id: "approval:runtime:execution:runtime:create-folio",
        status: "approved",
        goalId: "goal:runtime-create-resource",
        capabilityId: "capability:create-folio",
        providerId: "provider:openapi:create-folio",
        executionId: "execution:runtime:create-folio",
        governanceContextId: "governance:runtime:mvp",
        requestedAt: "2026-07-16T12:30:00.000Z",
        reason:
          "Selected provider requires approval because permission fit or policy risk is not fully safe.",
        decidedBy: "identity:user:moksh",
        decidedAt: "2026-07-16T12:35:00.000Z",
        decisionReason: "Approved for MVP fixture execution."
      }
    });

    const listResponse = await runtime.handle(
      new Request("http://atlas.local/approval-requests", { method: "GET" })
    );

    await expect(listResponse.json()).resolves.toMatchObject({
      approvalRequests: [
        {
          id: "approval:runtime:execution:runtime:create-folio",
          status: "approved",
          decidedBy: "identity:user:moksh"
        }
      ]
    });
  });

  it("returns a goal timeline with goal and execution events", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:runtime-create-resource",
          title: "Create Resource in unknown business system",
          description: "Learn the interface and execute the resource workflow.",
          ownerId: "identity:user:moksh",
          priority: 95,
          successCriteria: ["Create Resource is completed or safely blocked."],
          createdAt: "2026-07-16T12:00:00.000Z"
        })
      })
    );
    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );
    await runtime.handle(
      new Request(
        "http://atlas.local/goals/goal:runtime-create-resource/capabilities/capability:create-folio/dispatch",
        {
          method: "POST",
          body: JSON.stringify({
            executionId: "execution:runtime:create-folio",
            inputs: {
              name: "Goal timeline folio"
            },
            governanceContextId: "governance:runtime:mvp",
            startedAt: "2026-07-16T12:30:00.000Z"
          })
        }
      )
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/goals/goal:runtime-create-resource/timeline", {
        method: "GET"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      goalId: "goal:runtime-create-resource",
      events: [
        {
          id: "goal:runtime-create-resource:event:created",
          type: "goal.created",
          goalId: "goal:runtime-create-resource",
          occurredAt: "2026-07-16T12:00:00.000Z",
          toStatus: "proposed",
          sourceRefs: [],
          summary:
            "Goal goal:runtime-create-resource was created with 1 completion criteria."
        },
        {
          type: "execution.session.started",
          goalId: "goal:runtime-create-resource",
          executionId: "execution:runtime:create-folio",
          occurredAt: "2026-07-16T12:30:00.000Z"
        },
        {
          type: "execution.step.started",
          goalId: "goal:runtime-create-resource",
          executionId: "execution:runtime:create-folio",
          nodeId: "node:runtime-provider",
          occurredAt: "2026-07-16T12:30:00.000Z"
        },
        {
          type: "execution.step.completed",
          goalId: "goal:runtime-create-resource",
          executionId: "execution:runtime:create-folio",
          nodeId: "node:runtime-provider",
          occurredAt: "2026-07-16T12:30:00.000Z"
        },
        {
          type: "execution.session.completed",
          goalId: "goal:runtime-create-resource",
          executionId: "execution:runtime:create-folio",
          occurredAt: "2026-07-16T12:30:00.000Z"
        }
      ]
    });
  });

  it("creates an execution session for a learned provider", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/executions", {
        method: "POST",
        body: JSON.stringify({
          id: "execution:runtime:create-folio",
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          inputs: {
            name: "Runtime execution folio"
          },
          startedAt: "2026-07-16T12:30:00.000Z"
        })
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      session: {
        id: "execution:runtime:create-folio",
        workflowId: "workflow:runtime:execution:runtime:create-folio",
        startedAt: "2026-07-16T12:30:00.000Z",
        status: "completed"
      },
      status: "completed",
      steps: [
        {
          nodeId: "node:runtime-provider",
          status: "completed",
          outputs: {
            status: 201,
            body: {
              id: "folio:1",
              name: "Runtime execution folio",
              state: "open"
            }
          },
          evidenceRefs: [
            "fixture:rest:POST /folios",
            "runtime:provider:provider:openapi:create-folio"
          ]
        }
      ],
      events: [
        {
          type: "execution.session.started",
          executionId: "execution:runtime:create-folio"
        },
        {
          type: "execution.step.started",
          executionId: "execution:runtime:create-folio",
          nodeId: "node:runtime-provider"
        },
        {
          type: "execution.step.completed",
          executionId: "execution:runtime:create-folio",
          nodeId: "node:runtime-provider"
        },
        {
          type: "execution.session.completed",
          executionId: "execution:runtime:create-folio"
        }
      ]
    });
  });

  it("lists runtime execution history", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );
    await runtime.handle(
      new Request("http://atlas.local/executions", {
        method: "POST",
        body: JSON.stringify({
          id: "execution:runtime:create-folio",
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          inputs: {
            name: "Runtime execution folio"
          },
          startedAt: "2026-07-16T12:30:00.000Z"
        })
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/executions", { method: "GET" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      executions: [
        {
          id: "execution:runtime:create-folio",
          workflowId: "workflow:runtime:execution:runtime:create-folio",
          status: "completed",
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          startedAt: "2026-07-16T12:30:00.000Z",
          stepCount: 1,
          eventCount: 4
        }
      ]
    });
  });

  it("gets runtime execution details by id", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );
    await runtime.handle(
      new Request("http://atlas.local/executions", {
        method: "POST",
        body: JSON.stringify({
          id: "execution:runtime:create-folio",
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          inputs: {
            name: "Runtime execution folio"
          },
          startedAt: "2026-07-16T12:30:00.000Z"
        })
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/executions/execution:runtime:create-folio", {
        method: "GET"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      request: {
        id: "execution:runtime:create-folio",
        capabilityId: "capability:create-folio",
        providerId: "provider:openapi:create-folio",
        inputs: {
          name: "Runtime execution folio"
        },
        startedAt: "2026-07-16T12:30:00.000Z"
      },
      result: {
        session: {
          id: "execution:runtime:create-folio",
          workflowId: "workflow:runtime:execution:runtime:create-folio",
          startedAt: "2026-07-16T12:30:00.000Z",
          status: "completed"
        },
        status: "completed",
        steps: [
          {
            nodeId: "node:runtime-provider",
            status: "completed",
            outputs: {
              status: 201,
              body: {
                id: "folio:1",
                name: "Runtime execution folio",
                state: "open"
              }
            },
            evidenceRefs: [
              "fixture:rest:POST /folios",
              "runtime:provider:provider:openapi:create-folio"
            ]
          }
        ],
        events: [
          {
            type: "execution.session.started",
            executionId: "execution:runtime:create-folio"
          },
          {
            type: "execution.step.started",
            executionId: "execution:runtime:create-folio",
            nodeId: "node:runtime-provider"
          },
          {
            type: "execution.step.completed",
            executionId: "execution:runtime:create-folio",
            nodeId: "node:runtime-provider"
          },
          {
            type: "execution.session.completed",
            executionId: "execution:runtime:create-folio"
          }
        ]
      }
    });
  });
});
