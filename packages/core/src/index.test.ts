import { describe, expect, it } from "vitest";
import {
  PILLAR_BOUNDARIES,
  buildContextPacket,
  buildContextPacketFromRetrievers,
  createAtlasEventEnvelope,
  fail,
  getPillarBoundary,
  ok
} from "./index.js";

describe("result helpers", () => {
  it("wraps successful values", () => {
    expect(ok({ id: "goal_1" })).toEqual({
      ok: true,
      value: { id: "goal_1" }
    });
  });

  it("wraps failures with stable code and message fields", () => {
    expect(fail("governance.blocked", "Approval is required")).toEqual({
      ok: false,
      error: {
        code: "governance.blocked",
        message: "Approval is required"
      }
    });
  });
});

describe("pillar boundaries", () => {
  it("defines exactly the twelve foundational Atlas pillars", () => {
    expect(PILLAR_BOUNDARIES).toHaveLength(12);
    expect(new Set(PILLAR_BOUNDARIES.map((pillar) => pillar.id)).size).toBe(12);
  });

  it("resolves the Capability Kernel boundary", () => {
    expect(getPillarBoundary("capability-kernel")).toMatchObject({
      id: "capability-kernel",
      primaryPackage: "@atlas-aios/capability-kernel",
      owns: expect.arrayContaining(["capability resolution", "provider ranking"]),
      consumes: expect.arrayContaining([
        "Capability Graph",
        "Experience Engine",
        "Learning & Governance System"
      ])
    });
  });
});

describe("event envelopes", () => {
  it("creates a stable cross-pillar event envelope", () => {
    expect(
      createAtlasEventEnvelope({
        id: "evt_001",
        type: "capability.resolved",
        sourcePillar: "capability-kernel",
        occurredAt: "2026-06-27T00:00:00.000Z",
        correlationId: "goal_001",
        payload: {
          capabilityId: "cap_create_resource",
          providerId: "provider_rest"
        }
      })
    ).toEqual({
      id: "evt_001",
      type: "capability.resolved",
      schemaVersion: "1.0",
      sourcePillar: "capability-kernel",
      occurredAt: "2026-06-27T00:00:00.000Z",
      correlationId: "goal_001",
      payload: {
        capabilityId: "cap_create_resource",
        providerId: "provider_rest"
      }
    });
  });
});

describe("context builder", () => {
  it("builds a bounded context packet from scoped retrieval results", () => {
    const packet = buildContextPacket({
      informationNeed: {
        id: "need_001",
        goalId: "goal_create_resource",
        purpose: "plan",
        question: "What do I need to create a resource in this unknown system?",
        entities: ["project_atlas", "cap_create_resource"],
        requiredSources: ["capability-graph", "experience", "memory"],
        permissionScope: ["project:atlas"],
        maxContextTokens: 80,
        minConfidence: 0.6
      },
      results: [
        {
          id: "result_low_confidence",
          source: "memory",
          summary: "A weak memory that should not be trusted.",
          content: "Low-confidence memories do not enter the planning packet.",
          confidence: 0.3,
          relevance: 0.99,
          estimatedTokens: 10,
          permissionScope: ["project:atlas"],
          sourceRefs: ["memory:weak"]
        },
        {
          id: "result_forbidden",
          source: "experience",
          summary: "A relevant but forbidden artifact.",
          content: "Wrong permission scope.",
          confidence: 0.99,
          relevance: 0.99,
          estimatedTokens: 10,
          permissionScope: ["project:private"],
          sourceRefs: ["experience:private"]
        },
        {
          id: "result_capability",
          source: "capability-graph",
          summary: "Create Resource capability exists.",
          content: "Use capability cap_create_resource before selecting a provider.",
          confidence: 0.91,
          relevance: 0.95,
          estimatedTokens: 30,
          permissionScope: ["project:atlas"],
          sourceRefs: ["capability:cap_create_resource"]
        },
        {
          id: "result_memory",
          source: "memory",
          summary: "Past unknown-system attempts needed interface docs first.",
          content:
            "Documentation, OpenAPI, and UI evidence should be gathered before execution.",
          confidence: 0.82,
          relevance: 0.9,
          estimatedTokens: 40,
          permissionScope: ["project:atlas"],
          sourceRefs: ["memory:attempt_001"]
        },
        {
          id: "result_over_budget",
          source: "experience",
          summary: "Useful but over budget.",
          content: "This would exceed the context packet budget.",
          confidence: 0.95,
          relevance: 0.8,
          estimatedTokens: 40,
          permissionScope: ["project:atlas"],
          sourceRefs: ["experience:playbook_001"]
        }
      ]
    });

    expect(packet).toMatchObject({
      informationNeedId: "need_001",
      goalId: "goal_create_resource",
      purpose: "plan",
      tokenBudget: 80,
      estimatedTokens: 70,
      missingSources: ["experience"],
      items: [
        {
          id: "result_capability",
          source: "capability-graph"
        },
        {
          id: "result_memory",
          source: "memory"
        }
      ]
    });
  });

  it("queries required retrieval adapters and assembles the packet", async () => {
    const calls: string[] = [];
    const packet = await buildContextPacketFromRetrievers({
      informationNeed: {
        id: "need_permissioned",
        goalId: "goal_plan_invoice",
        purpose: "govern",
        question: "Can Atlas plan this action for the current user?",
        entities: ["identity:user_1", "goal_plan_invoice"],
        requiredSources: ["identity", "governance", "world-state"],
        permissionScope: ["project:atlas"],
        maxContextTokens: 100,
        minConfidence: 0.5
      },
      retrievers: [
        {
          source: "identity",
          retrieve: async (need) => {
            calls.push(`identity:${need.permissionScope.join(",")}`);
            return [
              {
                id: "identity_user",
                source: "identity",
                summary: "User identity resolved.",
                content: "user_1 is allowed to act in project:atlas.",
                confidence: 0.95,
                relevance: 0.9,
                estimatedTokens: 20,
                permissionScope: ["project:atlas"],
                sourceRefs: ["identity:user_1"]
              }
            ];
          }
        },
        {
          source: "governance",
          retrieve: async () => {
            calls.push("governance");
            return [
              {
                id: "policy_action",
                source: "governance",
                summary: "Planning is allowed; execution requires approval.",
                content:
                  "The user may plan this action, but execution is approval-gated.",
                confidence: 0.9,
                relevance: 0.95,
                estimatedTokens: 30,
                permissionScope: ["project:atlas"],
                sourceRefs: ["policy:sensitive_action"]
              }
            ];
          }
        },
        {
          source: "memory",
          retrieve: async () => {
            calls.push("memory");
            return [];
          }
        },
        {
          source: "world-state",
          retrieve: async () => {
            calls.push("world-state");
            return [
              {
                id: "world_state_current",
                source: "world-state",
                summary: "No active blocker for this project.",
                content: "Project Atlas has no current blocker for planning.",
                confidence: 0.8,
                relevance: 0.85,
                estimatedTokens: 25,
                permissionScope: ["project:atlas"],
                sourceRefs: ["world-state:snapshot_1"]
              }
            ];
          }
        }
      ]
    });

    expect(calls).toEqual(["identity:project:atlas", "governance", "world-state"]);
    expect(packet.items.map((item) => item.source)).toEqual([
      "governance",
      "identity",
      "world-state"
    ]);
    expect(packet.missingSources).toEqual([]);
  });
});
