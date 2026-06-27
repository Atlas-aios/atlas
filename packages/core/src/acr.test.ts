import { describe, expect, it } from "vitest";

import type { ACREvent, ACRObject, AtlasCognitiveTransaction } from "./acr.js";
import { ACR_OBJECT_TYPES, ACT_STATUSES } from "./acr.js";
import { createACBMessagesForACT } from "./acr-bus.js";
import { projectCommittedACTs } from "./acr-projector.js";

describe("ACR and ACT contracts", () => {
  it("exposes the minimum ACR object and ACT status registries", () => {
    expect(ACR_OBJECT_TYPES).toEqual([
      "goal",
      "thought",
      "decision",
      "capability",
      "memory",
      "experience",
      "execution"
    ]);
    expect(ACT_STATUSES).toEqual([
      "proposed",
      "validated",
      "committed",
      "published",
      "failed",
      "aborted",
      "compensated"
    ]);
  });

  it("represents object creation inside an atomic cognitive transaction", () => {
    const object: ACRObject<{ intent: string }> = {
      id: "acr:goal:release",
      type: "goal",
      schemaVersion: "0.1",
      version: 1,
      lifecycle: "draft",
      createdAt: "2026-06-28T00:00:00.000Z",
      createdBy: "actor:user:moksh",
      traceId: "trace:release",
      confidence: 0.9,
      relationships: [],
      evidence: [{ sourceId: "input:release-request", sourceType: "user" }],
      policies: [],
      payload: { intent: "Prepare release" }
    };

    const event: ACREvent<{ object: typeof object }> = {
      id: "acr:event:1",
      actId: "act:release:1",
      type: "object.created",
      occurredAt: "2026-06-28T00:00:00.000Z",
      actorId: "actor:user:moksh",
      objectId: object.id,
      objectVersion: 1,
      traceId: "trace:release",
      payload: { object }
    };

    const transaction: AtlasCognitiveTransaction = {
      id: "act:release:1",
      schemaVersion: "0.1",
      status: "committed",
      goalId: object.id,
      traceId: "trace:release",
      createdAt: "2026-06-28T00:00:00.000Z",
      createdBy: "actor:user:moksh",
      intent: "Create release goal",
      reason: "User requested release preparation.",
      preconditions: [],
      policyRefs: [],
      evidenceRefs: object.evidence,
      events: [event],
      validation: {
        passed: true,
        errors: [],
        warnings: []
      },
      committedAt: "2026-06-28T00:00:00.000Z"
    };

    expect(transaction.events[0]?.payload).toEqual({ object });
  });
});

describe("ACT projection", () => {
  it("replays the same committed ACT stream into identical object state", () => {
    const transactions: AtlasCognitiveTransaction[] = [
      {
        id: "act:release:1",
        schemaVersion: "0.1",
        status: "committed",
        goalId: "acr:goal:release",
        traceId: "trace:release",
        createdAt: "2026-06-28T00:00:00.000Z",
        createdBy: "actor:user:moksh",
        intent: "Create release goal",
        reason: "User requested release preparation.",
        preconditions: [],
        policyRefs: [],
        evidenceRefs: [{ sourceId: "input:release-request", sourceType: "user" }],
        validation: {
          passed: true,
          errors: [],
          warnings: []
        },
        events: [
          {
            id: "acr:event:1",
            actId: "act:release:1",
            type: "object.created",
            occurredAt: "2026-06-28T00:00:00.000Z",
            actorId: "actor:user:moksh",
            objectId: "acr:goal:release",
            objectVersion: 1,
            traceId: "trace:release",
            payload: {
              object: {
                id: "acr:goal:release",
                type: "goal",
                schemaVersion: "0.1",
                version: 1,
                lifecycle: "draft",
                createdAt: "2026-06-28T00:00:00.000Z",
                createdBy: "actor:user:moksh",
                traceId: "trace:release",
                confidence: 0.9,
                relationships: [],
                evidence: [{ sourceId: "input:release-request", sourceType: "user" }],
                policies: [],
                payload: { intent: "Prepare release" }
              }
            }
          },
          {
            id: "acr:event:2",
            actId: "act:release:1",
            type: "object.validated",
            occurredAt: "2026-06-28T00:01:00.000Z",
            actorId: "actor:validator",
            objectId: "acr:goal:release",
            objectVersion: 2,
            traceId: "trace:release",
            payload: {}
          }
        ],
        committedAt: "2026-06-28T00:01:00.000Z"
      }
    ];

    expect(projectCommittedACTs(transactions)).toEqual(
      projectCommittedACTs(transactions)
    );
    expect(
      projectCommittedACTs(transactions).objects.get("acr:goal:release")?.lifecycle
    ).toBe("validated");
  });

  it("does not project aborted ACTs", () => {
    const transactions: AtlasCognitiveTransaction[] = [
      {
        id: "act:release:aborted",
        schemaVersion: "0.1",
        status: "aborted",
        traceId: "trace:release",
        createdAt: "2026-06-28T00:00:00.000Z",
        createdBy: "actor:brain",
        intent: "Create invalid release goal",
        reason: "Validation failed.",
        preconditions: [],
        policyRefs: [],
        evidenceRefs: [],
        validation: {
          passed: false,
          errors: ["Missing evidence"],
          warnings: []
        },
        events: [
          {
            id: "acr:event:aborted",
            actId: "act:release:aborted",
            type: "object.created",
            occurredAt: "2026-06-28T00:00:00.000Z",
            actorId: "actor:brain",
            objectId: "acr:goal:invalid",
            objectVersion: 1,
            traceId: "trace:release",
            payload: {
              object: {
                id: "acr:goal:invalid",
                type: "goal",
                schemaVersion: "0.1",
                version: 1,
                lifecycle: "draft",
                createdAt: "2026-06-28T00:00:00.000Z",
                createdBy: "actor:brain",
                traceId: "trace:release",
                confidence: 0.1,
                relationships: [],
                evidence: [],
                policies: [],
                payload: { intent: "Invalid goal" }
              }
            }
          }
        ]
      }
    ];

    expect(projectCommittedACTs(transactions).objects.size).toBe(0);
  });

  it("projects relationships and evidence refs from committed ACTs", () => {
    const transactions: AtlasCognitiveTransaction[] = [
      {
        id: "act:release:graph",
        schemaVersion: "0.1",
        status: "committed",
        goalId: "acr:goal:release",
        traceId: "trace:release",
        createdAt: "2026-06-28T00:00:00.000Z",
        createdBy: "actor:brain",
        intent: "Connect release goal to capability and evidence",
        reason: "The goal needs graph and evidence projections.",
        preconditions: [],
        policyRefs: [],
        evidenceRefs: [{ sourceId: "blob:release-notes", sourceType: "document" }],
        validation: {
          passed: true,
          errors: [],
          warnings: []
        },
        events: [
          {
            id: "acr:event:relationship",
            actId: "act:release:graph",
            type: "relationship.added",
            occurredAt: "2026-06-28T00:01:00.000Z",
            actorId: "actor:brain",
            objectId: "acr:goal:release",
            objectVersion: 2,
            traceId: "trace:release",
            payload: {
              relationship: {
                type: "uses",
                targetId: "acr:capability:create-resource",
                confidence: 0.88
              }
            }
          },
          {
            id: "acr:event:evidence",
            actId: "act:release:graph",
            type: "evidence.attached",
            occurredAt: "2026-06-28T00:01:01.000Z",
            actorId: "actor:brain",
            objectId: "acr:goal:release",
            objectVersion: 2,
            traceId: "trace:release",
            payload: {
              evidence: {
                sourceId: "blob:release-notes",
                sourceType: "document",
                hash: "sha256:release-notes"
              }
            }
          }
        ],
        committedAt: "2026-06-28T00:01:02.000Z"
      }
    ];

    expect(projectCommittedACTs(transactions).relationships).toEqual([
      {
        sourceId: "acr:goal:release",
        type: "uses",
        targetId: "acr:capability:create-resource",
        confidence: 0.88
      }
    ]);
    expect(projectCommittedACTs(transactions).evidenceRefs).toEqual([
      {
        objectId: "acr:goal:release",
        sourceId: "blob:release-notes",
        sourceType: "document",
        hash: "sha256:release-notes"
      }
    ]);
  });
});

describe("ACB publication", () => {
  it("creates lightweight bus messages only after an ACT commits", () => {
    const committedTransaction: AtlasCognitiveTransaction = {
      id: "act:release:publish",
      schemaVersion: "0.1",
      status: "committed",
      goalId: "acr:goal:release",
      traceId: "trace:release",
      createdAt: "2026-06-28T00:00:00.000Z",
      createdBy: "actor:brain",
      intent: "Publish release goal creation",
      reason: "The ACT passed validation and committed.",
      preconditions: [],
      policyRefs: [],
      evidenceRefs: [{ sourceId: "input:release-request", sourceType: "user" }],
      validation: {
        passed: true,
        errors: [],
        warnings: []
      },
      events: [
        {
          id: "acr:event:publish",
          actId: "act:release:publish",
          type: "object.created",
          occurredAt: "2026-06-28T00:01:00.000Z",
          actorId: "actor:brain",
          objectId: "acr:goal:release",
          objectVersion: 1,
          traceId: "trace:release",
          payload: {
            object: {
              id: "acr:goal:release",
              type: "goal",
              schemaVersion: "0.1",
              version: 1,
              lifecycle: "draft",
              createdAt: "2026-06-28T00:00:00.000Z",
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
      committedAt: "2026-06-28T00:01:00.000Z"
    };

    const { committedAt: _committedAt, ...uncommittedTransaction } =
      committedTransaction;
    const proposedTransaction: AtlasCognitiveTransaction = {
      ...uncommittedTransaction,
      id: "act:release:proposed",
      status: "proposed",
      events: [
        {
          ...committedTransaction.events[0]!,
          id: "acr:event:proposed",
          actId: "act:release:proposed"
        }
      ]
    };

    expect(createACBMessagesForACT(committedTransaction)).toEqual([
      {
        messageId: "acb:acr:event:publish",
        type: "object.created",
        timestamp: "2026-06-28T00:01:00.000Z",
        source: "actor:brain",
        actId: "act:release:publish",
        objectId: "acr:goal:release",
        objectVersion: 1,
        traceId: "trace:release",
        dataRef: "acr:event:publish"
      }
    ]);
    expect(createACBMessagesForACT(proposedTransaction)).toEqual([]);
  });
});
