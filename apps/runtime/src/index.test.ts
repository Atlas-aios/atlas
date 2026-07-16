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
});
