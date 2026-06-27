import { describe, expect, it } from "vitest";

import type { ACRObject } from "./acr.js";
import {
  createACRSearchProjectionRecord,
  createRawEvidenceRecord
} from "./acr-boundaries.js";

describe("ACR storage boundaries", () => {
  it("stores raw evidence outside ACR as an object-storage pointer", () => {
    const record = createRawEvidenceRecord({
      id: "evidence:release-request",
      sourceType: "document",
      capturedAt: "2026-06-28T00:00:00.000Z",
      capturedBy: "actor:user:moksh",
      storageUri: "s3://atlas-evidence/release-request.md",
      contentHash: "sha256:release-request",
      contentType: "text/markdown",
      byteLength: 4096,
      metadata: {
        title: "Release request"
      }
    });

    expect(record).toEqual({
      id: "evidence:release-request",
      sourceType: "document",
      capturedAt: "2026-06-28T00:00:00.000Z",
      capturedBy: "actor:user:moksh",
      storage: {
        uri: "s3://atlas-evidence/release-request.md",
        contentHash: "sha256:release-request",
        contentType: "text/markdown",
        byteLength: 4096
      },
      metadata: {
        title: "Release request"
      }
    });
    expect(record).not.toHaveProperty("content");
  });

  it("creates rebuildable search and vector projection records from ACR objects", () => {
    const object: ACRObject<{ title: string; description: string }> = {
      id: "acr:goal:create-resource",
      type: "goal",
      schemaVersion: "0.1",
      version: 3,
      lifecycle: "validated",
      createdAt: "2026-06-28T00:00:00.000Z",
      createdBy: "actor:brain",
      traceId: "trace:create-resource",
      confidence: 0.91,
      relationships: [
        {
          type: "uses",
          targetId: "acr:capability:create-resource",
          confidence: 0.88
        }
      ],
      evidence: [
        {
          sourceId: "evidence:release-request",
          sourceType: "document",
          hash: "sha256:release-request"
        }
      ],
      policies: ["policy:approval:external-write"],
      payload: {
        title: "Create Resource",
        description: "Create a resource in an unknown business system."
      }
    };

    const record = createACRSearchProjectionRecord(object, {
      sourceEventId: "acr:event:goal:validated",
      projectedAt: "2026-06-28T00:05:00.000Z",
      embeddingRef: "vector:acr:goal:create-resource:v3"
    });

    expect(record).toEqual({
      objectId: "acr:goal:create-resource",
      objectType: "goal",
      objectVersion: 3,
      lifecycle: "validated",
      sourceEventId: "acr:event:goal:validated",
      projectedAt: "2026-06-28T00:05:00.000Z",
      indexedText:
        "goal validated Create Resource Create a resource in an unknown business system.",
      embeddingRef: "vector:acr:goal:create-resource:v3",
      relationshipTargetIds: ["acr:capability:create-resource"],
      evidenceSourceIds: ["evidence:release-request"],
      policyRefs: ["policy:approval:external-write"]
    });
  });
});
