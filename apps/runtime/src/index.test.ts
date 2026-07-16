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
