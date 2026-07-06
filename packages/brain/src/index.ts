import {
  routeModelRequest,
  type ModelRoutingDecision,
  type ModelRoutingRequest
} from "@atlas-aios/core";
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

export type PlanningModelSelectionInput = ModelRoutingRequest;
export type PlanningModelSelection = ModelRoutingDecision;

export interface PlanExplanationInput {
  plan: AtlasPlan;
  modelSelection: PlanningModelSelection;
}

export interface PlanExplanation {
  planId: string;
  goalId: string;
  summary: string;
  rationale: string;
  riskSummary: string[];
  approvalStepIds: string[];
  modelLane: PlanningModelSelection["lane"];
  modelProfileId: string;
  guardrails: string[];
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

export function selectPlanningModel(
  input: PlanningModelSelectionInput
): PlanningModelSelection {
  return routeModelRequest(input);
}

export function explainPlan(input: PlanExplanationInput): PlanExplanation {
  const approvalStepIds = input.plan.steps
    .filter((step) => step.requiresApproval)
    .map((step) => step.id);

  return {
    planId: input.plan.id,
    goalId: input.plan.goalId,
    summary: `Plan ${input.plan.id} for goal ${input.plan.goalId} has ${input.plan.steps.length} steps and ${approvalStepIds.length} approval gate${approvalStepIds.length === 1 ? "" : "s"}.`,
    rationale: input.plan.rationale,
    riskSummary: input.plan.risks,
    approvalStepIds,
    modelLane: input.modelSelection.lane,
    modelProfileId: input.modelSelection.selectedProfileId,
    guardrails: input.modelSelection.guardrails
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
