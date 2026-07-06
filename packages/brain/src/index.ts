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
import type { SemanticEntity, SemanticRelationship } from "@atlas-aios/swm";

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

export type ThoughtStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "blocked"
  | "resolved"
  | "discarded";
export type ThoughtKind =
  | "observation"
  | "question"
  | "hypothesis"
  | "decision"
  | "reflection"
  | "planning_note";

export interface ThoughtLifecycleModel {
  initialStatus: "draft";
  terminalStatuses: ["resolved", "discarded"];
  allowedTransitions: Record<ThoughtStatus, ThoughtStatus[]>;
}

export interface CreateThoughtInput {
  id: string;
  goalId: string;
  kind: ThoughtKind;
  summary: string;
  createdAt: string;
  sourceRefs: string[];
  modelSelection: PlanningModelSelection;
}

export interface Thought {
  id: string;
  goalId: string;
  kind: ThoughtKind;
  status: ThoughtStatus;
  summary: string;
  createdAt: string;
  sourceRefs: string[];
  modelLane: PlanningModelSelection["lane"];
  modelProfileId: string;
}

export interface ThoughtSchedulingEvent {
  id: string;
  type: "thought.scheduled" | "thought.blocked";
  thoughtId: string;
  goalId: string;
  fromStatus: ThoughtStatus;
  toStatus: "scheduled" | "blocked";
  occurredAt: string;
  blockerRefs: string[];
}

export interface ScheduleThoughtInput {
  thought: Thought;
  eventId: string;
  occurredAt: string;
  blockerRefs: string[];
}

export type ThoughtSchedulingResult =
  | {
      ok: true;
      thought: Thought;
      event: ThoughtSchedulingEvent;
    }
  | {
      ok: false;
      error: {
        code: "thought.transition.invalid";
        message: string;
      };
    };

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

export interface BrainOutputBase {
  id: string;
  goalId: string;
  blocking: boolean;
  modelLane: PlanningModelSelection["lane"];
  modelProfileId: string;
}

export interface ClarificationNeededOutput extends BrainOutputBase {
  kind: "clarification_needed";
  question: string;
  reason: string;
  requiredFor: string;
  choices: string[];
  sourceRefs: string[];
}

export interface ApprovalNeededOutput extends BrainOutputBase {
  kind: "approval_needed";
  planId: string;
  approvalStepIds: string[];
  reason: string;
  risks: string[];
  constraints: string[];
}

export type BrainStructuredOutput = ClarificationNeededOutput | ApprovalNeededOutput;

export interface CreateClarificationNeededOutputInput {
  id: string;
  goalId: string;
  question: string;
  reason: string;
  requiredFor: string;
  choices: string[];
  sourceRefs: string[];
  modelSelection: PlanningModelSelection;
}

export interface CreateApprovalNeededOutputInput {
  id: string;
  goalId: string;
  planId: string;
  approvalStepIds: string[];
  reason: string;
  risks: string[];
  constraints: string[];
  modelSelection: PlanningModelSelection;
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

export interface BrainContextItem {
  id: string;
  source: "swm";
  summary: string;
  content: string;
  confidence: number;
  relevance: number;
  estimatedTokens: number;
  permissionScope: string[];
  sourceRefs: string[];
}

export interface SwmPlanningContextLookupInput {
  entities: SemanticEntity[];
  relationships: SemanticRelationship[];
  entityIds: string[];
  relationshipTypes: string[];
  permissionScope: string[];
  minimumConfidence: number;
}

export interface SwmPlanningContextLookupResult {
  source: "swm";
  items: BrainContextItem[];
  droppedItemIds: string[];
}

export const THOUGHT_LIFECYCLE_MODEL: ThoughtLifecycleModel = {
  initialStatus: "draft",
  terminalStatuses: ["resolved", "discarded"],
  allowedTransitions: {
    draft: ["ready", "discarded"],
    ready: ["scheduled", "blocked", "resolved", "discarded"],
    scheduled: ["blocked", "resolved", "discarded"],
    blocked: ["ready", "discarded"],
    resolved: [],
    discarded: []
  }
};

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

export function lookupSwmPlanningContext(
  input: SwmPlanningContextLookupInput
): SwmPlanningContextLookupResult {
  const droppedItemIds: string[] = [];
  const entityItems = input.entities
    .filter((entity) => input.entityIds.includes(entity.id))
    .flatMap((entity): BrainContextItem[] => {
      if (!canUseSwmItem(entity, input.permissionScope, input.minimumConfidence)) {
        droppedItemIds.push(entity.id);
        return [];
      }

      return [
        {
          id: `swm-context:entity:${entity.id}`,
          source: "swm",
          summary: `${entity.type} ${entity.label}`,
          content: `Entity ${entity.id} has type ${entity.type} and label ${entity.label}.`,
          confidence: entity.confidence,
          relevance: 1,
          estimatedTokens: 24,
          permissionScope: input.permissionScope,
          sourceRefs: [entity.id, ...entity.evidenceRefs]
        }
      ];
    });

  const relationshipItems = input.relationships
    .filter((relationship) => input.relationshipTypes.includes(relationship.type))
    .flatMap((relationship): BrainContextItem[] => {
      if (relationship.confidence < input.minimumConfidence) {
        droppedItemIds.push(relationship.id);
        return [];
      }

      return [
        {
          id: `swm-context:relationship:${relationship.id}`,
          source: "swm",
          summary: `${relationship.type} relationship from ${relationship.fromEntityId} to ${relationship.toEntityId}`,
          content: `Relationship ${relationship.id} links ${relationship.fromEntityId} to ${relationship.toEntityId} as ${relationship.type}.`,
          confidence: relationship.confidence,
          relevance: 0.9,
          estimatedTokens: 32,
          permissionScope: input.permissionScope,
          sourceRefs: [relationship.id, ...relationship.evidenceRefs]
        }
      ];
    });

  return {
    source: "swm",
    items: [...entityItems, ...relationshipItems],
    droppedItemIds
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

export function createThought(input: CreateThoughtInput): Thought {
  return {
    id: input.id,
    goalId: input.goalId,
    kind: input.kind,
    status: THOUGHT_LIFECYCLE_MODEL.initialStatus,
    summary: input.summary,
    createdAt: input.createdAt,
    sourceRefs: input.sourceRefs,
    modelLane: input.modelSelection.lane,
    modelProfileId: input.modelSelection.selectedProfileId
  };
}

export function scheduleThought(input: ScheduleThoughtInput): ThoughtSchedulingResult {
  const toStatus: "scheduled" | "blocked" =
    input.blockerRefs.length > 0 ? "blocked" : "scheduled";
  const allowed =
    THOUGHT_LIFECYCLE_MODEL.allowedTransitions[input.thought.status].includes(toStatus);

  if (!allowed) {
    return {
      ok: false,
      error: {
        code: "thought.transition.invalid",
        message: `Cannot transition thought ${input.thought.id} from ${input.thought.status} to ${toStatus}.`
      }
    };
  }

  const thought = {
    ...input.thought,
    status: toStatus
  };

  return {
    ok: true,
    thought,
    event: {
      id: input.eventId,
      type: toStatus === "blocked" ? "thought.blocked" : "thought.scheduled",
      thoughtId: input.thought.id,
      goalId: input.thought.goalId,
      fromStatus: input.thought.status,
      toStatus,
      occurredAt: input.occurredAt,
      blockerRefs: input.blockerRefs
    }
  };
}

export function createClarificationNeededOutput(
  input: CreateClarificationNeededOutputInput
): ClarificationNeededOutput {
  return {
    id: input.id,
    kind: "clarification_needed",
    goalId: input.goalId,
    question: input.question,
    reason: input.reason,
    requiredFor: input.requiredFor,
    choices: input.choices,
    blocking: true,
    sourceRefs: input.sourceRefs,
    modelLane: input.modelSelection.lane,
    modelProfileId: input.modelSelection.selectedProfileId
  };
}

export function createApprovalNeededOutput(
  input: CreateApprovalNeededOutputInput
): ApprovalNeededOutput {
  return {
    id: input.id,
    kind: "approval_needed",
    goalId: input.goalId,
    planId: input.planId,
    approvalStepIds: input.approvalStepIds,
    reason: input.reason,
    risks: input.risks,
    constraints: input.constraints,
    blocking: true,
    modelLane: input.modelSelection.lane,
    modelProfileId: input.modelSelection.selectedProfileId
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

function canUseSwmItem(
  entity: SemanticEntity,
  permissionScope: string[],
  minimumConfidence: number
): boolean {
  if (entity.confidence < minimumConfidence) {
    return false;
  }

  const itemPermissionScope = entity.attributes["permissionScope"];
  if (!Array.isArray(itemPermissionScope)) {
    return true;
  }

  return itemPermissionScope.every(
    (scope) => typeof scope === "string" && permissionScope.includes(scope)
  );
}
