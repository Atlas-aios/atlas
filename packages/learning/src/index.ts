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

export interface CreateLearningGovernanceReviewInput {
  subjectId: string;
  reviewItems: LearningReviewItem[];
  benchmarkPassed: boolean;
  evidenceRefs: string[];
}

export interface LearningGovernanceReview {
  reports: LearningReport[];
  promotionReady: boolean;
  blockedReasons: string[];
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
  headers?: Record<string, string>;
  body: Record<string, unknown>;
}

export interface UnknownBusinessRestResponse {
  status: number;
  body:
    | UnknownBusinessFolio
    | UnknownBusinessSettlement
    | UnknownBusinessWorkPacket
    | UnknownBusinessAuthError;
}

export interface UnknownBusinessAuthError {
  error: "unauthorized";
  requiredAuth: "bearer";
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

export interface UnknownBusinessSystemRestFixtureOptions {
  authToken?: string;
}

export interface UnknownBusinessBrowserCreateResourceInput {
  folioName: string;
  amount: number;
}

export interface UnknownBusinessBrowserUiResult {
  evidence: string[];
  snapshot: UnknownBusinessSystemSnapshot;
}

export interface UnknownBusinessBrowserUiFixture {
  render(): string;
  submitCreateResource(
    input: UnknownBusinessBrowserCreateResourceInput
  ): Promise<UnknownBusinessBrowserUiResult>;
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

export function createLearningGovernanceReview(
  input: CreateLearningGovernanceReviewInput
): LearningGovernanceReview {
  const hasHighSeverity = input.reviewItems.some((item) => item.severity === "high");
  const blockedReasons = [
    ...(hasHighSeverity ? ["high_severity_review_items"] : []),
    ...(input.benchmarkPassed ? [] : ["benchmark_not_passed"])
  ];
  const requiresGovernanceReview = blockedReasons.length > 0;

  return {
    reports: [
      createCriticReport(input, requiresGovernanceReview),
      createDefenderReport(input, requiresGovernanceReview),
      createJudgeReport(input, requiresGovernanceReview)
    ],
    promotionReady: blockedReasons.length === 0,
    blockedReasons
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

export function createUnknownBusinessSystemRestFixture(
  options: UnknownBusinessSystemRestFixtureOptions = {}
): UnknownBusinessSystemRestFixture {
  const state: UnknownBusinessSystemSnapshot = {
    folios: [],
    settlements: [],
    workPackets: []
  };

  return {
    handle: async (request) => {
      if (!isAuthorized(options, request)) {
        return unauthorizedResponse();
      }

      return handleUnknownBusinessRequest(state, request);
    },
    snapshot: () => ({
      folios: [...state.folios],
      settlements: [...state.settlements],
      workPackets: [...state.workPackets]
    })
  };
}

export function createUnknownBusinessBrowserUiFixture(): UnknownBusinessBrowserUiFixture {
  const restFixture = createUnknownBusinessSystemRestFixture();

  return {
    render: renderUnknownBusinessBrowserUi,
    submitCreateResource: async (input) => {
      await restFixture.handle({
        method: "POST",
        path: "/folios",
        body: { name: input.folioName }
      });
      await restFixture.handle({
        method: "POST",
        path: "/settlements/allocate",
        body: { folioId: "folio:1", amount: input.amount }
      });
      await restFixture.handle({
        method: "POST",
        path: "/work-packets/dispatch",
        body: { folioId: "folio:1", settlementId: "settlement:1" }
      });

      return {
        evidence: [
          "fixture:browser:submit create-resource",
          "fixture:rest:POST /folios",
          "fixture:rest:POST /settlements/allocate",
          "fixture:rest:POST /work-packets/dispatch"
        ],
        snapshot: restFixture.snapshot()
      };
    }
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

function renderUnknownBusinessBrowserUi(): string {
  return `
<main data-atlas-fixture="unknown-business-system" data-atlas-scenario="Create Resource">
  <section data-atlas-entity="folio">
    <h1>Folio Console</h1>
    <form data-atlas-capability="capability:create-folio" data-atlas-operation="createFolio">
      <label for="folio-name">Folio name</label>
      <input id="folio-name" name="name" data-atlas-field="folio.name" />
      <button type="submit" data-atlas-action="submit">Create folio</button>
    </form>
  </section>
  <section data-atlas-entity="settlement">
    <h2>Settlement Allocation</h2>
    <form data-atlas-capability="capability:allocate-settlement" data-atlas-operation="allocateSettlement">
      <input name="folioId" data-atlas-field="settlement.folioId" />
      <input name="amount" data-atlas-field="settlement.amount" />
      <button type="submit" data-atlas-action="submit">Allocate settlement</button>
    </form>
  </section>
  <section data-atlas-entity="work-packet">
    <h2>Work Packet Dispatch</h2>
    <form data-atlas-capability="capability:dispatch-work-packet" data-atlas-operation="dispatchWorkPacket">
      <input name="folioId" data-atlas-field="workPacket.folioId" />
      <input name="settlementId" data-atlas-field="workPacket.settlementId" />
      <button type="submit" data-atlas-action="submit">Dispatch work packet</button>
    </form>
  </section>
</main>`.trim();
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

function createCriticReport(
  input: CreateLearningGovernanceReviewInput,
  requiresGovernanceReview: boolean
): LearningReport {
  return {
    id: learningReportId("critic", input.subjectId),
    kind: "critic",
    subjectId: input.subjectId,
    findings: [
      ...input.reviewItems.map(
        (item) =>
          `${item.subjectId} (${item.subjectType}) requires review: ${item.reason}`
      ),
      ...(input.benchmarkPassed ? [] : ["Benchmark evidence has not passed yet."])
    ],
    recommendedChanges: uniqueStrings([
      ...input.reviewItems.map((item) => item.requiredAction),
      ...(input.benchmarkPassed
        ? []
        : ["Add or rerun benchmark evidence before promotion."])
    ]),
    requiresGovernanceReview
  };
}

function createDefenderReport(
  input: CreateLearningGovernanceReviewInput,
  requiresGovernanceReview: boolean
): LearningReport {
  const highSeverityItems = input.reviewItems.filter(
    (item) => item.severity === "high"
  );

  return {
    id: learningReportId("defender", input.subjectId),
    kind: "defender",
    subjectId: input.subjectId,
    findings: [
      ...highSeverityItems.map(
        (item) => `High severity review item: ${item.subjectId}.`
      ),
      `Evidence refs: ${input.evidenceRefs.join(", ")}.`
    ],
    recommendedChanges:
      highSeverityItems.length === 0
        ? ["Allow promotion after benchmark evidence is verified."]
        : [
            "Keep high-severity outputs in draft until simulation and approval evidence exist."
          ],
    requiresGovernanceReview
  };
}

function createJudgeReport(
  input: CreateLearningGovernanceReviewInput,
  requiresGovernanceReview: boolean
): LearningReport {
  const highSeverityItems = input.reviewItems.filter(
    (item) => item.severity === "high"
  );

  return {
    id: learningReportId("judge", input.subjectId),
    kind: "judge",
    subjectId: input.subjectId,
    findings: [
      `${input.reviewItems.length} review items remain.`,
      input.benchmarkPassed
        ? "Benchmark evidence passed."
        : "Benchmark failed or has not been run."
    ],
    recommendedChanges: [
      ...(highSeverityItems.length === 0
        ? []
        : ["Block promotion until all high-severity review items are resolved."]),
      ...(input.benchmarkPassed
        ? []
        : ["Block promotion until benchmark evidence passes."])
    ],
    requiresGovernanceReview
  };
}

function learningReportId(kind: LearningReportKind, subjectId: string): string {
  return `learning-report:${kind}:${subjectId}`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
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

function isAuthorized(
  options: UnknownBusinessSystemRestFixtureOptions,
  request: UnknownBusinessRestRequest
): boolean {
  if (options.authToken === undefined) {
    return true;
  }

  return request.headers?.authorization === `Bearer ${options.authToken}`;
}

function unauthorizedResponse(): UnknownBusinessRestResponse {
  return {
    status: 401,
    body: {
      error: "unauthorized",
      requiredAuth: "bearer"
    }
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
