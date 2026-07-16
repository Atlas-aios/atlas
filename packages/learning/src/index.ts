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

  return {
    ...ingestion,
    providerManifests,
    providerCandidates
  };
}
