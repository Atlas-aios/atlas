import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createAtlasRuntime, createFileRuntimePersistence } from "./index.js";

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

  it("generates a validated Brain plan for a stored goal", async () => {
    const invocations: string[] = [];
    const runtime = createAtlasRuntime({
      brain: {
        allowRemoteModels: false,
        allowFreeHostedEndpoints: false,
        providers: {
          "qwen-local-default": {
            invoke: async (input) => {
              invocations.push(input.userPrompt);
              return {
                requestId: "local-request:1",
                content: JSON.stringify({
                  rationale: "Discover capabilities before selecting execution.",
                  risks: ["The interface evidence may be incomplete."],
                  steps: [
                    {
                      capabilityId: "capability:discover-interface",
                      purpose: "Inspect trusted interface evidence.",
                      requiresApproval: false
                    }
                  ]
                })
              };
            }
          }
        }
      }
    });

    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:brain-plan",
          title: "Learn an unknown interface",
          description: "Discover and validate capabilities without app-specific code.",
          ownerId: "identity:user:moksh",
          priority: 90,
          successCriteria: ["A validated capability-first plan exists."],
          createdAt: "2026-07-20T08:00:00.000Z"
        })
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/brain/plan", {
        method: "POST",
        body: JSON.stringify({
          goalId: "goal:brain-plan",
          taskClass: "planning",
          difficulty: "medium",
          privacyClass: "private"
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      plan: {
        id: "plan:goal:brain-plan:1",
        goalId: "goal:brain-plan",
        rationale: "Discover capabilities before selecting execution.",
        risks: ["The interface evidence may be incomplete."],
        steps: [
          {
            id: "plan:goal:brain-plan:1:step:1",
            capabilityId: "capability:discover-interface",
            purpose: "Inspect trusted interface evidence.",
            requiresApproval: false
          }
        ]
      },
      modelSelection: expect.objectContaining({
        selectedProfileId: "qwen-local-default",
        lane: "local-default"
      }),
      providerRequestId: "local-request:1"
    });
    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toContain(
      "Discover and validate capabilities without app-specific code."
    );

    const auditResponse = await runtime.handle(
      new Request("http://atlas.local/audit-logs", { method: "GET" })
    );
    await expect(auditResponse.json()).resolves.toEqual({
      auditLogs: [
        expect.objectContaining({
          id: "audit:brain-plan:plan:goal:brain-plan:1",
          type: "brain.plan.generated",
          actorId: "identity:runtime",
          subjectId: "goal:brain-plan",
          evidenceRefs: ["plan:goal:brain-plan:1", "local-request:1"],
          metadata: {
            modelProfileId: "qwen-local-default",
            modelLane: "local-default"
          }
        })
      ]
    });
  });

  it("does not let a Brain plan request enable remote models", async () => {
    const selectedProfiles: string[] = [];
    const provider = {
      invoke: async (input: { modelProfileId: string }) => {
        selectedProfiles.push(input.modelProfileId);
        return {
          content: JSON.stringify({
            rationale: "Use the server-approved model lane.",
            risks: [],
            steps: [
              {
                capabilityId: "capability:inspect",
                purpose: "Inspect evidence.",
                requiresApproval: false
              }
            ]
          })
        };
      }
    };
    const runtime = createAtlasRuntime({
      brain: {
        allowRemoteModels: false,
        allowFreeHostedEndpoints: false,
        providers: {
          "qwen-local-default": provider,
          "nvidia-nemotron-super-remote": provider
        }
      }
    });
    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:server-policy",
          title: "Review architecture",
          description: "Review the architecture under server policy.",
          ownerId: "identity:user:moksh",
          priority: 80,
          successCriteria: ["A review plan exists."],
          createdAt: "2026-07-20T08:00:00.000Z"
        })
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/brain/plan", {
        method: "POST",
        body: JSON.stringify({
          goalId: "goal:server-policy",
          taskClass: "architecture",
          difficulty: "high",
          privacyClass: "internal",
          allowRemoteModels: true,
          allowFreeHostedEndpoints: true
        })
      })
    );

    expect(response.status).toBe(200);
    expect(selectedProfiles).toEqual(["qwen-local-default"]);
  });

  it("returns 503 instead of fabricating a plan when the selected provider is absent", async () => {
    const runtime = createAtlasRuntime();
    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:no-model",
          title: "Plan without a configured model",
          description: "This request must fail honestly.",
          ownerId: "identity:user:moksh",
          priority: 70,
          successCriteria: ["No synthetic plan is returned."],
          createdAt: "2026-07-20T08:00:00.000Z"
        })
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/brain/plan", {
        method: "POST",
        body: JSON.stringify({
          goalId: "goal:no-model",
          taskClass: "planning",
          difficulty: "medium",
          privacyClass: "private"
        })
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "model_provider_unavailable",
      modelProfileId: "qwen-local-default"
    });
  });

  it("rejects malformed model plans at the runtime boundary", async () => {
    const runtime = createAtlasRuntime({
      brain: {
        allowRemoteModels: false,
        allowFreeHostedEndpoints: false,
        providers: {
          "qwen-local-default": {
            invoke: async () => ({ content: "not-json" })
          }
        }
      }
    });
    await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "POST",
        body: JSON.stringify({
          id: "goal:invalid-model-output",
          title: "Validate model output",
          description: "Reject malformed output.",
          ownerId: "identity:user:moksh",
          priority: 70,
          successCriteria: ["Malformed output is rejected."],
          createdAt: "2026-07-20T08:00:00.000Z"
        })
      })
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/brain/plan", {
        method: "POST",
        body: JSON.stringify({
          goalId: "goal:invalid-model-output",
          taskClass: "planning",
          difficulty: "medium",
          privacyClass: "private"
        })
      })
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_model_output"
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

    const memoryResponse = await runtime.handle(
      new Request("http://atlas.local/memory/events?kind=approval", {
        method: "GET"
      })
    );

    expect(memoryResponse.status).toBe(200);
    await expect(memoryResponse.json()).resolves.toEqual({
      memoryEvents: [
        {
          id: "memory:event:learning-promotion:production:2026-07-16T13:00:00.000Z",
          kind: "approval",
          occurredAt: "2026-07-16T13:00:00.000Z",
          summary:
            "Approved production learning promotion gate: Approved production promotion gate, pending review cleanup.",
          subjectIds: ["learning:unknown-business-system"],
          sourceIds: ["approval:learning:unknown-business-system:production"],
          evidenceRefs: ["approval:learning:unknown-business-system:production"],
          metadata: {
            actorId: "identity:user:moksh",
            stage: "production"
          }
        }
      ]
    });
  });

  it("records and filters raw runtime Memory events", async () => {
    const runtime = createAtlasRuntime();

    const createResponse = await runtime.handle(
      new Request("http://atlas.local/memory/events", {
        method: "POST",
        body: JSON.stringify({
          id: "memory:event:conversation:1",
          kind: "conversation",
          occurredAt: "2026-07-16T11:00:00.000Z",
          summary: "User asked Atlas to prioritize MVP runtime usability.",
          subjectIds: ["goal:atlas-mvp"],
          sourceIds: ["conversation:codex:runtime-bout-1"],
          evidenceRefs: ["message:user:runtime-bout-1"],
          metadata: {
            channel: "codex"
          }
        })
      })
    );

    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual({
      memoryEvent: {
        id: "memory:event:conversation:1",
        kind: "conversation",
        occurredAt: "2026-07-16T11:00:00.000Z",
        summary: "User asked Atlas to prioritize MVP runtime usability.",
        subjectIds: ["goal:atlas-mvp"],
        sourceIds: ["conversation:codex:runtime-bout-1"],
        evidenceRefs: ["message:user:runtime-bout-1"],
        metadata: {
          channel: "codex"
        }
      }
    });

    const listResponse = await runtime.handle(
      new Request(
        "http://atlas.local/memory/events?kind=conversation&subjectId=goal%3Aatlas-mvp",
        { method: "GET" }
      )
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      memoryEvents: [
        {
          id: "memory:event:conversation:1",
          kind: "conversation",
          occurredAt: "2026-07-16T11:00:00.000Z",
          summary: "User asked Atlas to prioritize MVP runtime usability.",
          subjectIds: ["goal:atlas-mvp"],
          sourceIds: ["conversation:codex:runtime-bout-1"],
          evidenceRefs: ["message:user:runtime-bout-1"],
          metadata: {
            channel: "codex"
          }
        }
      ]
    });
  });

  it("records MVP learning completion as a Memory event", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request(
        "http://atlas.local/memory/events?kind=execution&subjectId=learning%3Aunknown-business-system",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      memoryEvents: [
        {
          id: "memory:event:mvp:unknown-business:learn-and-execute",
          kind: "execution",
          occurredAt: "2026-07-16T00:00:00.000Z",
          summary:
            "Learned 3 capabilities, generated 3 provider candidates, and passed benchmark benchmark:unknown-business:create-resource.",
          subjectIds: [
            "learning:unknown-business-system",
            "capability-graph:unknown-business-system",
            "benchmark:unknown-business:create-resource"
          ],
          sourceIds: [
            "openapi:POST /folios",
            "openapi:POST /settlements/allocate",
            "openapi:POST /work-packets/dispatch",
            "fixture:rest:POST /folios",
            "fixture:rest:POST /settlements/allocate",
            "fixture:rest:POST /work-packets/dispatch"
          ],
          evidenceRefs: [
            "fixture:rest:POST /folios",
            "fixture:rest:POST /settlements/allocate",
            "fixture:rest:POST /work-packets/dispatch"
          ],
          metadata: {
            benchmarkPassed: "true",
            learnedCapabilities: "3",
            providerCandidates: "3"
          }
        }
      ]
    });
  });

  it("records and filters runtime Experience artifacts", async () => {
    const runtime = createAtlasRuntime();

    const createResponse = await runtime.handle(
      new Request("http://atlas.local/experience/artifacts", {
        method: "POST",
        body: JSON.stringify({
          id: "experience:heuristic:create-resource:idempotency",
          type: "heuristic",
          summary: "Prefer idempotency keys when creating resources.",
          evidenceMemoryEventIds: ["memory:event:execution:create-resource"],
          applicability: ["capability:create-resource"],
          confidence: 0.8
        })
      })
    );

    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toEqual({
      experienceArtifact: {
        id: "experience:heuristic:create-resource:idempotency",
        type: "heuristic",
        summary: "Prefer idempotency keys when creating resources.",
        evidenceMemoryEventIds: ["memory:event:execution:create-resource"],
        applicability: ["capability:create-resource"],
        confidence: 0.8
      }
    });

    const listResponse = await runtime.handle(
      new Request(
        "http://atlas.local/experience/artifacts?type=heuristic&applicability=capability%3Acreate-resource&minimumConfidence=0.75",
        { method: "GET" }
      )
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      experienceArtifacts: [
        {
          id: "experience:heuristic:create-resource:idempotency",
          type: "heuristic",
          summary: "Prefer idempotency keys when creating resources.",
          evidenceMemoryEventIds: ["memory:event:execution:create-resource"],
          applicability: ["capability:create-resource"],
          confidence: 0.8
        }
      ]
    });
  });

  it("distills the MVP learning flow into a reusable Experience playbook", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request(
        "http://atlas.local/experience/artifacts?type=playbook&applicability=learning%3Aunknown-business-system",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      experienceArtifacts: [
        {
          id: "experience:playbook:unknown-business:openapi-browser-benchmark",
          type: "playbook",
          summary:
            "For unknown software with OpenAPI and browser evidence, generate a draft Capability Graph, create provider candidates, and require benchmark evidence before promotion.",
          evidenceMemoryEventIds: [
            "memory:event:mvp:unknown-business:learn-and-execute"
          ],
          applicability: [
            "learning:unknown-business-system",
            "interface:openapi",
            "interface:browser-ui",
            "capability:create-resource"
          ],
          confidence: 0.7
        }
      ]
    });
  });

  it("records and filters runtime SWM entities and relationships", async () => {
    const runtime = createAtlasRuntime();

    const entityResponse = await runtime.handle(
      new Request("http://atlas.local/swm/entities", {
        method: "POST",
        body: JSON.stringify({
          id: "swm:entity:capability:create-folio",
          type: "capability",
          label: "Create folio",
          attributes: {
            capabilityId: "capability:create-folio"
          },
          confidence: 0.8,
          evidenceRefs: ["openapi:POST /folios"],
          observedAt: "2026-07-16T00:00:00.000Z"
        })
      })
    );

    expect(entityResponse.status).toBe(201);
    await expect(entityResponse.json()).resolves.toEqual({
      entity: {
        id: "swm:entity:capability:create-folio",
        schemaVersion: "0.1",
        type: "capability",
        label: "Create folio",
        attributes: {
          capabilityId: "capability:create-folio"
        },
        confidence: 0.8,
        evidenceRefs: ["openapi:POST /folios"],
        observedAt: "2026-07-16T00:00:00.000Z"
      }
    });

    const relationshipResponse = await runtime.handle(
      new Request("http://atlas.local/swm/relationships", {
        method: "POST",
        body: JSON.stringify({
          id: "swm:relationship:system-has-create-folio",
          fromEntityId: "swm:entity:system:unknown-business",
          toEntityId: "swm:entity:capability:create-folio",
          type: "has_capability",
          confidence: 0.8,
          evidenceRefs: ["capability-graph:unknown-business-system"],
          observedAt: "2026-07-16T00:00:00.000Z"
        })
      })
    );

    expect(relationshipResponse.status).toBe(201);

    const entitiesResponse = await runtime.handle(
      new Request("http://atlas.local/swm/entities?type=capability", {
        method: "GET"
      })
    );
    const relationshipsResponse = await runtime.handle(
      new Request(
        "http://atlas.local/swm/relationships?entityId=swm%3Aentity%3Acapability%3Acreate-folio&type=has_capability",
        { method: "GET" }
      )
    );

    expect(entitiesResponse.status).toBe(200);
    await expect(entitiesResponse.json()).resolves.toMatchObject({
      entities: [
        {
          id: "swm:entity:capability:create-folio",
          type: "capability"
        }
      ]
    });
    expect(relationshipsResponse.status).toBe(200);
    await expect(relationshipsResponse.json()).resolves.toMatchObject({
      relationships: [
        {
          id: "swm:relationship:system-has-create-folio",
          type: "has_capability"
        }
      ]
    });
  });

  it("projects MVP learning output into SWM entities and relationships", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const entitiesResponse = await runtime.handle(
      new Request("http://atlas.local/swm/entities?type=capability", {
        method: "GET"
      })
    );
    const relationshipsResponse = await runtime.handle(
      new Request(
        "http://atlas.local/swm/relationships?entityId=swm%3Aentity%3Asystem%3Aunknown-business&type=has_capability",
        { method: "GET" }
      )
    );

    expect(entitiesResponse.status).toBe(200);
    await expect(entitiesResponse.json()).resolves.toMatchObject({
      entities: [
        {
          id: "swm:entity:capability:create-folio",
          type: "capability",
          label: "Create folio"
        },
        {
          id: "swm:entity:capability:allocate-settlement",
          type: "capability",
          label: "Allocate settlement"
        },
        {
          id: "swm:entity:capability:dispatch-work-packet",
          type: "capability",
          label: "Dispatch work packet"
        }
      ]
    });
    expect(relationshipsResponse.status).toBe(200);
    await expect(relationshipsResponse.json()).resolves.toMatchObject({
      relationships: [
        {
          id: "swm:relationship:system-has-capability:create-folio",
          fromEntityId: "swm:entity:system:unknown-business",
          toEntityId: "swm:entity:capability:create-folio",
          type: "has_capability"
        },
        {
          id: "swm:relationship:system-has-capability:allocate-settlement",
          fromEntityId: "swm:entity:system:unknown-business",
          toEntityId: "swm:entity:capability:allocate-settlement",
          type: "has_capability"
        },
        {
          id: "swm:relationship:system-has-capability:dispatch-work-packet",
          fromEntityId: "swm:entity:system:unknown-business",
          toEntityId: "swm:entity:capability:dispatch-work-packet",
          type: "has_capability"
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

  it("records and resolves runtime identity subjects and external accounts", async () => {
    const runtime = createAtlasRuntime();

    const subjectResponse = await runtime.handle(
      new Request("http://atlas.local/identity/entities", {
        method: "POST",
        body: JSON.stringify({
          id: "identity:user:moksh",
          kind: "human",
          displayName: "Moksh",
          confidence: 0.99,
          aliases: ["Apophis WillTakeOver", "moksh"],
          evidenceRefs: ["workspace:notion:user"]
        })
      })
    );

    expect(subjectResponse.status).toBe(201);
    await expect(subjectResponse.json()).resolves.toEqual({
      identity: {
        id: "identity:user:moksh",
        schemaVersion: "0.1",
        kind: "human",
        displayName: "Moksh",
        confidence: 0.99,
        aliases: ["Apophis WillTakeOver", "moksh"],
        evidenceRefs: ["workspace:notion:user"]
      }
    });

    const resolutionResponse = await runtime.handle(
      new Request("http://atlas.local/identity/resolutions", {
        method: "POST",
        body: JSON.stringify({
          id: "identity-resolution:github:moksh",
          subjectId: "identity:user:moksh",
          externalSystem: "github",
          externalId: "Atlas-aios",
          confidence: 0.91,
          resolvedAt: "2026-06-28T00:00:00.000Z",
          evidenceRefs: ["github:org:Atlas-aios"]
        })
      })
    );

    expect(resolutionResponse.status).toBe(201);

    const listResponse = await runtime.handle(
      new Request("http://atlas.local/identity/entities?kind=human", {
        method: "GET"
      })
    );
    const lookupResponse = await runtime.handle(
      new Request(
        "http://atlas.local/identity/entities/resolve?externalSystem=github&externalId=Atlas-aios",
        { method: "GET" }
      )
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      identities: [
        {
          id: "identity:user:moksh",
          kind: "human"
        }
      ]
    });
    expect(lookupResponse.status).toBe(200);
    await expect(lookupResponse.json()).resolves.toMatchObject({
      identity: {
        id: "identity:user:moksh",
        displayName: "Moksh"
      }
    });
  });

  it("records approval decision actors into Identity", async () => {
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
              name: "Identity folio"
            },
            governanceContextId: "governance:runtime:mvp",
            startedAt: "2026-07-16T12:30:00.000Z"
          })
        }
      )
    );
    await runtime.handle(
      new Request(
        "http://atlas.local/approval-requests/approval:runtime:execution:runtime:create-folio/approve",
        {
          method: "POST",
          body: JSON.stringify({
            decidedBy: "identity:user:moksh",
            decidedAt: "2026-07-16T12:35:00.000Z",
            reason: "Approved for identity capture."
          })
        }
      )
    );

    const response = await runtime.handle(
      new Request(
        "http://atlas.local/identity/entities/resolve?alias=identity%3Auser%3Amoksh",
        {
          method: "GET"
        }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      identity: {
        id: "identity:user:moksh",
        schemaVersion: "0.1",
        kind: "human",
        displayName: "identity:user:moksh",
        confidence: 0.6,
        aliases: ["identity:user:moksh"],
        evidenceRefs: ["approval:runtime:execution:runtime:create-folio"]
      }
    });
  });

  it("returns the runtime Self Model after learning an unknown system", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const response = await runtime.handle(
      new Request(
        "http://atlas.local/self-model?generatedAt=2026-07-16T12%3A30%3A00.000Z",
        {
          method: "GET"
        }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      selfModel: {
        id: "self-model:runtime:2026-07-16T12:30:00.000Z",
        schemaVersion: "0.1",
        generatedAt: "2026-07-16T12:30:00.000Z",
        availableCapabilityIds: [
          "capability:create-folio",
          "capability:allocate-settlement",
          "capability:dispatch-work-packet"
        ],
        grantedAuthority: ["authority:execute:simulation"],
        resourceLimits: {
          maxEstimatedCostPerExecution: 0.01,
          maxEstimatedLatencyMs: 500
        },
        interfaceMaturity: [
          {
            interfaceId: "interface:openapi:unknown-business-system",
            maturity: "validated",
            confidence: 0.8,
            evidenceRefs: ["benchmark:unknown-business:create-resource"],
            updatedAt: "2026-07-16T12:30:00.000Z"
          }
        ],
        knownLimitations: [
          "Browser UI driver is available as fixture evidence but is not yet the runtime execution path."
        ]
      }
    });
  });

  it("runs a bounded Cognitive Loop cycle from runtime state", async () => {
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
              name: "Loop folio"
            },
            governanceContextId: "governance:runtime:mvp",
            startedAt: "2026-07-16T12:30:00.000Z"
          })
        }
      )
    );

    const response = await runtime.handle(
      new Request("http://atlas.local/cognitive-loop/cycles", {
        method: "POST",
        body: JSON.stringify({
          id: "cognitive-loop:cycle:runtime:1",
          goalId: "goal:runtime-create-resource",
          startedAt: "2026-07-16T12:45:00.000Z",
          completedAt: "2026-07-16T12:45:01.000Z"
        })
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      cycle: {
        id: "cognitive-loop:cycle:runtime:1",
        schemaVersion: "0.1",
        goalId: "goal:runtime-create-resource",
        bounded: true,
        executedAction: false,
        observations: {
          activeGoalIds: ["goal:runtime-create-resource"],
          blockerIds: [
            "blocker:approval:approval:runtime:execution:runtime:create-folio"
          ],
          capabilityIds: [
            "capability:create-folio",
            "capability:allocate-settlement",
            "capability:dispatch-work-packet"
          ],
          selfModelSnapshotId: "self-model:runtime:2026-07-16T12:45:00.000Z",
          worldStateSnapshotId: "world-state:runtime:2026-07-16T12:45:00.000Z"
        },
        nextAction: {
          type: "request_approval",
          status: "waiting_for_approval"
        }
      },
      memoryEvent: {
        id: "memory:event:cognitive-loop:cognitive-loop:cycle:runtime:1",
        kind: "conversation",
        occurredAt: "2026-07-16T12:45:01.000Z",
        summary:
          "Cognitive Loop cycle cognitive-loop:cycle:runtime:1 recommended request_approval."
      }
    });

    const listResponse = await runtime.handle(
      new Request("http://atlas.local/cognitive-loop/cycles", { method: "GET" })
    );
    await expect(listResponse.json()).resolves.toMatchObject({
      cycles: [
        {
          id: "cognitive-loop:cycle:runtime:1",
          nextAction: {
            type: "request_approval"
          }
        }
      ]
    });
  });

  it("lists and evaluates governance policies with audit evidence", async () => {
    const runtime = createAtlasRuntime();

    const listResponse = await runtime.handle(
      new Request("http://atlas.local/governance/policies", { method: "GET" })
    );

    expect(listResponse.status).toBe(200);
    const listBody = (await listResponse.json()) as {
      policies: Array<{
        id: string;
        decision: string;
        impactKinds: string[];
      }>;
    };
    expect(listBody.policies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "policy:approval:money",
          decision: "requires_approval",
          impactKinds: ["money"]
        }),
        expect.objectContaining({
          id: "policy:approval:production-system",
          decision: "requires_approval",
          impactKinds: ["production_system"]
        })
      ])
    );

    const createResponse = await runtime.handle(
      new Request("http://atlas.local/governance/policies", {
        method: "POST",
        body: JSON.stringify({
          id: "policy:deny:legal-without-human",
          name: "Deny legal commitments without human signature",
          description: "Legal commitments cannot be executed autonomously.",
          impactKinds: ["legal_commitment"],
          decision: "deny",
          requiredApproverRole: "owner",
          reason: "Legal commitments must be handled by a human.",
          enabled: true
        })
      })
    );

    expect(createResponse.status).toBe(201);

    const evaluateResponse = await runtime.handle(
      new Request("http://atlas.local/governance/evaluate", {
        method: "POST",
        body: JSON.stringify({
          id: "governance-action:sign-contract",
          action: "Sign a vendor contract",
          requesterIdentityId: "identity:user:moksh",
          externalImpacts: ["legal_commitment"],
          evidenceRefs: ["contract:draft"],
          evaluatedAt: "2026-07-16T12:50:00.000Z"
        })
      })
    );

    expect(evaluateResponse.status).toBe(200);
    await expect(evaluateResponse.json()).resolves.toEqual({
      policyDecision: {
        decision: "deny",
        policyIds: ["policy:deny:legal-without-human"],
        action: "Sign a vendor contract",
        reason: "Legal commitments must be handled by a human.",
        detectedImpacts: ["legal_commitment"],
        approvalRequirements: []
      }
    });

    const auditResponse = await runtime.handle(
      new Request("http://atlas.local/audit-logs", { method: "GET" })
    );

    await expect(auditResponse.json()).resolves.toMatchObject({
      auditLogs: [
        {
          id: "audit:governance:governance-action:sign-contract",
          type: "governance.policy.evaluated",
          actorId: "identity:user:moksh",
          subjectId: "governance-action:sign-contract",
          occurredAt: "2026-07-16T12:50:00.000Z",
          summary:
            "Governance decision deny for Sign a vendor contract: Legal commitments must be handled by a human.",
          evidenceRefs: ["contract:draft"],
          metadata: {
            decision: "deny",
            policyIds: "policy:deny:legal-without-human",
            detectedImpacts: "legal_commitment"
          }
        }
      ]
    });
  });

  it("requires API auth and a runtime identity when auth is enabled", async () => {
    const runtime = createAtlasRuntime({
      auth: {
        apiKey: "atlas-dev-key",
        requireIdentity: true
      }
    });

    await expect(
      runtime
        .handle(new Request("http://atlas.local/health", { method: "GET" }))
        .then((response) => response.json())
    ).resolves.toEqual({
      service: "atlas-runtime",
      status: "ok"
    });

    const unauthorized = await runtime.handle(
      new Request("http://atlas.local/goals", { method: "GET" })
    );

    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toEqual({
      error: "unauthorized",
      reason: "Missing or invalid Atlas runtime API key."
    });

    const missingIdentity = await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "GET",
        headers: {
          authorization: "Bearer atlas-dev-key"
        }
      })
    );

    expect(missingIdentity.status).toBe(401);
    await expect(missingIdentity.json()).resolves.toEqual({
      error: "unauthorized",
      reason: "Missing Atlas runtime identity."
    });

    const authorized = await runtime.handle(
      new Request("http://atlas.local/goals", {
        method: "GET",
        headers: {
          authorization: "Bearer atlas-dev-key",
          "x-atlas-identity-id": "identity:user:moksh"
        }
      })
    );

    expect(authorized.status).toBe(200);
  });

  it("persists runtime state across local durable state restarts", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "atlas-runtime-"));
    const persistencePath = join(workspace, "runtime-state.json");

    try {
      const firstRuntime = createAtlasRuntime({
        persistence: createFileRuntimePersistence(persistencePath)
      });

      const createResponse = await firstRuntime.handle(
        new Request("http://atlas.local/goals", {
          method: "POST",
          body: JSON.stringify({
            id: "goal:persisted",
            title: "Persist an Atlas goal",
            description: "Verify runtime state survives process restart.",
            ownerId: "identity:user:moksh",
            priority: 88,
            successCriteria: ["The goal is visible after restart."],
            createdAt: "2026-07-17T08:00:00.000Z"
          })
        })
      );

      expect(createResponse.status).toBe(201);

      const secondRuntime = createAtlasRuntime({
        persistence: createFileRuntimePersistence(persistencePath)
      });
      const listResponse = await secondRuntime.handle(
        new Request("http://atlas.local/goals", { method: "GET" })
      );

      await expect(listResponse.json()).resolves.toEqual({
        goals: [
          {
            id: "goal:persisted",
            title: "Persist an Atlas goal",
            status: "proposed",
            priority: 88,
            ownerId: "identity:user:moksh"
          }
        ]
      });
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("creates workflows, thoughts, simulations, approvals aliases, and browser UI driver reads", async () => {
    const runtime = createAtlasRuntime();

    await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    const workflowResponse = await runtime.handle(
      new Request("http://atlas.local/workflows", {
        method: "POST",
        body: JSON.stringify({
          id: "workflow:create-resource",
          version: "0.1",
          nodes: [
            {
              id: "node:create-folio",
              type: "capability",
              inputs: {
                capabilityId: "capability:create-folio"
              }
            }
          ],
          edges: []
        })
      })
    );

    expect(workflowResponse.status).toBe(201);
    await expect(workflowResponse.json()).resolves.toMatchObject({
      workflow: {
        id: "workflow:create-resource",
        version: "0.1"
      }
    });

    const thoughtResponse = await runtime.handle(
      new Request("http://atlas.local/thoughts", {
        method: "POST",
        body: JSON.stringify({
          id: "thought:provider-selection:1",
          kind: "decision_rationale",
          goalId: "goal:runtime-create-resource",
          summary:
            "Prefer the learned REST provider for deterministic execution, but keep browser UI as fallback evidence.",
          evidenceRefs: ["capability:runtime:capability:create-folio:resolve"],
          createdAt: "2026-07-17T08:05:00.000Z"
        })
      })
    );

    expect(thoughtResponse.status).toBe(201);
    await expect(thoughtResponse.json()).resolves.toMatchObject({
      thought: {
        id: "thought:provider-selection:1",
        kind: "decision_rationale",
        goalId: "goal:runtime-create-resource"
      }
    });

    const simulationResponse = await runtime.handle(
      new Request("http://atlas.local/simulations", {
        method: "POST",
        body: JSON.stringify({
          id: "simulation:create-folio:1",
          goalId: "goal:runtime-create-resource",
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          inputs: {
            name: "Simulation folio"
          },
          createdAt: "2026-07-17T08:10:00.000Z"
        })
      })
    );

    expect(simulationResponse.status).toBe(201);
    await expect(simulationResponse.json()).resolves.toMatchObject({
      simulation: {
        id: "simulation:create-folio:1",
        status: "simulated",
        providerId: "provider:openapi:create-folio",
        requestPreview: {
          method: "POST",
          url: "atlas-fixture://unknown-business/folios",
          body: {
            name: "Simulation folio"
          }
        }
      }
    });

    const browserResponse = await runtime.handle(
      new Request("http://atlas.local/interface-drivers/browser-ui/execute", {
        method: "POST",
        body: JSON.stringify({
          operationId: "read-create-folio-form",
          action: "read",
          selector: '[data-atlas-capability="capability:create-folio"]',
          requiredPermissions: ["browser_ui:read"],
          grantedPermissions: ["browser_ui:read"]
        })
      })
    );

    expect(browserResponse.status).toBe(200);
    await expect(browserResponse.json()).resolves.toMatchObject({
      result: {
        status: "completed",
        output: {
          matched: true,
          capabilityId: "capability:create-folio"
        }
      }
    });

    const approvalsResponse = await runtime.handle(
      new Request("http://atlas.local/approvals", { method: "GET" })
    );

    expect(approvalsResponse.status).toBe(200);
    await expect(approvalsResponse.json()).resolves.toEqual({
      approvals: []
    });
  });

  it("updates the runtime Self Model from completed execution outcomes", async () => {
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
            name: "Self Model folio"
          },
          startedAt: "2026-07-16T12:30:00.000Z"
        })
      })
    );

    const response = await runtime.handle(
      new Request(
        "http://atlas.local/self-model?generatedAt=2026-07-16T12%3A35%3A00.000Z",
        {
          method: "GET"
        }
      )
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      selfModel: {
        capabilityConfidence: Array<{
          capabilityId: string;
          providerId: string;
          confidence: number;
          evidenceRefs: string[];
          updatedAt: string;
        }>;
      };
    };

    expect(body.selfModel.capabilityConfidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          confidence: 0.72,
          evidenceRefs: expect.arrayContaining([
            "openapi:POST /folios",
            "execution:runtime:create-folio"
          ]),
          updatedAt: "2026-07-16T12:30:00.000Z"
        }),
        expect.objectContaining({
          capabilityId: "capability:allocate-settlement",
          providerId: "provider:openapi:allocate-settlement",
          confidence: 0.62
        }),
        expect.objectContaining({
          capabilityId: "capability:dispatch-work-packet",
          providerId: "provider:openapi:dispatch-work-packet",
          confidence: 0.62
        })
      ])
    );
  });

  it("returns current World State with active goals and approval blockers", async () => {
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
              name: "World State folio"
            },
            governanceContextId: "governance:runtime:mvp",
            startedAt: "2026-07-16T12:30:00.000Z"
          })
        }
      )
    );

    const response = await runtime.handle(
      new Request(
        "http://atlas.local/world-state?capturedAt=2026-07-16T12%3A45%3A00.000Z",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      worldState: {
        id: "world-state:runtime:2026-07-16T12:45:00.000Z",
        capturedAt: "2026-07-16T12:45:00.000Z",
        activeGoalIds: ["goal:runtime-create-resource"],
        activeExecutionIds: [],
        blockers: [
          {
            id: "blocker:approval:approval:runtime:execution:runtime:create-folio",
            summary:
              "Approval requested for provider:openapi:create-folio on capability:create-folio: Selected provider requires approval because permission fit or policy risk is not fully safe.",
            severity: "high"
          }
        ]
      }
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
