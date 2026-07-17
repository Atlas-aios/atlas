import { describe, expect, it } from "vitest";

import {
  createInMemorySelfModelStore,
  createSelfModelSnapshot,
  updateSelfModelFromExecutionOutcome
} from "./index.js";

describe("Self Model snapshots", () => {
  it("creates a compact snapshot of Atlas capability, authority, and maturity", () => {
    const snapshot = createSelfModelSnapshot({
      id: "self-model:snapshot:runtime",
      generatedAt: "2026-07-16T12:30:00.000Z",
      availableCapabilityIds: ["capability:create-folio"],
      grantedAuthority: ["authority:execute:simulation"],
      resourceLimits: {
        maxEstimatedCostPerExecution: 0.2,
        maxEstimatedLatencyMs: 2_000
      },
      capabilityConfidence: [
        {
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          confidence: 0.65,
          knownLimitations: ["Requires learned provider registration."],
          knownFailureModes: [],
          evidenceRefs: ["learning:unknown-business-system"],
          updatedAt: "2026-07-16T12:30:00.000Z"
        }
      ],
      interfaceMaturity: [
        {
          interfaceId: "interface:openapi:unknown-business",
          maturity: "validated",
          confidence: 0.8,
          evidenceRefs: ["benchmark:unknown-business:create-resource"],
          updatedAt: "2026-07-16T12:30:00.000Z"
        }
      ],
      subsystemMaturity: [
        {
          subsystemId: "subsystem:execution-engine",
          maturity: "implemented",
          confidence: 0.75,
          evidenceRefs: ["test:execution-engine"],
          updatedAt: "2026-07-16T12:30:00.000Z"
        }
      ],
      knownLimitations: ["No browser UI driver in production path yet."],
      knownFailureModes: ["Provider calls fail when no provider is registered."]
    });

    expect(snapshot).toEqual({
      id: "self-model:snapshot:runtime",
      schemaVersion: "0.1",
      generatedAt: "2026-07-16T12:30:00.000Z",
      availableCapabilityIds: ["capability:create-folio"],
      grantedAuthority: ["authority:execute:simulation"],
      resourceLimits: {
        maxEstimatedCostPerExecution: 0.2,
        maxEstimatedLatencyMs: 2_000
      },
      capabilityConfidence: [
        {
          capabilityId: "capability:create-folio",
          providerId: "provider:openapi:create-folio",
          confidence: 0.65,
          knownLimitations: ["Requires learned provider registration."],
          knownFailureModes: [],
          evidenceRefs: ["learning:unknown-business-system"],
          updatedAt: "2026-07-16T12:30:00.000Z"
        }
      ],
      interfaceMaturity: [
        {
          interfaceId: "interface:openapi:unknown-business",
          maturity: "validated",
          confidence: 0.8,
          evidenceRefs: ["benchmark:unknown-business:create-resource"],
          updatedAt: "2026-07-16T12:30:00.000Z"
        }
      ],
      subsystemMaturity: [
        {
          subsystemId: "subsystem:execution-engine",
          maturity: "implemented",
          confidence: 0.75,
          evidenceRefs: ["test:execution-engine"],
          updatedAt: "2026-07-16T12:30:00.000Z"
        }
      ],
      knownLimitations: ["No browser UI driver in production path yet."],
      knownFailureModes: ["Provider calls fail when no provider is registered."]
    });
  });
});

describe("Self Model store", () => {
  it("records immutable snapshots", () => {
    const store = createInMemorySelfModelStore();
    const snapshot = store.recordSnapshot(
      createSelfModelSnapshot({
        id: "self-model:snapshot:runtime",
        generatedAt: "2026-07-16T12:30:00.000Z",
        availableCapabilityIds: ["capability:create-folio"],
        grantedAuthority: ["authority:execute:simulation"],
        resourceLimits: {},
        capabilityConfidence: [],
        interfaceMaturity: [],
        subsystemMaturity: [],
        knownLimitations: ["Initial limitation."],
        knownFailureModes: []
      })
    );

    snapshot.availableCapabilityIds.push("capability:mutated");
    snapshot.knownLimitations.push("Mutated limitation.");

    expect(store.getCurrentSnapshot()).toEqual({
      id: "self-model:snapshot:runtime",
      schemaVersion: "0.1",
      generatedAt: "2026-07-16T12:30:00.000Z",
      availableCapabilityIds: ["capability:create-folio"],
      grantedAuthority: ["authority:execute:simulation"],
      resourceLimits: {},
      capabilityConfidence: [],
      interfaceMaturity: [],
      subsystemMaturity: [],
      knownLimitations: ["Initial limitation."],
      knownFailureModes: []
    });
  });

  it("updates capability/provider confidence from execution outcomes", () => {
    const store = createInMemorySelfModelStore();

    const successSnapshot = updateSelfModelFromExecutionOutcome(store, {
      capabilityId: "capability:create-folio",
      providerId: "provider:openapi:create-folio",
      status: "completed",
      occurredAt: "2026-07-16T12:30:00.000Z",
      evidenceRefs: ["execution:runtime:create-folio"]
    });
    const failureSnapshot = updateSelfModelFromExecutionOutcome(store, {
      capabilityId: "capability:create-folio",
      providerId: "provider:openapi:create-folio",
      status: "failed",
      occurredAt: "2026-07-16T12:35:00.000Z",
      evidenceRefs: ["execution:runtime:create-folio:retry"],
      failureMode: "Provider returned a non-2xx response.",
      limitation: "OpenAPI provider requires valid fixture payloads."
    });

    expect(successSnapshot.capabilityConfidence).toEqual([
      {
        capabilityId: "capability:create-folio",
        providerId: "provider:openapi:create-folio",
        confidence: 0.6,
        knownLimitations: [],
        knownFailureModes: [],
        evidenceRefs: ["execution:runtime:create-folio"],
        updatedAt: "2026-07-16T12:30:00.000Z"
      }
    ]);
    expect(failureSnapshot.capabilityConfidence).toEqual([
      {
        capabilityId: "capability:create-folio",
        providerId: "provider:openapi:create-folio",
        confidence: 0.45,
        knownLimitations: ["OpenAPI provider requires valid fixture payloads."],
        knownFailureModes: ["Provider returned a non-2xx response."],
        evidenceRefs: [
          "execution:runtime:create-folio",
          "execution:runtime:create-folio:retry"
        ],
        updatedAt: "2026-07-16T12:35:00.000Z"
      }
    ]);
  });
});
