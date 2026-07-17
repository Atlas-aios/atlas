import { describe, expect, it } from "vitest";

import {
  createInMemorySemanticWorldModelStore,
  createSemanticEntity,
  createSemanticRelationship,
  recordSemanticEntity,
  recordSemanticRelationship
} from "./index.js";

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

describe("Semantic World Model store", () => {
  it("records entities and relationships with provenance", () => {
    const store = createInMemorySemanticWorldModelStore();
    const entity = recordSemanticEntity(
      store,
      createSemanticEntity({
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
    );
    const relationship = recordSemanticRelationship(
      store,
      createSemanticRelationship({
        id: "swm:relationship:system-has-create-folio",
        fromEntityId: "swm:entity:system:unknown-business",
        toEntityId: "swm:entity:capability:create-folio",
        type: "has_capability",
        confidence: 0.8,
        evidenceRefs: ["capability-graph:unknown-business-system"],
        observedAt: "2026-07-16T00:00:00.000Z"
      })
    );

    expect(store.listEntities()).toEqual([entity]);
    expect(store.listRelationships()).toEqual([relationship]);
  });

  it("filters entities and relationships by type and connected entity", () => {
    const store = createInMemorySemanticWorldModelStore();
    recordSemanticEntity(
      store,
      createSemanticEntity({
        id: "swm:entity:system:unknown-business",
        type: "software_system",
        label: "Unknown Business System",
        attributes: {},
        confidence: 0.8,
        evidenceRefs: ["fixture:unknown-business"],
        observedAt: "2026-07-16T00:00:00.000Z"
      })
    );
    recordSemanticEntity(
      store,
      createSemanticEntity({
        id: "swm:entity:capability:create-folio",
        type: "capability",
        label: "Create folio",
        attributes: {},
        confidence: 0.8,
        evidenceRefs: ["openapi:POST /folios"],
        observedAt: "2026-07-16T00:00:00.000Z"
      })
    );
    recordSemanticRelationship(
      store,
      createSemanticRelationship({
        id: "swm:relationship:system-has-create-folio",
        fromEntityId: "swm:entity:system:unknown-business",
        toEntityId: "swm:entity:capability:create-folio",
        type: "has_capability",
        confidence: 0.8,
        evidenceRefs: ["capability-graph:unknown-business-system"],
        observedAt: "2026-07-16T00:00:00.000Z"
      })
    );

    expect(store.listEntities({ types: ["capability"] })).toEqual([
      {
        id: "swm:entity:capability:create-folio",
        schemaVersion: "0.1",
        type: "capability",
        label: "Create folio",
        attributes: {},
        confidence: 0.8,
        evidenceRefs: ["openapi:POST /folios"],
        observedAt: "2026-07-16T00:00:00.000Z"
      }
    ]);
    expect(
      store.listRelationships({
        entityId: "swm:entity:system:unknown-business",
        types: ["has_capability"]
      })
    ).toEqual([
      {
        id: "swm:relationship:system-has-create-folio",
        schemaVersion: "0.1",
        fromEntityId: "swm:entity:system:unknown-business",
        toEntityId: "swm:entity:capability:create-folio",
        type: "has_capability",
        confidence: 0.8,
        evidenceRefs: ["capability-graph:unknown-business-system"],
        observedAt: "2026-07-16T00:00:00.000Z"
      }
    ]);
  });

  it("traverses relationships from an entity", () => {
    const store = createInMemorySemanticWorldModelStore();
    recordSemanticRelationship(
      store,
      createSemanticRelationship({
        id: "swm:relationship:system-has-create-folio",
        fromEntityId: "swm:entity:system:unknown-business",
        toEntityId: "swm:entity:capability:create-folio",
        type: "has_capability",
        confidence: 0.8,
        evidenceRefs: ["capability-graph:unknown-business-system"],
        observedAt: "2026-07-16T00:00:00.000Z"
      })
    );
    recordSemanticRelationship(
      store,
      createSemanticRelationship({
        id: "swm:relationship:provider-implements-create-folio",
        fromEntityId: "swm:entity:provider:openapi:create-folio",
        toEntityId: "swm:entity:capability:create-folio",
        type: "implements",
        confidence: 0.74,
        evidenceRefs: ["provider:openapi:create-folio"],
        observedAt: "2026-07-16T00:00:00.000Z"
      })
    );

    expect(
      store.traverse({
        entityId: "swm:entity:capability:create-folio",
        direction: "incoming"
      })
    ).toEqual([
      {
        id: "swm:relationship:system-has-create-folio",
        schemaVersion: "0.1",
        fromEntityId: "swm:entity:system:unknown-business",
        toEntityId: "swm:entity:capability:create-folio",
        type: "has_capability",
        confidence: 0.8,
        evidenceRefs: ["capability-graph:unknown-business-system"],
        observedAt: "2026-07-16T00:00:00.000Z"
      },
      {
        id: "swm:relationship:provider-implements-create-folio",
        schemaVersion: "0.1",
        fromEntityId: "swm:entity:provider:openapi:create-folio",
        toEntityId: "swm:entity:capability:create-folio",
        type: "implements",
        confidence: 0.74,
        evidenceRefs: ["provider:openapi:create-folio"],
        observedAt: "2026-07-16T00:00:00.000Z"
      }
    ]);
  });

  it("returns copies so callers cannot mutate stored SWM records", () => {
    const store = createInMemorySemanticWorldModelStore();
    recordSemanticEntity(
      store,
      createSemanticEntity({
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
    );

    const listed = store.listEntities();
    const listedEntity = listed[0];
    expect(listedEntity).toBeDefined();
    if (listedEntity !== undefined) {
      listedEntity.evidenceRefs.push("mutated:evidence");
      listedEntity.attributes.capabilityId = "mutated";
    }

    expect(store.listEntities()).toEqual([
      {
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
    ]);
  });
});
