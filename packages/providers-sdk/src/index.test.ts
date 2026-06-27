import { describe, expect, it } from "vitest";

import { createProviderRegistry, executeProvider, registerProvider } from "./index.js";

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
});
