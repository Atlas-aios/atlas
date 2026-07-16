import { describe, expect, it } from "vitest";

import {
  CAPABILITY_LEVELS,
  createCapabilityGraph,
  createCapabilityNode,
  createInMemoryCapabilityGraphStore,
  searchCapabilityGraph,
  traverseCapabilityGraph
} from "./index.js";

describe("Capability Graph schema", () => {
  it("creates capability nodes across the L0-L4 ontology", () => {
    expect(CAPABILITY_LEVELS).toEqual(["L0", "L1", "L2", "L3", "L4"]);
    expect(
      createCapabilityNode({
        id: "capability:create-resource",
        name: "Create Resource",
        level: "L2",
        confidence: 0.82,
        sourceRefs: ["swm:entity:resource"]
      })
    ).toEqual({
      id: "capability:create-resource",
      schemaVersion: "0.1",
      name: "Create Resource",
      level: "L2",
      confidence: 0.82,
      sourceRefs: ["swm:entity:resource"]
    });
  });

  it("creates capability graphs with dependency edges", () => {
    expect(
      createCapabilityGraph({
        id: "capability-graph:unknown-system",
        status: "draft",
        generatedAt: "2026-06-28T00:00:00.000Z",
        nodes: [
          createCapabilityNode({
            id: "capability:authenticate",
            name: "Authenticate",
            level: "L1",
            confidence: 0.9,
            sourceRefs: ["evidence:openapi:auth"]
          }),
          createCapabilityNode({
            id: "capability:create-resource",
            name: "Create Resource",
            level: "L2",
            confidence: 0.82,
            sourceRefs: ["evidence:openapi:resource"]
          })
        ],
        edges: [
          {
            fromCapabilityId: "capability:create-resource",
            toCapabilityId: "capability:authenticate",
            relationship: "requires"
          }
        ]
      })
    ).toMatchObject({
      id: "capability-graph:unknown-system",
      schemaVersion: "0.1",
      status: "draft",
      generatedAt: "2026-06-28T00:00:00.000Z",
      edges: [
        {
          fromCapabilityId: "capability:create-resource",
          toCapabilityId: "capability:authenticate",
          relationship: "requires"
        }
      ]
    });
  });

  it("stores, traverses, and searches capability graphs", () => {
    const graph = createCapabilityGraph({
      id: "capability-graph:unknown-system",
      status: "draft",
      generatedAt: "2026-07-16T12:00:00.000Z",
      nodes: [
        createCapabilityNode({
          id: "capability:authenticate",
          name: "Authenticate",
          level: "L1",
          confidence: 0.92,
          sourceRefs: ["evidence:openapi:auth"]
        }),
        createCapabilityNode({
          id: "capability:create-resource",
          name: "Create Resource",
          level: "L2",
          confidence: 0.84,
          sourceRefs: ["evidence:openapi:create"]
        }),
        createCapabilityNode({
          id: "capability:browser-create-resource",
          name: "Create Resource Through Browser",
          level: "L3",
          confidence: 0.64,
          sourceRefs: ["evidence:ui:create"]
        })
      ],
      edges: [
        {
          fromCapabilityId: "capability:create-resource",
          toCapabilityId: "capability:authenticate",
          relationship: "requires"
        },
        {
          fromCapabilityId: "capability:create-resource",
          toCapabilityId: "capability:browser-create-resource",
          relationship: "fallbacks_to"
        },
        {
          fromCapabilityId: "capability:browser-create-resource",
          toCapabilityId: "capability:authenticate",
          relationship: "requires"
        }
      ]
    });
    const store = createInMemoryCapabilityGraphStore();

    store.save(graph);

    expect(store.get("capability-graph:unknown-system")).toEqual(graph);
    expect(
      traverseCapabilityGraph({
        graph,
        startCapabilityId: "capability:create-resource",
        relationships: ["requires", "fallbacks_to"],
        maxDepth: 2
      })
    ).toEqual({
      startCapabilityId: "capability:create-resource",
      visitedCapabilityIds: [
        "capability:create-resource",
        "capability:authenticate",
        "capability:browser-create-resource"
      ],
      edges: [
        {
          fromCapabilityId: "capability:create-resource",
          toCapabilityId: "capability:authenticate",
          relationship: "requires"
        },
        {
          fromCapabilityId: "capability:create-resource",
          toCapabilityId: "capability:browser-create-resource",
          relationship: "fallbacks_to"
        },
        {
          fromCapabilityId: "capability:browser-create-resource",
          toCapabilityId: "capability:authenticate",
          relationship: "requires"
        }
      ]
    });
    expect(
      searchCapabilityGraph({
        graph,
        query: "create resource",
        levels: ["L2", "L3"],
        minimumConfidence: 0.7
      })
    ).toEqual([
      {
        id: "capability:create-resource",
        schemaVersion: "0.1",
        name: "Create Resource",
        level: "L2",
        confidence: 0.84,
        sourceRefs: ["evidence:openapi:create"]
      }
    ]);
  });
});
