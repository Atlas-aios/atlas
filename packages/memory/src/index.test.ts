import { describe, expect, it } from "vitest";

import type { DecisionOutcome, DecisionRequest } from "@atlas-aios/decision-engine";
import {
  createInMemoryMemoryStore,
  createDecisionRequestFromMemoryRejection,
  recordMemoryEvent,
  recordDecisionOutcomeAsMemoryEvent,
  type MemoryDecisionRejection
} from "./index.js";

const decisionRequest: DecisionRequest = {
  id: "decision_req_create_resource",
  goalId: "goal_unknown_system",
  action: "Create a billing resource",
  actionType: "capability_execution",
  rationale: "The user asked Atlas to create the resource.",
  reversibility: "reversible",
  externalImpacts: [],
  risks: [],
  alternatives: [],
  evidenceRefs: ["knowledge:openapi:create-resource"],
  requesterIdentityId: "identity:user",
  authorityMode: "broad"
};

const decisionOutcome: DecisionOutcome = {
  requestId: decisionRequest.id,
  type: "approve",
  rationale: "The action is low-risk.",
  constraints: [],
  discussionPoints: [],
  approvalRequired: false,
  auditSeverity: "low",
  evidenceRefs: decisionRequest.evidenceRefs
};

describe("decision memory", () => {
  it("records Decision Engine outcomes as immutable Memory events", () => {
    const event = recordDecisionOutcomeAsMemoryEvent({
      id: "memory:event:decision:1",
      occurredAt: "2026-06-27T15:30:00.000Z",
      decisionOutcome,
      summary: "Decision Engine approved Create Resource."
    });

    expect(event).toEqual({
      id: "memory:event:decision:1",
      kind: "decision",
      occurredAt: "2026-06-27T15:30:00.000Z",
      summary: "Decision Engine approved Create Resource.",
      sourceIds: ["decision_req_create_resource", "knowledge:openapi:create-resource"]
    });
  });

  it("sends Memory rejection reasons back through the Decision Engine", () => {
    const memoryRejection: MemoryDecisionRejection = {
      id: "memory:rejection:duplicate-billing-resource",
      reason:
        "A previous execution created duplicate billing resources for this provider.",
      severity: "high",
      evidenceRefs: ["memory:event:failure:duplicate-billing-resource"],
      occurredAt: "2026-06-27T15:35:00.000Z"
    };

    const reconsiderationRequest = createDecisionRequestFromMemoryRejection({
      originalRequest: decisionRequest,
      memoryRejection
    });

    expect(reconsiderationRequest.id).toBe(
      "decision_req_create_resource:memory_reconsideration:memory:rejection:duplicate-billing-resource"
    );
    expect(reconsiderationRequest.risks).toContainEqual({
      kind: "memory_rejection",
      severity: "high",
      description:
        "A previous execution created duplicate billing resources for this provider.",
      requiresRejection: true
    });
    expect(reconsiderationRequest.evidenceRefs).toEqual([
      "knowledge:openapi:create-resource",
      "memory:event:failure:duplicate-billing-resource"
    ]);
  });
});

describe("memory event store", () => {
  it("records raw Memory events with provenance and evidence", () => {
    const store = createInMemoryMemoryStore();

    const event = recordMemoryEvent(store, {
      id: "memory:event:execution:create-folio",
      kind: "execution",
      occurredAt: "2026-07-16T12:30:00.000Z",
      summary: "Executed provider:openapi:create-folio for capability:create-folio.",
      subjectIds: [
        "execution:runtime:create-folio",
        "capability:create-folio",
        "provider:openapi:create-folio"
      ],
      sourceIds: [
        "fixture:rest:POST /folios",
        "runtime:provider:provider:openapi:create-folio"
      ],
      evidenceRefs: ["execution:runtime:create-folio:step:node:runtime-provider"],
      metadata: {
        status: "completed"
      }
    });

    expect(event).toEqual({
      id: "memory:event:execution:create-folio",
      kind: "execution",
      occurredAt: "2026-07-16T12:30:00.000Z",
      summary: "Executed provider:openapi:create-folio for capability:create-folio.",
      subjectIds: [
        "execution:runtime:create-folio",
        "capability:create-folio",
        "provider:openapi:create-folio"
      ],
      sourceIds: [
        "fixture:rest:POST /folios",
        "runtime:provider:provider:openapi:create-folio"
      ],
      evidenceRefs: ["execution:runtime:create-folio:step:node:runtime-provider"],
      metadata: {
        status: "completed"
      }
    });
    expect(store.list()).toEqual([event]);
  });

  it("filters Memory events by kind, subject, and source references", () => {
    const store = createInMemoryMemoryStore();
    recordMemoryEvent(store, {
      id: "memory:event:approval:1",
      kind: "approval",
      occurredAt: "2026-07-16T12:35:00.000Z",
      summary: "Approved runtime execution.",
      subjectIds: ["approval:runtime:execution:runtime:create-folio"],
      sourceIds: ["governance:runtime:mvp"],
      evidenceRefs: [],
      metadata: {}
    });
    recordMemoryEvent(store, {
      id: "memory:event:execution:1",
      kind: "execution",
      occurredAt: "2026-07-16T12:30:00.000Z",
      summary: "Executed runtime provider.",
      subjectIds: ["execution:runtime:create-folio"],
      sourceIds: ["fixture:rest:POST /folios"],
      evidenceRefs: [],
      metadata: {}
    });

    expect(
      store.list({
        kinds: ["execution"],
        subjectIds: ["execution:runtime:create-folio"],
        sourceIds: ["fixture:rest:POST /folios"]
      })
    ).toEqual([
      {
        id: "memory:event:execution:1",
        kind: "execution",
        occurredAt: "2026-07-16T12:30:00.000Z",
        summary: "Executed runtime provider.",
        subjectIds: ["execution:runtime:create-folio"],
        sourceIds: ["fixture:rest:POST /folios"],
        evidenceRefs: [],
        metadata: {}
      }
    ]);
  });

  it("returns copies so callers cannot mutate stored Memory records", () => {
    const store = createInMemoryMemoryStore();
    recordMemoryEvent(store, {
      id: "memory:event:decision:1",
      kind: "decision",
      occurredAt: "2026-07-16T12:10:00.000Z",
      summary: "Decision was approved.",
      subjectIds: ["decision:runtime:1"],
      sourceIds: ["decision:req:1"],
      evidenceRefs: ["evidence:1"],
      metadata: {
        outcome: "approve"
      }
    });

    const listed = store.list();
    const listedEvent = listed[0];
    expect(listedEvent).toBeDefined();
    listedEvent?.sourceIds.push("mutated:source");
    listedEvent!.metadata!.outcome = "mutated";

    expect(store.list()).toEqual([
      {
        id: "memory:event:decision:1",
        kind: "decision",
        occurredAt: "2026-07-16T12:10:00.000Z",
        summary: "Decision was approved.",
        subjectIds: ["decision:runtime:1"],
        sourceIds: ["decision:req:1"],
        evidenceRefs: ["evidence:1"],
        metadata: {
          outcome: "approve"
        }
      }
    ]);
  });
});
