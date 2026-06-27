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
