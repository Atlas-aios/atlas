import { describe, expect, it } from "vitest";

import {
  createIdentityResolution,
  createIdentitySubject,
  createInMemoryIdentityStore,
  recordIdentityResolution,
  recordIdentitySubject
} from "./index.js";

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

describe("Identity store", () => {
  it("records identity subjects and external resolutions", () => {
    const store = createInMemoryIdentityStore();
    const subject = recordIdentitySubject(
      store,
      createIdentitySubject({
        id: "identity:user:moksh",
        kind: "human",
        displayName: "Moksh",
        confidence: 0.99,
        aliases: ["Apophis WillTakeOver"],
        evidenceRefs: ["workspace:notion:user"]
      })
    );
    const resolution = recordIdentityResolution(
      store,
      createIdentityResolution({
        id: "identity-resolution:github:moksh",
        subjectId: "identity:user:moksh",
        externalSystem: "github",
        externalId: "Atlas-aios",
        confidence: 0.91,
        resolvedAt: "2026-06-28T00:00:00.000Z",
        evidenceRefs: ["github:org:Atlas-aios"]
      })
    );

    expect(store.listSubjects()).toEqual([subject]);
    expect(store.listResolutions()).toEqual([resolution]);
  });

  it("resolves subjects by alias and external account", () => {
    const store = createInMemoryIdentityStore();
    recordIdentitySubject(
      store,
      createIdentitySubject({
        id: "identity:user:moksh",
        kind: "human",
        displayName: "Moksh",
        confidence: 0.99,
        aliases: ["Apophis WillTakeOver", "moksh"],
        evidenceRefs: ["workspace:notion:user"]
      })
    );
    recordIdentityResolution(
      store,
      createIdentityResolution({
        id: "identity-resolution:github:moksh",
        subjectId: "identity:user:moksh",
        externalSystem: "github",
        externalId: "Atlas-aios",
        confidence: 0.91,
        resolvedAt: "2026-06-28T00:00:00.000Z",
        evidenceRefs: ["github:org:Atlas-aios"]
      })
    );

    expect(store.findSubject({ alias: "apophis willtakeover" })?.id).toBe(
      "identity:user:moksh"
    );
    expect(
      store.findSubject({
        externalSystem: "github",
        externalId: "Atlas-aios"
      })?.id
    ).toBe("identity:user:moksh");
  });

  it("filters identity subjects by kind", () => {
    const store = createInMemoryIdentityStore();
    recordIdentitySubject(
      store,
      createIdentitySubject({
        id: "identity:user:moksh",
        kind: "human",
        displayName: "Moksh",
        confidence: 0.99,
        aliases: [],
        evidenceRefs: []
      })
    );
    recordIdentitySubject(
      store,
      createIdentitySubject({
        id: "identity:system:atlas",
        kind: "system",
        displayName: "Atlas Runtime",
        confidence: 0.95,
        aliases: [],
        evidenceRefs: []
      })
    );

    expect(store.listSubjects({ kinds: ["system"] })).toEqual([
      {
        id: "identity:system:atlas",
        schemaVersion: "0.1",
        kind: "system",
        displayName: "Atlas Runtime",
        confidence: 0.95,
        aliases: [],
        evidenceRefs: []
      }
    ]);
  });

  it("returns copies so callers cannot mutate stored identities", () => {
    const store = createInMemoryIdentityStore();
    recordIdentitySubject(
      store,
      createIdentitySubject({
        id: "identity:user:moksh",
        kind: "human",
        displayName: "Moksh",
        confidence: 0.99,
        aliases: ["moksh"],
        evidenceRefs: ["workspace:notion:user"]
      })
    );

    const listed = store.listSubjects();
    const listedSubject = listed[0];
    expect(listedSubject).toBeDefined();
    listedSubject?.aliases.push("mutated");
    listedSubject?.evidenceRefs.push("mutated:evidence");

    expect(store.listSubjects()).toEqual([
      {
        id: "identity:user:moksh",
        schemaVersion: "0.1",
        kind: "human",
        displayName: "Moksh",
        confidence: 0.99,
        aliases: ["moksh"],
        evidenceRefs: ["workspace:notion:user"]
      }
    ]);
  });
});
