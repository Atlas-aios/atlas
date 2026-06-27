import { describe, expect, it } from "vitest";

import {
  CAPABILITY_LEVELS,
  createCapabilityGraph,
  createCapabilityNode
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
});
