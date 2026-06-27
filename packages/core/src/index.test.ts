import { describe, expect, it } from "vitest";
import {
  PILLAR_BOUNDARIES,
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
