import { describe, expect, it } from "vitest";

import { createIdentityResolution, createIdentitySubject } from "./index.js";

describe("Identity schema", () => {
  it("creates identity subjects with confidence and aliases", () => {
    expect(
      createIdentitySubject({
        id: "identity:user:moksh",
        kind: "human",
        displayName: "Moksh",
        confidence: 0.99,
        aliases: ["Apophis WillTakeOver"],
        evidenceRefs: ["workspace:notion:user"]
      })
    ).toEqual({
      id: "identity:user:moksh",
      schemaVersion: "0.1",
      kind: "human",
      displayName: "Moksh",
      confidence: 0.99,
      aliases: ["Apophis WillTakeOver"],
      evidenceRefs: ["workspace:notion:user"]
    });
  });

  it("creates identity resolution records from external links", () => {
    expect(
      createIdentityResolution({
        id: "identity-resolution:github:moksh",
        subjectId: "identity:user:moksh",
        externalSystem: "github",
        externalId: "Atlas-aios",
        confidence: 0.91,
        resolvedAt: "2026-06-28T00:00:00.000Z",
        evidenceRefs: ["github:org:Atlas-aios"]
      })
    ).toEqual({
      id: "identity-resolution:github:moksh",
      schemaVersion: "0.1",
      subjectId: "identity:user:moksh",
      externalSystem: "github",
      externalId: "Atlas-aios",
      confidence: 0.91,
      resolvedAt: "2026-06-28T00:00:00.000Z",
      evidenceRefs: ["github:org:Atlas-aios"]
    });
  });
});
