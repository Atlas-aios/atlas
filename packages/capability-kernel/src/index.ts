import {
  lookupExperienceArtifacts,
  type ExperienceLookupQuery,
  type ExperienceArtifact
} from "@atlas-aios/experience";

export interface CapabilityResolutionRequest {
  goalId: string;
  capabilityId: string;
  inputs: Record<string, unknown>;
  governanceContextId: string;
}

export interface ProviderCandidate {
  providerId: string;
  capabilityId: string;
  confidence: number;
  riskScore: number;
  estimatedCost: number;
  estimatedLatencyMs: number;
  permissionFit?: number;
  policyRiskScore?: number;
  reputationScore?: number;
}

export interface CapabilityResolution {
  selectedProviderId: string;
  candidates: ProviderCandidate[];
  approvalRequired: boolean;
  approvalReason?: string;
  simulationRequired: boolean;
  simulationRequirement?: string;
  rationale: string;
}

export interface CapabilityKernel {
  resolve(request: CapabilityResolutionRequest): Promise<CapabilityResolution>;
}

export interface CapabilityKernelInput {
  artifacts: ExperienceArtifact[];
  providers: ProviderCandidate[];
  minimumExperienceConfidence?: number;
  minimumRankingScore?: number;
  maxFallbacks?: number;
}

export interface ProviderExperienceLookupInput {
  artifacts: ExperienceArtifact[];
  request: CapabilityResolutionRequest;
  candidates: ProviderCandidate[];
  minimumConfidence?: number;
}

export interface ProviderExperienceGuidance {
  providerId: string;
  capabilityId: string;
  artifacts: ExperienceArtifact[];
}

export interface ProviderRankingInput {
  artifacts: ExperienceArtifact[];
  request: CapabilityResolutionRequest;
  candidates: ProviderCandidate[];
  minimumExperienceConfidence?: number;
}

export interface ProviderSelectionInput extends ProviderRankingInput {
  minimumRankingScore?: number;
  maxFallbacks?: number;
}

export interface RankedProviderCandidate extends ProviderCandidate {
  adjustedConfidence: number;
  adjustedRiskScore: number;
  experienceAdjustment: number;
  costPenalty: number;
  latencyPenalty: number;
  permissionPenalty: number;
  policyPenalty: number;
  reputationPenalty: number;
  rankingScore: number;
  experienceArtifactIds: string[];
}

export interface ProviderSelection {
  selectedProvider: RankedProviderCandidate | null;
  fallbackProviders: RankedProviderCandidate[];
  rejectedProviders: RankedProviderCandidate[];
  rankedProviders: RankedProviderCandidate[];
  rationale: string;
}

export function lookupProviderExperience(
  input: ProviderExperienceLookupInput
): ProviderExperienceGuidance[] {
  return input.candidates
    .map((candidate) => ({
      providerId: candidate.providerId,
      capabilityId: candidate.capabilityId,
      artifacts: lookupExperienceArtifacts({
        artifacts: input.artifacts,
        query: createProviderExperienceQuery(input, candidate)
      })
    }))
    .filter((guidance) => guidance.artifacts.length > 0);
}

function createProviderExperienceQuery(
  input: ProviderExperienceLookupInput,
  candidate: ProviderCandidate
): ExperienceLookupQuery {
  return {
    artifactTypes: ["decision_pattern", "risk_pattern", "anti_pattern"],
    applicability: [input.request.capabilityId, candidate.providerId],
    ...(input.minimumConfidence === undefined
      ? {}
      : { minimumConfidence: input.minimumConfidence })
  };
}

export function rankProviderCandidates(
  input: ProviderRankingInput
): RankedProviderCandidate[] {
  return input.candidates
    .map((candidate) => {
      const artifacts = lookupExperienceArtifacts({
        artifacts: input.artifacts,
        query: createRankingExperienceQuery(input, candidate)
      });
      const experienceAdjustment = roundScore(
        artifacts.reduce(
          (total, artifact) => total + scoreExperienceArtifact(artifact),
          0
        )
      );
      const adjustedConfidence = clampScore(
        candidate.confidence + experienceAdjustment
      );
      const adjustedRiskScore = clampScore(
        candidate.riskScore + riskDeltaFromArtifacts(artifacts)
      );
      const costPenalty = costPenaltyFromCandidate(candidate);
      const latencyPenalty = latencyPenaltyFromCandidate(candidate);
      const permissionPenalty = permissionPenaltyFromCandidate(candidate);
      const policyPenalty = policyPenaltyFromCandidate(candidate);
      const reputationPenalty = reputationPenaltyFromCandidate(candidate);

      return {
        ...candidate,
        adjustedConfidence,
        adjustedRiskScore,
        experienceAdjustment,
        costPenalty,
        latencyPenalty,
        permissionPenalty,
        policyPenalty,
        reputationPenalty,
        rankingScore: roundScore(
          adjustedConfidence -
            adjustedRiskScore -
            costPenalty -
            latencyPenalty -
            permissionPenalty -
            policyPenalty -
            reputationPenalty
        ),
        experienceArtifactIds: artifacts.map((artifact) => artifact.id)
      };
    })
    .sort(
      (left, right) =>
        right.rankingScore - left.rankingScore ||
        right.adjustedConfidence - left.adjustedConfidence ||
        left.estimatedCost - right.estimatedCost ||
        left.providerId.localeCompare(right.providerId)
    );
}

export function selectProviderCandidates(
  input: ProviderSelectionInput
): ProviderSelection {
  const rankedProviders = rankProviderCandidates(input);
  const minimumRankingScore = input.minimumRankingScore ?? Number.NEGATIVE_INFINITY;
  const maxFallbacks = input.maxFallbacks ?? Math.max(0, rankedProviders.length - 1);
  const eligibleProviders = rankedProviders.filter(
    (provider) => provider.rankingScore >= minimumRankingScore
  );
  const selectedProvider = eligibleProviders[0] ?? null;
  const fallbackProviders = eligibleProviders.slice(1, maxFallbacks + 1);
  const rejectedProviders = rankedProviders.filter(
    (provider) => provider.rankingScore < minimumRankingScore
  );

  return {
    selectedProvider,
    fallbackProviders,
    rejectedProviders,
    rankedProviders,
    rationale:
      selectedProvider === null
        ? "No provider met the minimum ranking score."
        : `Selected ${selectedProvider.providerId} with ${fallbackProviders.length} fallback provider${fallbackProviders.length === 1 ? "" : "s"}.`
  };
}

export function createCapabilityKernel(input: CapabilityKernelInput): CapabilityKernel {
  return {
    resolve: async (request) => {
      const candidates = lookupProviderCandidates({
        providers: input.providers,
        capabilityId: request.capabilityId
      });
      const selection = selectProviderCandidates({
        artifacts: input.artifacts,
        request,
        candidates,
        ...(input.minimumExperienceConfidence === undefined
          ? {}
          : { minimumExperienceConfidence: input.minimumExperienceConfidence }),
        ...(input.minimumRankingScore === undefined
          ? {}
          : { minimumRankingScore: input.minimumRankingScore }),
        ...(input.maxFallbacks === undefined
          ? {}
          : { maxFallbacks: input.maxFallbacks })
      });

      if (selection.selectedProvider === null) {
        throw new Error(`No provider resolved for capability: ${request.capabilityId}`);
      }

      return {
        selectedProviderId: selection.selectedProvider.providerId,
        candidates: [
          stripRankedProvider(selection.selectedProvider),
          ...selection.fallbackProviders.map(stripRankedProvider)
        ],
        ...approvalGateForProvider(selection.selectedProvider),
        ...simulationRequirementForProvider(selection.selectedProvider),
        rationale: selection.rationale
      };
    }
  };
}

export function lookupProviderCandidates(input: {
  providers: ProviderCandidate[];
  capabilityId: string;
}): ProviderCandidate[] {
  return input.providers
    .filter((provider) => provider.capabilityId === input.capabilityId)
    .map((provider) => ({ ...provider }));
}

function createRankingExperienceQuery(
  input: ProviderRankingInput,
  candidate: ProviderCandidate
): ExperienceLookupQuery {
  return {
    applicability: [input.request.capabilityId, candidate.providerId],
    ...(input.minimumExperienceConfidence === undefined
      ? {}
      : { minimumConfidence: input.minimumExperienceConfidence })
  };
}

function stripRankedProvider(provider: RankedProviderCandidate): ProviderCandidate {
  return {
    providerId: provider.providerId,
    capabilityId: provider.capabilityId,
    confidence: provider.confidence,
    riskScore: provider.riskScore,
    estimatedCost: provider.estimatedCost,
    estimatedLatencyMs: provider.estimatedLatencyMs,
    ...(provider.permissionFit === undefined
      ? {}
      : { permissionFit: provider.permissionFit }),
    ...(provider.policyRiskScore === undefined
      ? {}
      : { policyRiskScore: provider.policyRiskScore }),
    ...(provider.reputationScore === undefined
      ? {}
      : { reputationScore: provider.reputationScore })
  };
}

function approvalGateForProvider(provider: RankedProviderCandidate): {
  approvalRequired: boolean;
  approvalReason?: string;
} {
  const permissionFit = clampRawScore(provider.permissionFit ?? 1);
  const policyRiskScore = clampRawScore(provider.policyRiskScore ?? 0);

  if (permissionFit === 1 && policyRiskScore === 0) {
    return { approvalRequired: false };
  }

  return {
    approvalRequired: true,
    approvalReason:
      "Selected provider requires approval because permission fit or policy risk is not fully safe."
  };
}

function simulationRequirementForProvider(provider: RankedProviderCandidate): {
  simulationRequired: boolean;
  simulationRequirement?: string;
} {
  if (provider.adjustedRiskScore < 0.6) {
    return { simulationRequired: false };
  }

  return {
    simulationRequired: true,
    simulationRequirement:
      "Simulate selected provider execution before dispatch because adjusted risk is high."
  };
}

function scoreExperienceArtifact(artifact: ExperienceArtifact): number {
  switch (artifact.type) {
    case "decision_pattern":
      return artifact.summary.toLowerCase().includes("reject")
        ? -0.3 * artifact.confidence
        : -0.15 * artifact.confidence;
    case "risk_pattern":
      return -0.25 * artifact.confidence;
    case "anti_pattern":
      return -0.4 * artifact.confidence;
    case "playbook":
      return 0.1 * artifact.confidence;
    case "heuristic":
      return 0.05 * artifact.confidence;
  }
}

function riskDeltaFromArtifacts(artifacts: ExperienceArtifact[]): number {
  return artifacts.reduce((total, artifact) => {
    switch (artifact.type) {
      case "decision_pattern":
        return total + 0.5 * artifact.confidence;
      case "risk_pattern":
        return total + 0.4 * artifact.confidence;
      case "anti_pattern":
        return total + 0.5 * artifact.confidence;
      case "playbook":
        return total - 0.1 * artifact.confidence;
      case "heuristic":
        return total - 0.05 * artifact.confidence;
    }
  }, 0);
}

function costPenaltyFromCandidate(candidate: ProviderCandidate): number {
  return roundScore(Math.min(0.2, candidate.estimatedCost * 0.05));
}

function latencyPenaltyFromCandidate(candidate: ProviderCandidate): number {
  return roundScore(Math.min(0.2, candidate.estimatedLatencyMs / 20_000));
}

function permissionPenaltyFromCandidate(candidate: ProviderCandidate): number {
  const permissionFit = clampRawScore(candidate.permissionFit ?? 1);

  return roundScore((1 - permissionFit) * 0.4);
}

function policyPenaltyFromCandidate(candidate: ProviderCandidate): number {
  const policyRiskScore = clampRawScore(candidate.policyRiskScore ?? 0);

  return roundScore(policyRiskScore * 0.4);
}

function reputationPenaltyFromCandidate(candidate: ProviderCandidate): number {
  const reputationScore = clampRawScore(candidate.reputationScore ?? 1);

  return roundScore((1 - reputationScore) * 0.3);
}

function clampScore(value: number): number {
  return roundScore(Math.min(1, Math.max(0, value)));
}

function clampRawScore(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
