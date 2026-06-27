import { describe, expect, it } from "vitest";

import type { ACRObject, AtlasCognitiveTransaction } from "./acr.js";
import {
  createACREventLog,
  replayACREventLog,
  replayACREventLogUntil
} from "./acr-event-log.js";

describe("ACR append-only event log", () => {
  it("assigns monotonic sequence numbers and rejects duplicate ACT ids", () => {
    const log = createACREventLog();
    const firstTransaction = createGoalACT({
      actId: "act:goal:create",
      eventId: "acr:event:goal:create",
      objectVersion: 1,
      lifecycle: "draft",
      occurredAt: "2026-06-28T00:01:00.000Z"
    });
    const secondTransaction = createGoalACT({
      actId: "act:goal:validate",
      eventId: "acr:event:goal:validate",
      objectVersion: 2,
      lifecycle: "validated",
      occurredAt: "2026-06-28T00:05:00.000Z",
      eventType: "object.validated"
    });

    log.append(firstTransaction, { appendedAt: "2026-06-28T00:01:01.000Z" });
    log.append(secondTransaction, { appendedAt: "2026-06-28T00:05:01.000Z" });

    expect(
      log.entries().map((entry) => ({
        sequence: entry.sequence,
        actId: entry.actId,
        appendedAt: entry.appendedAt
      }))
    ).toEqual([
      {
        sequence: 1,
        actId: "act:goal:create",
        appendedAt: "2026-06-28T00:01:01.000Z"
      },
      {
        sequence: 2,
        actId: "act:goal:validate",
        appendedAt: "2026-06-28T00:05:01.000Z"
      }
    ]);
    expect(() =>
      log.append(firstTransaction, { appendedAt: "2026-06-28T00:06:00.000Z" })
    ).toThrow(/already exists/);
  });

  it("replays deterministically and supports temporal projection queries", () => {
    const log = createACREventLog();
    log.append(
      createGoalACT({
        actId: "act:goal:create",
        eventId: "acr:event:goal:create",
        objectVersion: 1,
        lifecycle: "draft",
        occurredAt: "2026-06-28T00:01:00.000Z"
      }),
      { appendedAt: "2026-06-28T00:01:01.000Z" }
    );
    log.append(
      createGoalACT({
        actId: "act:goal:validate",
        eventId: "acr:event:goal:validate",
        objectVersion: 2,
        lifecycle: "validated",
        occurredAt: "2026-06-28T00:05:00.000Z",
        eventType: "object.validated"
      }),
      { appendedAt: "2026-06-28T00:05:01.000Z" }
    );

    expect(replayACREventLog(log)).toEqual(replayACREventLog(log));
    expect(replayACREventLog(log).objects.get("acr:goal:release")?.lifecycle).toBe(
      "validated"
    );
    expect(
      replayACREventLogUntil(log, "2026-06-28T00:03:00.000Z").objects.get(
        "acr:goal:release"
      )?.lifecycle
    ).toBe("draft");
  });
});

function createGoalACT(input: {
  actId: string;
  eventId: string;
  objectVersion: number;
  lifecycle: ACRObject["lifecycle"];
  occurredAt: string;
  eventType?: "object.created" | "object.validated";
}): AtlasCognitiveTransaction {
  return {
    id: input.actId,
    schemaVersion: "0.1",
    status: "committed",
    goalId: "acr:goal:release",
    traceId: "trace:release",
    createdAt: input.occurredAt,
    createdBy: "actor:brain",
    intent: "Maintain release goal state",
    reason: "The event log needs replayable ACTs.",
    preconditions: [],
    policyRefs: [],
    evidenceRefs: [{ sourceId: "input:release-request", sourceType: "user" }],
    events: [
      {
        id: input.eventId,
        actId: input.actId,
        type: input.eventType ?? "object.created",
        occurredAt: input.occurredAt,
        actorId: "actor:brain",
        objectId: "acr:goal:release",
        objectVersion: input.objectVersion,
        traceId: "trace:release",
        payload:
          input.eventType === "object.validated"
            ? {}
            : {
                object: {
                  id: "acr:goal:release",
                  type: "goal",
                  schemaVersion: "0.1",
                  version: input.objectVersion,
                  lifecycle: input.lifecycle,
                  createdAt: input.occurredAt,
                  createdBy: "actor:brain",
                  traceId: "trace:release",
                  confidence: 0.9,
                  relationships: [],
                  evidence: [{ sourceId: "input:release-request", sourceType: "user" }],
                  policies: [],
                  payload: { intent: "Prepare release" }
                }
              }
      }
    ],
    validation: {
      passed: true,
      errors: [],
      warnings: []
    },
    committedAt: input.occurredAt
  };
}
