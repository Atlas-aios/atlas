import { describe, expect, it } from "vitest";

import {
  createApprovalEvent,
  createAuditEvent,
  createExecutionEvent,
  createMemoryEvent
} from "./index.js";

describe("specific Atlas event schemas", () => {
  it("creates audit event envelopes", () => {
    expect(
      createAuditEvent({
        id: "evt:audit:1",
        occurredAt: "2026-06-28T00:00:00.000Z",
        correlationId: "goal:create-resource",
        actorId: "actor:brain",
        action: "decision.evaluate",
        result: "allowed",
        severity: "medium",
        evidenceRefs: ["decision:req:1"]
      })
    ).toEqual({
      id: "evt:audit:1",
      type: "audit.recorded",
      schemaVersion: "1.0",
      sourcePillar: "learning-governance",
      occurredAt: "2026-06-28T00:00:00.000Z",
      correlationId: "goal:create-resource",
      payload: {
        actorId: "actor:brain",
        action: "decision.evaluate",
        result: "allowed",
        severity: "medium",
        evidenceRefs: ["decision:req:1"]
      }
    });
  });

  it("creates approval event envelopes", () => {
    expect(
      createApprovalEvent({
        id: "evt:approval:1",
        occurredAt: "2026-06-28T00:01:00.000Z",
        correlationId: "goal:create-resource",
        approvalId: "approval:1",
        subjectId: "execution:create-resource",
        status: "requested",
        requestedBy: "actor:brain",
        reason: "External write needs review."
      })
    ).toMatchObject({
      type: "approval.requested",
      sourcePillar: "learning-governance",
      payload: {
        approvalId: "approval:1",
        subjectId: "execution:create-resource",
        status: "requested"
      }
    });
  });

  it("creates execution event envelopes", () => {
    expect(
      createExecutionEvent({
        id: "evt:execution:1",
        occurredAt: "2026-06-28T00:02:00.000Z",
        correlationId: "goal:create-resource",
        executionId: "execution:create-resource",
        status: "started",
        capabilityId: "capability:create-resource",
        providerId: "provider:rest"
      })
    ).toMatchObject({
      type: "execution.started",
      sourcePillar: "cognitive-loop",
      payload: {
        executionId: "execution:create-resource",
        status: "started",
        capabilityId: "capability:create-resource",
        providerId: "provider:rest"
      }
    });
  });

  it("creates memory event envelopes", () => {
    expect(
      createMemoryEvent({
        id: "evt:memory:1",
        occurredAt: "2026-06-28T00:03:00.000Z",
        correlationId: "goal:create-resource",
        memoryId: "memory:decision:1",
        memoryType: "decision",
        subjectId: "decision:req:1",
        summary: "Decision approved with constraints.",
        evidenceRefs: ["decision:outcome:1"]
      })
    ).toMatchObject({
      type: "memory.event.recorded",
      sourcePillar: "memory",
      payload: {
        memoryId: "memory:decision:1",
        memoryType: "decision",
        subjectId: "decision:req:1"
      }
    });
  });
});
