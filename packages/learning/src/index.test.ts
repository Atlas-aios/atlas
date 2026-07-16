import { describe, expect, it } from "vitest";

import {
  createUnknownBusinessCreateResourceBenchmark,
  createUnknownBusinessBrowserUiFixture,
  createUnknownBusinessSystemRestFixture,
  createUnknownBusinessSystemOpenApiFixture,
  createLearningGovernanceReview,
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

  it("creates critic, defender, and judge reports for self-improvement review", () => {
    const learning = learnOpenApiCapabilities({
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

    expect(
      createLearningGovernanceReview({
        subjectId: "learning:unknown-api",
        reviewItems: learning.reviewItems,
        benchmarkPassed: false,
        evidenceRefs: ["openapi:GET /invoices"]
      })
    ).toEqual({
      reports: [
        {
          id: "learning-report:critic:learning:unknown-api",
          kind: "critic",
          subjectId: "learning:unknown-api",
          findings: [
            "capability:list-invoices (capability) requires review: Confidence is below evidence-ready threshold.",
            "provider:openapi:list-invoices (provider) requires review: Generated OpenAPI provider requires validation before execution.",
            "Benchmark evidence has not passed yet."
          ],
          recommendedChanges: [
            "Review source evidence and add tests or benchmark traces.",
            "Simulate provider execution and require approval before use.",
            "Add or rerun benchmark evidence before promotion."
          ],
          requiresGovernanceReview: true
        },
        {
          id: "learning-report:defender:learning:unknown-api",
          kind: "defender",
          subjectId: "learning:unknown-api",
          findings: [
            "High severity review item: provider:openapi:list-invoices.",
            "Evidence refs: openapi:GET /invoices."
          ],
          recommendedChanges: [
            "Keep high-severity outputs in draft until simulation and approval evidence exist."
          ],
          requiresGovernanceReview: true
        },
        {
          id: "learning-report:judge:learning:unknown-api",
          kind: "judge",
          subjectId: "learning:unknown-api",
          findings: ["2 review items remain.", "Benchmark failed or has not been run."],
          recommendedChanges: [
            "Block promotion until all high-severity review items are resolved.",
            "Block promotion until benchmark evidence passes."
          ],
          requiresGovernanceReview: true
        }
      ],
      promotionReady: false,
      blockedReasons: ["high_severity_review_items", "benchmark_not_passed"]
    });
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

  it("executes the synthetic unknown business REST fixture in memory", async () => {
    const fixture = createUnknownBusinessSystemRestFixture();

    const createFolio = await fixture.handle({
      method: "POST",
      path: "/folios",
      body: { name: "Quarterly close" }
    });
    const allocateSettlement = await fixture.handle({
      method: "POST",
      path: "/settlements/allocate",
      body: {
        folioId: "folio:1",
        amount: 1250
      }
    });
    const dispatchWorkPacket = await fixture.handle({
      method: "POST",
      path: "/work-packets/dispatch",
      body: {
        folioId: "folio:1",
        settlementId: "settlement:1"
      }
    });

    expect(createFolio).toEqual({
      status: 201,
      body: {
        id: "folio:1",
        name: "Quarterly close",
        state: "open"
      }
    });
    expect(allocateSettlement).toEqual({
      status: 201,
      body: {
        id: "settlement:1",
        folioId: "folio:1",
        amount: 1250,
        state: "allocated"
      }
    });
    expect(dispatchWorkPacket).toEqual({
      status: 201,
      body: {
        id: "work-packet:1",
        folioId: "folio:1",
        settlementId: "settlement:1",
        state: "dispatched"
      }
    });
    expect(fixture.snapshot()).toEqual({
      folios: [
        {
          id: "folio:1",
          name: "Quarterly close",
          state: "open"
        }
      ],
      settlements: [
        {
          id: "settlement:1",
          folioId: "folio:1",
          amount: 1250,
          state: "allocated"
        }
      ],
      workPackets: [
        {
          id: "work-packet:1",
          folioId: "folio:1",
          settlementId: "settlement:1",
          state: "dispatched"
        }
      ]
    });
  });

  it("requires fixture authentication for protected REST operations", async () => {
    const fixture = createUnknownBusinessSystemRestFixture({
      authToken: "fixture-token"
    });

    expect(
      await fixture.handle({
        method: "POST",
        path: "/folios",
        body: { name: "Quarterly close" }
      })
    ).toEqual({
      status: 401,
      body: {
        error: "unauthorized",
        requiredAuth: "bearer"
      }
    });

    expect(
      await fixture.handle({
        method: "POST",
        path: "/folios",
        headers: { authorization: "Bearer fixture-token" },
        body: { name: "Quarterly close" }
      })
    ).toEqual({
      status: 201,
      body: {
        id: "folio:1",
        name: "Quarterly close",
        state: "open"
      }
    });
  });

  it("runs the Create Resource benchmark scenario against the fixture", async () => {
    const benchmark = createUnknownBusinessCreateResourceBenchmark();

    const result = await benchmark.run();

    expect(result).toEqual({
      id: "benchmark:unknown-business:create-resource",
      scenario: "Create Resource",
      passed: true,
      evidence: [
        "fixture:rest:POST /folios",
        "fixture:rest:POST /settlements/allocate",
        "fixture:rest:POST /work-packets/dispatch"
      ],
      expectedSnapshot: {
        folios: [
          {
            id: "folio:1",
            name: "Benchmark folio",
            state: "open"
          }
        ],
        settlements: [
          {
            id: "settlement:1",
            folioId: "folio:1",
            amount: 1000,
            state: "allocated"
          }
        ],
        workPackets: [
          {
            id: "work-packet:1",
            folioId: "folio:1",
            settlementId: "settlement:1",
            state: "dispatched"
          }
        ]
      },
      actualSnapshot: {
        folios: [
          {
            id: "folio:1",
            name: "Benchmark folio",
            state: "open"
          }
        ],
        settlements: [
          {
            id: "settlement:1",
            folioId: "folio:1",
            amount: 1000,
            state: "allocated"
          }
        ],
        workPackets: [
          {
            id: "work-packet:1",
            folioId: "folio:1",
            settlementId: "settlement:1",
            state: "dispatched"
          }
        ]
      }
    });
  });

  it("exposes a browser UI fixture for the unknown business workflow", async () => {
    const fixture = createUnknownBusinessBrowserUiFixture();

    expect(fixture.render()).toContain('data-atlas-fixture="unknown-business-system"');
    expect(fixture.render()).toContain(
      'data-atlas-capability="capability:create-folio"'
    );
    expect(fixture.render()).toContain(
      'data-atlas-capability="capability:allocate-settlement"'
    );
    expect(fixture.render()).toContain(
      'data-atlas-capability="capability:dispatch-work-packet"'
    );

    const result = await fixture.submitCreateResource({
      folioName: "Browser folio",
      amount: 900
    });

    expect(result).toEqual({
      evidence: [
        "fixture:browser:submit create-resource",
        "fixture:rest:POST /folios",
        "fixture:rest:POST /settlements/allocate",
        "fixture:rest:POST /work-packets/dispatch"
      ],
      snapshot: {
        folios: [
          {
            id: "folio:1",
            name: "Browser folio",
            state: "open"
          }
        ],
        settlements: [
          {
            id: "settlement:1",
            folioId: "folio:1",
            amount: 900,
            state: "allocated"
          }
        ],
        workPackets: [
          {
            id: "work-packet:1",
            folioId: "folio:1",
            settlementId: "settlement:1",
            state: "dispatched"
          }
        ]
      }
    });
  });
});
