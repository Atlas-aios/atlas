import { describe, expect, it } from "vitest";

import { learnOpenApiCapabilities } from "./index.js";

describe("learnOpenApiCapabilities", () => {
  it("builds draft graph, driver mappings, provider manifests, and Kernel candidates from OpenAPI", () => {
    const result = learnOpenApiCapabilities({
      graphId: "capability-graph:unknown-api",
      generatedAt: "2026-07-16T16:00:00.000Z",
      providerVersion: "0.1.0",
      defaultEstimatedCost: 0.05,
      defaultEstimatedLatencyMs: 800,
      document: {
        openapi: "3.1.0",
        info: {
          title: "Unknown API",
          version: "1.0.0"
        },
        paths: {
          "/invoices": {
            post: {
              operationId: "createInvoice",
              summary: "Create invoice"
            }
          }
        }
      }
    });

    expect(result.graph.nodes).toEqual([
      {
        id: "capability:create-invoice",
        schemaVersion: "0.1",
        name: "Create invoice",
        level: "L2",
        confidence: 0.8,
        sourceRefs: ["openapi:POST /invoices"]
      }
    ]);
    expect(result.driverMappings).toEqual([
      {
        capabilityId: "capability:create-invoice",
        driverId: "driver:rest",
        operationId: "createInvoice",
        method: "POST",
        path: "/invoices",
        requiredPermissions: ["network"]
      }
    ]);
    expect(result.providerManifests).toEqual([
      {
        id: "provider:openapi:create-invoice",
        name: "OpenAPI createInvoice Provider",
        version: "0.1.0",
        lifecycle: "draft",
        capabilityIds: ["capability:create-invoice"],
        interfaceDriverIds: ["driver:rest"],
        requiredPermissions: ["network"],
        inputSchema: [{ name: "request", type: "object", required: true }],
        outputSchema: [{ name: "response", type: "object", required: true }],
        retryPolicy: { maxAttempts: 2, initialDelayMs: 100, backoffMultiplier: 2 },
        metadata: {
          providerKind: "generated_openapi",
          sourceGraphId: "capability-graph:unknown-api",
          operationId: "createInvoice",
          method: "POST",
          path: "/invoices"
        }
      }
    ]);
    expect(result.providerCandidates).toEqual([
      {
        providerId: "provider:openapi:create-invoice",
        capabilityId: "capability:create-invoice",
        confidence: 0.62,
        riskScore: 0.6,
        estimatedCost: 0.05,
        estimatedLatencyMs: 800,
        permissionFit: 0.7,
        policyRiskScore: 0.2,
        reputationScore: 0.5
      }
    ]);
  });
});
