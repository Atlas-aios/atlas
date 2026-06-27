import { describe, expect, it } from "vitest";

import {
  createAtlasIR,
  createAtlasSourceDocument,
  SUPPORTED_ATLAS_SOURCE_FORMATS
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
    };
    const ir = createAtlasIR(input);

    expect(ir).toEqual(createAtlasIR(input));
    expect(ir.checksum).toBe(
      "sha256:b8b68b6a59f8a8dca9d2110f76e110579c0640c063d1159029acce18f6b1ac7d"
    );
  });
});
