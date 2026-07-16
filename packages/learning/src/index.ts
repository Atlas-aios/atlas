import {
  createProviderCandidatesFromManifests,
  type ProviderCandidate
} from "@atlas-aios/capability-kernel";
import {
  ingestOpenApiDocument,
  type IngestOpenApiDocumentResult,
  type OpenApiDocument
} from "@atlas-aios/interface-drivers";
import {
  createOpenApiProviderManifests,
  type CapabilityProviderManifest
} from "@atlas-aios/providers-sdk";

export type LearningReportKind = "critic" | "defender" | "judge" | "reward";

export interface LearningReport {
  id: string;
  kind: LearningReportKind;
  subjectId: string;
  findings: string[];
  recommendedChanges: string[];
  requiresGovernanceReview: boolean;
}

export interface LearnOpenApiCapabilitiesInput {
  graphId: string;
  generatedAt: string;
  providerVersion: string;
  defaultEstimatedCost: number;
  defaultEstimatedLatencyMs: number;
  document: OpenApiDocument;
}

export interface LearnOpenApiCapabilitiesResult extends IngestOpenApiDocumentResult {
  providerManifests: CapabilityProviderManifest[];
  providerCandidates: ProviderCandidate[];
  confidenceAssessments: ConfidenceAssessment[];
  reviewItems: LearningReviewItem[];
}

export type ConfidenceSubjectType = "capability" | "provider";
export type ConfidenceBand =
  | "draft_unverified"
  | "review_required"
  | "evidence_ready"
  | "promotion_candidate";

export interface ConfidenceAssessment {
  subjectId: string;
  subjectType: ConfidenceSubjectType;
  score: number;
  band: ConfidenceBand;
  reason: string;
}

export type ReviewSeverity = "low" | "medium" | "high";

export interface LearningReviewItem {
  id: string;
  subjectId: string;
  subjectType: ConfidenceSubjectType;
  severity: ReviewSeverity;
  reason: string;
  requiredAction: string;
}

export interface UnknownBusinessSystemDomainModel {
  entities: string[];
  unknownTerms: string[];
  primaryScenario: "Create Resource";
}

export interface UnknownBusinessSystemOpenApiFixture {
  graphId: string;
  domainModel: UnknownBusinessSystemDomainModel;
  document: OpenApiDocument;
}

export interface UnknownBusinessRestRequest {
  method: "POST";
  path: "/folios" | "/settlements/allocate" | "/work-packets/dispatch";
  body: Record<string, unknown>;
}

export interface UnknownBusinessRestResponse {
  status: number;
  body: UnknownBusinessFolio | UnknownBusinessSettlement | UnknownBusinessWorkPacket;
}

export interface UnknownBusinessFolio {
  id: string;
  name: string;
  state: "open";
}

export interface UnknownBusinessSettlement {
  id: string;
  folioId: string;
  amount: number;
  state: "allocated";
}

export interface UnknownBusinessWorkPacket {
  id: string;
  folioId: string;
  settlementId: string;
  state: "dispatched";
}

export interface UnknownBusinessSystemSnapshot {
  folios: UnknownBusinessFolio[];
  settlements: UnknownBusinessSettlement[];
  workPackets: UnknownBusinessWorkPacket[];
}

export interface UnknownBusinessSystemRestFixture {
  handle(request: UnknownBusinessRestRequest): Promise<UnknownBusinessRestResponse>;
  snapshot(): UnknownBusinessSystemSnapshot;
}

export interface UnknownBusinessBenchmarkResult {
  id: string;
  scenario: "Create Resource";
  passed: boolean;
  evidence: string[];
  expectedSnapshot: UnknownBusinessSystemSnapshot;
  actualSnapshot: UnknownBusinessSystemSnapshot;
}

export interface UnknownBusinessBenchmark {
  run(): Promise<UnknownBusinessBenchmarkResult>;
}

export function learnOpenApiCapabilities(
  input: LearnOpenApiCapabilitiesInput
): LearnOpenApiCapabilitiesResult {
  const ingestion = ingestOpenApiDocument({
    graphId: input.graphId,
    generatedAt: input.generatedAt,
    document: input.document
  });
  const providerManifests = createOpenApiProviderManifests({
    version: input.providerVersion,
    sourceGraphId: ingestion.graph.id,
    mappings: ingestion.driverMappings
  });
  const providerCandidates = createProviderCandidatesFromManifests({
    manifests: providerManifests,
    defaultEstimatedCost: input.defaultEstimatedCost,
    defaultEstimatedLatencyMs: input.defaultEstimatedLatencyMs
  });
  const confidenceAssessments = [
    ...ingestion.graph.nodes.map((node) =>
      assessCapabilityConfidence(node.id, node.confidence)
    ),
    ...providerCandidates.map((candidate) =>
      assessProviderConfidence(candidate.providerId, candidate.confidence)
    )
  ];

  return {
    ...ingestion,
    providerManifests,
    providerCandidates,
    confidenceAssessments,
    reviewItems: confidenceAssessments.flatMap(reviewItemForAssessment)
  };
}

export function createUnknownBusinessSystemOpenApiFixture(): UnknownBusinessSystemOpenApiFixture {
  return {
    graphId: "capability-graph:unknown-business-system",
    domainModel: {
      entities: ["folio", "settlement", "work packet"],
      unknownTerms: ["folio", "settlement", "work packet"],
      primaryScenario: "Create Resource"
    },
    document: {
      openapi: "3.1.0",
      info: {
        title: "Unknown Business System API",
        version: "0.1.0"
      },
      paths: {
        "/folios": {
          post: {
            operationId: "createFolio",
            summary: "Create folio",
            description: "Creates a folio resource in the unknown business system."
          }
        },
        "/settlements/allocate": {
          post: {
            operationId: "allocateSettlement",
            summary: "Allocate settlement",
            description: "Allocates a settlement against a folio or work packet."
          }
        },
        "/work-packets/dispatch": {
          post: {
            operationId: "dispatchWorkPacket",
            summary: "Dispatch work packet",
            description: "Dispatches a work packet for downstream handling."
          }
        }
      }
    }
  };
}

export function createUnknownBusinessSystemRestFixture(): UnknownBusinessSystemRestFixture {
  const state: UnknownBusinessSystemSnapshot = {
    folios: [],
    settlements: [],
    workPackets: []
  };

  return {
    handle: async (request) => handleUnknownBusinessRequest(state, request),
    snapshot: () => ({
      folios: [...state.folios],
      settlements: [...state.settlements],
      workPackets: [...state.workPackets]
    })
  };
}

export function createUnknownBusinessCreateResourceBenchmark(): UnknownBusinessBenchmark {
  return {
    run: async () => {
      const fixture = createUnknownBusinessSystemRestFixture();
      await fixture.handle({
        method: "POST",
        path: "/folios",
        body: { name: "Benchmark folio" }
      });
      await fixture.handle({
        method: "POST",
        path: "/settlements/allocate",
        body: { folioId: "folio:1", amount: 1000 }
      });
      await fixture.handle({
        method: "POST",
        path: "/work-packets/dispatch",
        body: { folioId: "folio:1", settlementId: "settlement:1" }
      });

      const expectedSnapshot = createResourceBenchmarkExpectedSnapshot();
      const actualSnapshot = fixture.snapshot();

      return {
        id: "benchmark:unknown-business:create-resource",
        scenario: "Create Resource",
        passed: snapshotsEqual(actualSnapshot, expectedSnapshot),
        evidence: [
          "fixture:rest:POST /folios",
          "fixture:rest:POST /settlements/allocate",
          "fixture:rest:POST /work-packets/dispatch"
        ],
        expectedSnapshot,
        actualSnapshot
      };
    }
  };
}

function assessCapabilityConfidence(
  capabilityId: string,
  score: number
): ConfidenceAssessment {
  return {
    subjectId: capabilityId,
    subjectType: "capability",
    score,
    band: confidenceBand(score),
    reason:
      score < 0.8
        ? "Confidence is below evidence-ready threshold."
        : "Capability has enough interface evidence for benchmark validation."
  };
}

function handleUnknownBusinessRequest(
  state: UnknownBusinessSystemSnapshot,
  request: UnknownBusinessRestRequest
): UnknownBusinessRestResponse {
  switch (request.path) {
    case "/folios":
      return createFolio(state, request.body);
    case "/settlements/allocate":
      return allocateSettlement(state, request.body);
    case "/work-packets/dispatch":
      return dispatchWorkPacket(state, request.body);
  }
}

function createFolio(
  state: UnknownBusinessSystemSnapshot,
  body: Record<string, unknown>
): UnknownBusinessRestResponse {
  const folio: UnknownBusinessFolio = {
    id: `folio:${state.folios.length + 1}`,
    name: String(body.name),
    state: "open"
  };
  state.folios.push(folio);

  return {
    status: 201,
    body: folio
  };
}

function allocateSettlement(
  state: UnknownBusinessSystemSnapshot,
  body: Record<string, unknown>
): UnknownBusinessRestResponse {
  const settlement: UnknownBusinessSettlement = {
    id: `settlement:${state.settlements.length + 1}`,
    folioId: String(body.folioId),
    amount: Number(body.amount),
    state: "allocated"
  };
  state.settlements.push(settlement);

  return {
    status: 201,
    body: settlement
  };
}

function dispatchWorkPacket(
  state: UnknownBusinessSystemSnapshot,
  body: Record<string, unknown>
): UnknownBusinessRestResponse {
  const workPacket: UnknownBusinessWorkPacket = {
    id: `work-packet:${state.workPackets.length + 1}`,
    folioId: String(body.folioId),
    settlementId: String(body.settlementId),
    state: "dispatched"
  };
  state.workPackets.push(workPacket);

  return {
    status: 201,
    body: workPacket
  };
}

function createResourceBenchmarkExpectedSnapshot(): UnknownBusinessSystemSnapshot {
  return {
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
  };
}

function snapshotsEqual(
  left: UnknownBusinessSystemSnapshot,
  right: UnknownBusinessSystemSnapshot
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assessProviderConfidence(
  providerId: string,
  score: number
): ConfidenceAssessment {
  return {
    subjectId: providerId,
    subjectType: "provider",
    score,
    band: confidenceBand(score),
    reason:
      score < 0.65
        ? "Generated OpenAPI provider requires validation before execution."
        : "Provider requires benchmark evidence before promotion."
  };
}

function confidenceBand(score: number): ConfidenceBand {
  if (score < 0.65) {
    return "draft_unverified";
  }

  if (score < 0.8) {
    return "review_required";
  }

  if (score < 0.9) {
    return "evidence_ready";
  }

  return "promotion_candidate";
}

function reviewItemForAssessment(
  assessment: ConfidenceAssessment
): LearningReviewItem[] {
  if (
    assessment.band === "evidence_ready" ||
    assessment.band === "promotion_candidate"
  ) {
    return [];
  }

  return [
    {
      id: `review:${assessment.subjectId}`,
      subjectId: assessment.subjectId,
      subjectType: assessment.subjectType,
      severity: assessment.band === "draft_unverified" ? "high" : "medium",
      reason: assessment.reason,
      requiredAction:
        assessment.subjectType === "provider"
          ? "Simulate provider execution and require approval before use."
          : "Review source evidence and add tests or benchmark traces."
    }
  ];
}
