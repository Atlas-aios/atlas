import { describe, expect, it } from "vitest";

import {
  ATLAS_FLOW_EDGE_TYPES,
  ATLAS_FLOW_NODE_TYPES,
  ATLAS_IR_OPS,
  type AtlasIRInput,
  createAtlasFlow,
  createAtlasIR,
  createAtlasIRReplayPlan,
  createAtlasSourceDocument,
  SUPPORTED_ATLAS_SOURCE_FORMATS,
  validateAtlasFlow
} from "./index.js";

describe("Atlas source and IR boundaries", () => {
  it("wraps ATL source in a compact source-format boundary", () => {
    const document = createAtlasSourceDocument({
      id: "atl:goal:create-resource",
      format: "atl",
      version: "0.1",
      source: "goal create_resource -> capability create_resource",
      createdAt: "2026-06-28T00:00:00.000Z",
      createdBy: "actor:brain"
    });

    expect(SUPPORTED_ATLAS_SOURCE_FORMATS).toEqual(["atl", "atlasflow"]);
    expect(document).toEqual({
      id: "atl:goal:create-resource",
      format: "atl",
      mimeType: "text/atlas-atl",
      version: "0.1",
      source: "goal create_resource -> capability create_resource",
      sourceHash:
        "sha256:7d554a115f0904e4b0275db77ff288337d46498f1ecc487faddd114009860402",
      createdAt: "2026-06-28T00:00:00.000Z",
      createdBy: "actor:brain"
    });
  });

  it("creates deterministic AtlasIR version and checksum records", () => {
    const input = {
      id: "atlasir:create-resource:v1",
      sourceDocumentId: "atl:goal:create-resource",
      version: "0.1",
      instructions: [
        {
          op: "resolve_capability",
          args: {
            capabilityId: "capability:create-resource"
          }
        },
        {
          op: "execute_provider",
          args: {
            providerSelection: "ranked"
          }
        }
      ],
      createdAt: "2026-06-28T00:01:00.000Z",
      createdBy: "actor:compiler"
    } satisfies AtlasIRInput;
    const ir = createAtlasIR(input);

    expect(ir).toEqual(createAtlasIR(input));
    expect(ir.checksum).toBe(
      "sha256:b8b68b6a59f8a8dca9d2110f76e110579c0640c063d1159029acce18f6b1ac7d"
    );
  });

  it("defines explicit AtlasFlow node and edge schema boundaries", () => {
    expect(ATLAS_FLOW_NODE_TYPES).toEqual([
      "capability",
      "approval",
      "human_provider",
      "wait",
      "parallel",
      "compensation"
    ]);
    expect(ATLAS_FLOW_EDGE_TYPES).toEqual([
      "sequence",
      "conditional",
      "on_failure",
      "compensation"
    ]);
  });

  it("creates validated AtlasFlow workflow records", () => {
    const flow = createAtlasFlow({
      id: "atlasflow:create-resource",
      version: "0.1",
      nodes: [
        {
          id: "node:create-resource",
          type: "capability",
          inputs: {
            capabilityId: "capability:create-resource"
          }
        },
        {
          id: "node:approval",
          type: "approval",
          inputs: {
            approvalRequestId: "approval:create-resource",
            reason: "Requires owner approval."
          }
        }
      ],
      edges: [
        {
          id: "edge:create-to-approval",
          type: "sequence",
          fromNodeId: "node:create-resource",
          toNodeId: "node:approval"
        }
      ]
    });

    expect(flow.nodes[0]?.inputs).toEqual({
      capabilityId: "capability:create-resource"
    });
    expect(flow.edges[0]?.type).toBe("sequence");
  });

  it("reports invalid AtlasFlow schema errors", () => {
    expect(
      validateAtlasFlow({
        id: "atlasflow:invalid",
        version: "0.1",
        nodes: [
          {
            id: "node:duplicate",
            type: "capability",
            inputs: {}
          },
          {
            id: "node:duplicate",
            type: "wait",
            inputs: { delayMs: 10 }
          }
        ],
        edges: [
          {
            id: "edge:missing-target",
            type: "sequence",
            fromNodeId: "node:duplicate",
            toNodeId: "node:missing"
          }
        ]
      })
    ).toEqual({
      valid: false,
      errors: [
        "Duplicate AtlasFlow node id: node:duplicate",
        "AtlasFlow edge target node not found: node:missing"
      ]
    });
  });

  it("defines typed AtlasIR instructions and replay checksum contract", () => {
    expect(ATLAS_IR_OPS).toEqual([
      "resolve_capability",
      "rank_provider",
      "execute_provider",
      "execute_workflow",
      "wait_for_approval",
      "delegate_human",
      "checkpoint",
      "rollback",
      "compensate"
    ]);

    const ir = createAtlasIR({
      id: "atlasir:create-resource:v2",
      sourceDocumentId: "atlasflow:create-resource",
      version: "0.1",
      instructions: [
        {
          op: "resolve_capability",
          args: { capabilityId: "capability:create-resource" }
        },
        {
          op: "execute_workflow",
          args: { workflowId: "atlasflow:create-resource" }
        }
      ],
      createdAt: "2026-06-28T00:02:00.000Z",
      createdBy: "actor:compiler"
    });

    expect(createAtlasIRReplayPlan(ir)).toEqual({
      irId: "atlasir:create-resource:v2",
      sourceDocumentId: "atlasflow:create-resource",
      version: "0.1",
      checksum: ir.checksum,
      valid: true,
      instructions: ir.instructions
    });
    expect(
      createAtlasIRReplayPlan({
        ...ir,
        checksum: "sha256:tampered"
      })
    ).toEqual({
      irId: "atlasir:create-resource:v2",
      sourceDocumentId: "atlasflow:create-resource",
      version: "0.1",
      checksum: "sha256:tampered",
      valid: false,
      instructions: [],
      error: "AtlasIR checksum mismatch"
    });
  });
});
