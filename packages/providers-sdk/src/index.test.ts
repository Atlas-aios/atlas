import { describe, expect, it } from "vitest";

import {
  createProviderRegistry,
  executeProvider,
  getLatestProviderVersion,
  getProviderVersions,
  registerProvider
} from "./index.js";

describe("Capability Provider Runtime", () => {
  it("registers a provider and executes it with validated inputs and outputs", async () => {
    const registry = createProviderRegistry();
    registerProvider(registry, {
      manifest: {
        id: "provider:rest:create-resource",
        name: "REST Create Resource Provider",
        version: "0.1.0",
        lifecycle: "healthy",
        capabilityIds: ["capability:create-resource"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: ["network:unknown-system"],
        inputSchema: [{ name: "name", type: "string", required: true }],
        outputSchema: [{ name: "resourceId", type: "string", required: true }]
      },
      handler: async (request) => ({
        outputs: { resourceId: `resource:${request.inputs.name}` },
        evidence: ["trace:rest:create-resource"],
        compensationRef: "compensation:delete-resource"
      }),
      registeredAt: "2026-06-28T00:00:00.000Z"
    });

    const result = await executeProvider(registry, {
      providerId: "provider:rest:create-resource",
      capabilityId: "capability:create-resource",
      inputs: { name: "invoice" },
      executionContextId: "execution:create-resource:1"
    });

    expect(result).toEqual({
      status: "completed",
      result: {
        outputs: { resourceId: "resource:invoice" },
        evidence: ["trace:rest:create-resource"],
        compensationRef: "compensation:delete-resource"
      },
      events: [
        {
          type: "provider.execution.started",
          providerId: "provider:rest:create-resource",
          capabilityId: "capability:create-resource",
          executionContextId: "execution:create-resource:1"
        },
        {
          type: "provider.execution.completed",
          providerId: "provider:rest:create-resource",
          capabilityId: "capability:create-resource",
          executionContextId: "execution:create-resource:1"
        }
      ]
    });
  });

  it("registers multiple versions for one provider id and resolves the latest version", async () => {
    const registry = createProviderRegistry();

    registerProvider(registry, {
      manifest: {
        id: "provider:rest:create-resource",
        name: "REST Create Resource Provider",
        version: "0.1.0",
        lifecycle: "healthy",
        capabilityIds: ["capability:create-resource"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: [],
        inputSchema: [{ name: "name", type: "string", required: true }],
        outputSchema: [{ name: "version", type: "string", required: true }]
      },
      handler: async () => ({
        outputs: { version: "0.1.0" },
        evidence: ["trace:provider:v1"]
      }),
      registeredAt: "2026-06-28T00:00:00.000Z"
    });

    registerProvider(registry, {
      manifest: {
        id: "provider:rest:create-resource",
        name: "REST Create Resource Provider",
        version: "0.2.0",
        lifecycle: "healthy",
        capabilityIds: ["capability:create-resource"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: [],
        inputSchema: [{ name: "name", type: "string", required: true }],
        outputSchema: [{ name: "version", type: "string", required: true }]
      },
      handler: async () => ({
        outputs: { version: "0.2.0" },
        evidence: ["trace:provider:v2"]
      }),
      registeredAt: "2026-06-28T00:01:00.000Z"
    });

    expect(
      getProviderVersions(registry, "provider:rest:create-resource").map(
        (provider) => provider.manifest.version
      )
    ).toEqual(["0.1.0", "0.2.0"]);
    expect(
      getLatestProviderVersion(registry, "provider:rest:create-resource")?.manifest
        .version
    ).toBe("0.2.0");

    const result = await executeProvider(registry, {
      providerId: "provider:rest:create-resource",
      capabilityId: "capability:create-resource",
      inputs: { name: "invoice" },
      executionContextId: "execution:create-resource:versioned"
    });

    expect(result.status).toBe("completed");
    expect(result.result?.outputs).toEqual({ version: "0.2.0" });
  });

  it("rejects duplicate versions for the same provider id", () => {
    const registry = createProviderRegistry();
    const registration = {
      manifest: {
        id: "provider:rest:create-resource",
        name: "REST Create Resource Provider",
        version: "0.1.0",
        lifecycle: "healthy" as const,
        capabilityIds: ["capability:create-resource"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: [],
        inputSchema: [{ name: "name", type: "string" as const, required: true }],
        outputSchema: [{ name: "resourceId", type: "string" as const, required: true }]
      },
      handler: async () => ({
        outputs: { resourceId: "resource:invoice" },
        evidence: ["trace:provider:v1"]
      })
    };

    registerProvider(registry, registration);

    expect(() => registerProvider(registry, registration)).toThrow(
      "Provider version already registered: provider:rest:create-resource@0.1.0"
    );
  });

  it("blocks execution when required inputs are missing", async () => {
    const registry = createProviderRegistry();
    registerProvider(registry, {
      manifest: {
        id: "provider:rest:create-resource",
        name: "REST Create Resource Provider",
        version: "0.1.0",
        lifecycle: "healthy",
        capabilityIds: ["capability:create-resource"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: [],
        inputSchema: [{ name: "name", type: "string", required: true }],
        outputSchema: [{ name: "resourceId", type: "string", required: true }]
      },
      handler: async () => ({
        outputs: { resourceId: "resource:should-not-run" },
        evidence: []
      })
    });

    const result = await executeProvider(registry, {
      providerId: "provider:rest:create-resource",
      capabilityId: "capability:create-resource",
      inputs: {},
      executionContextId: "execution:create-resource:2"
    });

    expect(result).toMatchObject({
      status: "failed",
      error: "Missing required input: name",
      events: [
        {
          type: "provider.execution.started"
        },
        {
          type: "provider.execution.failed"
        }
      ]
    });
  });

  it("fails execution when provider output violates its manifest schema", async () => {
    const registry = createProviderRegistry();
    registerProvider(registry, {
      manifest: {
        id: "provider:rest:create-resource",
        name: "REST Create Resource Provider",
        version: "0.1.0",
        lifecycle: "healthy",
        capabilityIds: ["capability:create-resource"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: [],
        inputSchema: [{ name: "name", type: "string", required: true }],
        outputSchema: [{ name: "resourceId", type: "string", required: true }]
      },
      handler: async () => ({
        outputs: { resourceId: 123 },
        evidence: ["trace:bad-output"]
      })
    });

    const result = await executeProvider(registry, {
      providerId: "provider:rest:create-resource",
      capabilityId: "capability:create-resource",
      inputs: { name: "invoice" },
      executionContextId: "execution:create-resource:3"
    });

    expect(result).toMatchObject({
      status: "failed",
      error: "Invalid output resourceId: expected string",
      events: [
        {
          type: "provider.execution.started"
        },
        {
          type: "provider.execution.failed"
        }
      ]
    });
  });

  it("retries transient provider failures according to the manifest retry policy", async () => {
    const registry = createProviderRegistry();
    let attempts = 0;
    registerProvider(registry, {
      manifest: {
        id: "provider:rest:create-resource",
        name: "REST Create Resource Provider",
        version: "0.1.0",
        lifecycle: "healthy",
        capabilityIds: ["capability:create-resource"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: [],
        inputSchema: [{ name: "name", type: "string", required: true }],
        outputSchema: [{ name: "resourceId", type: "string", required: true }],
        retryPolicy: { maxAttempts: 2 }
      },
      handler: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("temporary network failure");
        }
        return {
          outputs: { resourceId: "resource:invoice" },
          evidence: ["trace:retry-success"]
        };
      }
    });

    const result = await executeProvider(registry, {
      providerId: "provider:rest:create-resource",
      capabilityId: "capability:create-resource",
      inputs: { name: "invoice" },
      executionContextId: "execution:create-resource:4"
    });

    expect(attempts).toBe(2);
    expect(result.status).toBe("completed");
    expect(result.events.map((event) => event.type)).toEqual([
      "provider.execution.started",
      "provider.execution.retrying",
      "provider.execution.completed"
    ]);
  });

  it("schedules exponential backoff delays between retry attempts", async () => {
    const registry = createProviderRegistry();
    const scheduledDelays: number[] = [];
    let attempts = 0;
    registerProvider(registry, {
      manifest: {
        id: "provider:rest:create-resource",
        name: "REST Create Resource Provider",
        version: "0.1.0",
        lifecycle: "healthy",
        capabilityIds: ["capability:create-resource"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: [],
        inputSchema: [{ name: "name", type: "string", required: true }],
        outputSchema: [{ name: "resourceId", type: "string", required: true }],
        retryPolicy: {
          maxAttempts: 3,
          initialDelayMs: 100,
          backoffMultiplier: 2
        }
      },
      handler: async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error(`temporary failure ${attempts}`);
        }
        return {
          outputs: { resourceId: "resource:invoice" },
          evidence: ["trace:retry-success"]
        };
      }
    });

    const result = await executeProvider(
      registry,
      {
        providerId: "provider:rest:create-resource",
        capabilityId: "capability:create-resource",
        inputs: { name: "invoice" },
        executionContextId: "execution:create-resource:scheduled-retry"
      },
      {
        scheduleDelay: async (delayMs) => {
          scheduledDelays.push(delayMs);
        }
      }
    );

    expect(attempts).toBe(3);
    expect(scheduledDelays).toEqual([100, 200]);
    expect(result.events).toMatchObject([
      { type: "provider.execution.started" },
      { type: "provider.execution.retrying", attempt: 1, delayMs: 100 },
      { type: "provider.execution.retrying", attempt: 2, delayMs: 200 },
      { type: "provider.execution.completed" }
    ]);
  });

  it("executes provider compensation hooks", async () => {
    const registry = createProviderRegistry();
    registerProvider(registry, {
      manifest: {
        id: "provider:rest:create-resource",
        name: "REST Create Resource Provider",
        version: "0.1.0",
        lifecycle: "healthy",
        capabilityIds: ["capability:create-resource"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: [],
        inputSchema: [{ name: "name", type: "string", required: true }],
        outputSchema: [{ name: "resourceId", type: "string", required: true }]
      },
      handler: async () => ({
        outputs: { resourceId: "resource:invoice" },
        evidence: ["trace:create-resource"],
        compensationRef: "resource:invoice"
      }),
      compensate: async (request) => ({
        outputs: { compensated: true, ref: request.compensationRef },
        evidence: ["trace:delete-resource"]
      })
    });

    const result = await executeProvider(registry, {
      providerId: "provider:rest:create-resource",
      capabilityId: "capability:create-resource",
      inputs: { name: "invoice" },
      executionContextId: "execution:create-resource:5",
      compensationRef: "resource:invoice"
    });

    expect(result.status).toBe("compensated");
    expect(result.result).toEqual({
      outputs: { compensated: true, ref: "resource:invoice" },
      evidence: ["trace:delete-resource"]
    });
    expect(result.events.map((event) => event.type)).toEqual([
      "provider.compensation.started",
      "provider.compensation.completed"
    ]);
  });
});
