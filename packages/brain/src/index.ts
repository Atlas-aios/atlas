import {
  lookupExperienceArtifacts,
  type ExperienceLookupQuery,
  type ExperienceArtifact
} from "@atlas-aios/experience";

export interface PlanningContext {
  goalId: string;
  worldStateSnapshotId: string;
  availableCapabilityGraphId: string;
  governancePolicySetId: string;
}

export interface PlanStep {
  id: string;
  capabilityId: string;
  purpose: string;
  requiresApproval: boolean;
}

export interface AtlasPlan {
  id: string;
  goalId: string;
  rationale: string;
  risks: string[];
  steps: PlanStep[];
}

export interface BrainEngine {
  plan(context: PlanningContext): Promise<AtlasPlan>;
}

export interface PlanningExperienceLookupInput {
  artifacts: ExperienceArtifact[];
  goalId: string;
  capabilityIds: string[];
  minimumConfidence?: number;
}

export interface PlanningExperienceGuidance {
  capabilityId: string;
  artifacts: ExperienceArtifact[];
}

export interface PlanningExperienceLookupResult {
  goalId: string;
  guidance: PlanningExperienceGuidance[];
}

export function lookupPlanningExperience(
  input: PlanningExperienceLookupInput
): PlanningExperienceLookupResult {
  return {
    goalId: input.goalId,
    guidance: input.capabilityIds
      .map((capabilityId) => ({
        capabilityId,
        artifacts: lookupExperienceArtifacts({
          artifacts: input.artifacts,
          query: createPlanningExperienceQuery(input, capabilityId)
        })
      }))
      .filter((guidance) => guidance.artifacts.length > 0)
  };
}

function createPlanningExperienceQuery(
  input: PlanningExperienceLookupInput,
  capabilityId: string
): ExperienceLookupQuery {
  return {
    artifactTypes: [
      "heuristic",
      "playbook",
      "anti_pattern",
      "decision_pattern",
      "risk_pattern"
    ],
    applicability: [capabilityId],
    ...(input.minimumConfidence === undefined
      ? {}
      : { minimumConfidence: input.minimumConfidence })
  };
}
