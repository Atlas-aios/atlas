import { describe, expect, it } from "vitest";

import {
  createUnknownBusinessSystemOpenApiFixture,
  learnOpenApiCapabilities
} from "./index.js";

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

  it("adds confidence ladder assessments and review items for low-confidence outputs", () => {
    const result = learnOpenApiCapabilities({
      graphId: "capability-graph:unknown-api",
      generatedAt: "2026-07-16T16:05:00.000Z",
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
            get: {
              operationId: "listInvoices",
              summary: "List invoices"
            }
          }
        }
      }
    });

    expect(result.confidenceAssessments).toEqual([
      {
        subjectId: "capability:list-invoices",
        subjectType: "capability",
        score: 0.74,
        band: "review_required",
        reason: "Confidence is below evidence-ready threshold."
      },
      {
        subjectId: "provider:openapi:list-invoices",
        subjectType: "provider",
        score: 0.62,
        band: "draft_unverified",
        reason: "Generated OpenAPI provider requires validation before execution."
      }
    ]);
    expect(result.reviewItems).toEqual([
      {
        id: "review:capability:list-invoices",
        subjectId: "capability:list-invoices",
        subjectType: "capability",
        severity: "medium",
        reason: "Confidence is below evidence-ready threshold.",
        requiredAction: "Review source evidence and add tests or benchmark traces."
      },
      {
        id: "review:provider:openapi:list-invoices",
        subjectId: "provider:openapi:list-invoices",
        subjectType: "provider",
        severity: "high",
        reason: "Generated OpenAPI provider requires validation before execution.",
        requiredAction: "Simulate provider execution and require approval before use."
      }
    ]);
  });

  it("learns a synthetic unknown business system from its OpenAPI fixture", () => {
    const fixture = createUnknownBusinessSystemOpenApiFixture();

    const result = learnOpenApiCapabilities({
      graphId: fixture.graphId,
      generatedAt: "2026-07-16T16:10:00.000Z",
      providerVersion: "0.1.0",
      defaultEstimatedCost: 0.05,
      defaultEstimatedLatencyMs: 900,
      document: fixture.document
    });

    expect(fixture.domainModel).toEqual({
      entities: ["folio", "settlement", "work packet"],
      unknownTerms: ["folio", "settlement", "work packet"],
      primaryScenario: "Create Resource"
    });
    expect(result.graph.nodes.map((node) => node.id)).toEqual([
      "capability:create-folio",
      "capability:allocate-settlement",
      "capability:dispatch-work-packet"
    ]);
    expect(result.providerManifests.map((manifest) => manifest.id)).toEqual([
      "provider:openapi:create-folio",
      "provider:openapi:allocate-settlement",
      "provider:openapi:dispatch-work-packet"
    ]);
    expect(result.providerCandidates).toHaveLength(3);
    expect(result.reviewItems.map((item) => item.subjectType)).toContain("provider");
  });
});
