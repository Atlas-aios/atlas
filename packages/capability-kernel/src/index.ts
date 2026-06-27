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
}

export interface CapabilityResolution {
  selectedProviderId: string;
  candidates: ProviderCandidate[];
  approvalRequired: boolean;
  rationale: string;
}

export interface CapabilityKernel {
  resolve(request: CapabilityResolutionRequest): Promise<CapabilityResolution>;
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

export interface RankedProviderCandidate extends ProviderCandidate {
  adjustedConfidence: number;
  adjustedRiskScore: number;
  experienceAdjustment: number;
  rankingScore: number;
  experienceArtifactIds: string[];
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

      return {
        ...candidate,
        adjustedConfidence,
        adjustedRiskScore,
        experienceAdjustment,
        rankingScore: roundScore(adjustedConfidence - adjustedRiskScore),
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

function clampScore(value: number): number {
  return roundScore(Math.min(1, Math.max(0, value)));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
