import { describe, expect, it } from "vitest";

import { createSemanticEntity, createSemanticRelationship } from "./index.js";

describe("Semantic World Model schemas", () => {
  it("creates semantic entities with provenance-ready metadata", () => {
    expect(
      createSemanticEntity({
        id: "swm:entity:resource",
        type: "business_resource",
        label: "Resource",
        attributes: {
          externalName: "Resource"
        },
        confidence: 0.87,
        evidenceRefs: ["evidence:docs:resource"],
        observedAt: "2026-06-28T00:00:00.000Z"
      })
    ).toEqual({
      id: "swm:entity:resource",
      schemaVersion: "0.1",
      type: "business_resource",
      label: "Resource",
      attributes: {
        externalName: "Resource"
      },
      confidence: 0.87,
      evidenceRefs: ["evidence:docs:resource"],
      observedAt: "2026-06-28T00:00:00.000Z"
    });
  });

  it("creates semantic relationships between entities", () => {
    expect(
      createSemanticRelationship({
        id: "swm:relationship:resource-owned-by-project",
        fromEntityId: "swm:entity:resource",
        toEntityId: "swm:entity:project",
        type: "owned_by",
        confidence: 0.81,
        evidenceRefs: ["evidence:openapi:resource-schema"],
        observedAt: "2026-06-28T00:01:00.000Z"
      })
    ).toEqual({
      id: "swm:relationship:resource-owned-by-project",
      schemaVersion: "0.1",
      fromEntityId: "swm:entity:resource",
      toEntityId: "swm:entity:project",
      type: "owned_by",
      confidence: 0.81,
      evidenceRefs: ["evidence:openapi:resource-schema"],
      observedAt: "2026-06-28T00:01:00.000Z"
    });
  });
});
