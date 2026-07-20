import type {
  CapabilityEdge,
  CapabilityGraph,
  CapabilityGraphStatus,
  CapabilityNode
} from "@atlas-aios/capability-graph";
import {
  routeModelRequest,
  type ModelRoutingDecision,
  type ModelRoutingRequest
} from "@atlas-aios/core";
import {
  lookupExperienceArtifacts,
  type ExperienceLookupQuery,
  type ExperienceArtifact,
  type ExperienceArtifactType
} from "@atlas-aios/experience";
import type { ApprovalRequirement, PolicyDecision } from "@atlas-aios/governance";
import type { IdentityResolution, IdentitySubject } from "@atlas-aios/identity";
import type { MemoryEvent, MemoryEventKind } from "@atlas-aios/memory";
import type { SelfModelSnapshot } from "@atlas-aios/self-model";
import type { SemanticEntity, SemanticRelationship } from "@atlas-aios/swm";
import type { OperationalBlocker, WorldStateSnapshot } from "@atlas-aios/world-state";

export * from "./model-runtime.js";

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
  source:
    | "swm"
    | "world-state"
    | "memory"
    | "self-model"
    | "identity"
    | "experience"
    | "capability-graph"
    | "governance";
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

export type BlockerSeverity = OperationalBlocker["severity"];

export interface WorldStatePlanningContextLookupInput {
  snapshot: WorldStateSnapshot;
  goalIds: string[];
  minimumBlockerSeverity: BlockerSeverity;
  permissionScope: string[];
}

export interface WorldStatePlanningContextLookupResult {
  source: "world-state";
  items: BrainContextItem[];
  droppedItemIds: string[];
}

export interface MemoryPlanningContextLookupInput {
  events: MemoryEvent[];
  eventKinds: MemoryEventKind[];
  sourceIds: string[];
  permissionScope: string[];
  limit: number;
}

export interface MemoryPlanningContextLookupResult {
  source: "memory";
  items: BrainContextItem[];
  droppedItemIds: string[];
}

export interface SelfModelPlanningContextLookupInput {
  snapshot: SelfModelSnapshot;
  capabilityIds: string[];
  minimumConfidence: number;
  permissionScope: string[];
}

export interface SelfModelPlanningContextLookupResult {
  source: "self-model";
  items: BrainContextItem[];
  droppedItemIds: string[];
}

export interface IdentityPlanningContextLookupInput {
  subjects: IdentitySubject[];
  resolutions: IdentityResolution[];
  subjectIds: string[];
  externalSystems: string[];
  minimumConfidence: number;
  permissionScope: string[];
}

export interface IdentityPlanningContextLookupResult {
  source: "identity";
  items: BrainContextItem[];
  droppedItemIds: string[];
}

export interface ExperiencePlanningContextLookupInput {
  artifacts: ExperienceArtifact[];
  artifactTypes: ExperienceArtifactType[];
  applicability: string[];
  minimumConfidence: number;
  permissionScope: string[];
  limit: number;
}

export interface ExperiencePlanningContextLookupResult {
  source: "experience";
  items: BrainContextItem[];
  droppedItemIds: string[];
}

export interface CapabilityGraphPlanningContextLookupInput {
  graph: CapabilityGraph;
  capabilityIds: string[];
  minimumConfidence: number;
  includeDependencyEdges: boolean;
  permissionScope: string[];
}

export interface CapabilityGraphPlanningContextLookupResult {
  source: "capability-graph";
  items: BrainContextItem[];
  droppedItemIds: string[];
}

export interface GovernancePlanningContextLookupInput {
  policyDecisions: PolicyDecision[];
  approvalRequirements: ApprovalRequirement[];
  actionIds: string[];
  includeAllowDecisions: boolean;
  permissionScope: string[];
  limit: number;
}

export interface GovernancePlanningContextLookupResult {
  source: "governance";
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

export function lookupExperiencePlanningContext(
  input: ExperiencePlanningContextLookupInput
): ExperiencePlanningContextLookupResult {
  const matchingArtifacts = lookupExperienceArtifacts({
    artifacts: input.artifacts,
    query: {
      artifactTypes: input.artifactTypes,
      applicability: input.applicability,
      minimumConfidence: input.minimumConfidence
    }
  });
  const matchingArtifactIds = new Set(matchingArtifacts.map((artifact) => artifact.id));
  const droppedItemIds = input.artifacts
    .filter((artifact) => !matchingArtifactIds.has(artifact.id))
    .map((artifact) => artifact.id);
  const items = matchingArtifacts.map(
    (artifact): BrainContextItem => ({
      id: `experience-context:artifact:${artifact.id}`,
      source: "experience",
      summary: `${artifact.type} Experience ${artifact.id}`,
      content: artifact.summary,
      confidence: artifact.confidence,
      relevance: calculateApplicabilityRelevance(
        artifact.applicability,
        input.applicability
      ),
      estimatedTokens: estimateContextTokens(artifact.summary),
      permissionScope: input.permissionScope,
      sourceRefs: [artifact.id, ...artifact.evidenceMemoryEventIds]
    })
  );
  const limitedItems = items.slice(0, input.limit);
  droppedItemIds.push(...items.slice(input.limit).map((item) => item.id));

  return {
    source: "experience",
    items: limitedItems,
    droppedItemIds
  };
}

export function lookupCapabilityGraphPlanningContext(
  input: CapabilityGraphPlanningContextLookupInput
): CapabilityGraphPlanningContextLookupResult {
  const droppedItemIds: string[] = [];
  const selectedNodes = input.graph.nodes.flatMap((node): CapabilityNode[] => {
    if (!input.capabilityIds.includes(node.id)) {
      return [];
    }

    if (node.confidence < input.minimumConfidence) {
      droppedItemIds.push(node.id);
      return [];
    }

    return [node];
  });
  const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
  const nodeItems = selectedNodes.map((node) =>
    createCapabilityNodeContextItem({
      graphId: input.graph.id,
      graphStatus: input.graph.status,
      node,
      permissionScope: input.permissionScope
    })
  );
  const edgeItems = input.includeDependencyEdges
    ? input.graph.edges.flatMap((edge): BrainContextItem[] => {
        if (!selectedNodeIds.has(edge.fromCapabilityId)) {
          return [];
        }

        return [
          createCapabilityEdgeContextItem({
            graphId: input.graph.id,
            edge,
            confidence: findCapabilityConfidence(selectedNodes, edge.fromCapabilityId),
            permissionScope: input.permissionScope
          })
        ];
      })
    : [];

  return {
    source: "capability-graph",
    items: [...nodeItems, ...edgeItems],
    droppedItemIds
  };
}

export function lookupGovernancePlanningContext(
  input: GovernancePlanningContextLookupInput
): GovernancePlanningContextLookupResult {
  const droppedItemIds: string[] = [];
  const policyItems = input.policyDecisions.flatMap(
    (decision, index): BrainContextItem[] => {
      const decisionId = createPolicyDecisionContextId(decision, index);

      if (decision.decision === "allow" && !input.includeAllowDecisions) {
        droppedItemIds.push(decisionId);
        return [];
      }

      if (
        decision.action !== undefined &&
        input.actionIds.length > 0 &&
        !input.actionIds.includes(decision.action)
      ) {
        droppedItemIds.push(decisionId);
        return [];
      }

      return [
        {
          id: decisionId,
          source: "governance",
          summary: `${decision.decision} governance decision`,
          content: `Governance decision ${decision.decision} applies from policies ${formatList(decision.policyIds)}: ${decision.reason}`,
          confidence: decision.decision === "allow" ? 0.85 : 1,
          relevance: decision.decision === "allow" ? 0.75 : 1,
          estimatedTokens: estimateContextTokens(decision.reason),
          permissionScope: input.permissionScope,
          sourceRefs: decision.policyIds
        }
      ];
    }
  );
  const approvalItems = input.approvalRequirements.flatMap(
    (requirement): BrainContextItem[] => {
      if (input.actionIds.length > 0 && !input.actionIds.includes(requirement.action)) {
        droppedItemIds.push(requirement.id);
        return [];
      }

      const content = `Action ${requirement.action} requires approval from ${requirement.requiredApproverRole}: ${requirement.reason}`;
      return [
        {
          id: `governance-context:approval:${requirement.id}`,
          source: "governance",
          summary: `Approval required for ${requirement.action}`,
          content,
          confidence: 1,
          relevance: 1,
          estimatedTokens: estimateContextTokens(content),
          permissionScope: input.permissionScope,
          sourceRefs: [requirement.id]
        }
      ];
    }
  );
  const items = [...policyItems, ...approvalItems];
  const limitedItems = items.slice(0, input.limit);
  droppedItemIds.push(...items.slice(input.limit).map((item) => item.id));

  return {
    source: "governance",
    items: limitedItems,
    droppedItemIds
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

export function lookupWorldStatePlanningContext(
  input: WorldStatePlanningContextLookupInput
): WorldStatePlanningContextLookupResult {
  const droppedItemIds: string[] = [];
  const snapshotItem: BrainContextItem = {
    id: `world-state-context:snapshot:${input.snapshot.id}`,
    source: "world-state",
    summary: `World State snapshot ${input.snapshot.id}`,
    content: `Snapshot ${input.snapshot.id} has ${input.snapshot.activeGoalIds.length} active goals and ${input.snapshot.activeExecutionIds.length} active executions.`,
    confidence: 1,
    relevance: hasAnyActiveGoal(input.snapshot, input.goalIds) ? 1 : 0.75,
    estimatedTokens: 28,
    permissionScope: input.permissionScope,
    sourceRefs: [input.snapshot.id]
  };

  const blockerItems = input.snapshot.blockers.flatMap(
    (blocker): BrainContextItem[] => {
      if (!meetsMinimumSeverity(blocker.severity, input.minimumBlockerSeverity)) {
        droppedItemIds.push(blocker.id);
        return [];
      }

      return [
        {
          id: `world-state-context:blocker:${blocker.id}`,
          source: "world-state",
          summary: `${blocker.severity} blocker: ${blocker.summary}`,
          content: `Blocker ${blocker.id} has severity ${blocker.severity} and owner ${blocker.ownerId ?? "unassigned"}.`,
          confidence: 1,
          relevance: 0.95,
          estimatedTokens: 24,
          permissionScope: input.permissionScope,
          sourceRefs: [input.snapshot.id, blocker.id]
        }
      ];
    }
  );

  return {
    source: "world-state",
    items: [snapshotItem, ...blockerItems],
    droppedItemIds
  };
}

export function lookupMemoryPlanningContext(
  input: MemoryPlanningContextLookupInput
): MemoryPlanningContextLookupResult {
  const droppedItemIds: string[] = [];
  const items = input.events.flatMap((event): BrainContextItem[] => {
    if (!input.eventKinds.includes(event.kind)) {
      droppedItemIds.push(event.id);
      return [];
    }

    const matchingSourceIds = event.sourceIds.filter((sourceId) =>
      input.sourceIds.includes(sourceId)
    );
    if (input.sourceIds.length > 0 && matchingSourceIds.length === 0) {
      droppedItemIds.push(event.id);
      return [];
    }

    return [
      {
        id: `memory-context:event:${event.id}`,
        source: "memory",
        summary: `${event.kind} memory from ${event.occurredAt}`,
        content: event.summary,
        confidence: 1,
        relevance:
          input.sourceIds.length === 0
            ? 0.8
            : matchingSourceIds.length / input.sourceIds.length,
        estimatedTokens: estimateContextTokens(event.summary),
        permissionScope: input.permissionScope,
        sourceRefs: [event.id, ...event.sourceIds]
      }
    ];
  });

  const limitedItems = items.slice(0, input.limit);
  droppedItemIds.push(...items.slice(input.limit).map((item) => item.id));

  return {
    source: "memory",
    items: limitedItems,
    droppedItemIds
  };
}

export function lookupSelfModelPlanningContext(
  input: SelfModelPlanningContextLookupInput
): SelfModelPlanningContextLookupResult {
  const droppedItemIds: string[] = [];
  const authorityItem: BrainContextItem = {
    id: `self-model-context:authority:${input.snapshot.id}`,
    source: "self-model",
    summary: `Self Model authority snapshot ${input.snapshot.id}`,
    content: `Granted authority: ${input.snapshot.grantedAuthority.join(", ")}.`,
    confidence: 1,
    relevance: 0.9,
    estimatedTokens: estimateContextTokens(input.snapshot.grantedAuthority.join(" ")),
    permissionScope: input.permissionScope,
    sourceRefs: [input.snapshot.id]
  };

  const capabilityItems = input.snapshot.capabilityConfidence.flatMap(
    (capability): BrainContextItem[] => {
      const capabilityRef = `${capability.capabilityId}:${capability.providerId}`;
      if (!input.capabilityIds.includes(capability.capabilityId)) {
        droppedItemIds.push(capabilityRef);
        return [];
      }

      if (capability.confidence < input.minimumConfidence) {
        droppedItemIds.push(capabilityRef);
        return [];
      }

      return [
        {
          id: `self-model-context:capability:${capability.capabilityId}:${capability.providerId}`,
          source: "self-model",
          summary: `Self confidence ${capability.confidence} for ${capability.capabilityId} via ${capability.providerId}`,
          content: `Known limitations: ${formatSentenceList(capability.knownLimitations)}`,
          confidence: capability.confidence,
          relevance: 1,
          estimatedTokens: estimateContextTokens(capability.knownLimitations.join(" ")),
          permissionScope: input.permissionScope,
          sourceRefs: [
            input.snapshot.id,
            capability.capabilityId,
            capability.providerId
          ]
        }
      ];
    }
  );

  return {
    source: "self-model",
    items: [authorityItem, ...capabilityItems],
    droppedItemIds
  };
}

export function lookupIdentityPlanningContext(
  input: IdentityPlanningContextLookupInput
): IdentityPlanningContextLookupResult {
  const droppedItemIds: string[] = [];
  const subjectItems = input.subjects.flatMap((subject): BrainContextItem[] => {
    if (!input.subjectIds.includes(subject.id)) {
      droppedItemIds.push(subject.id);
      return [];
    }

    if (subject.confidence < input.minimumConfidence) {
      droppedItemIds.push(subject.id);
      return [];
    }

    const content = `Identity ${subject.id} is a ${subject.kind} named ${subject.displayName} with aliases ${formatList(subject.aliases)}.`;
    return [
      {
        id: `identity-context:subject:${subject.id}`,
        source: "identity",
        summary: `${subject.kind} identity ${subject.displayName}`,
        content,
        confidence: subject.confidence,
        relevance: 1,
        estimatedTokens: estimateContextTokens(content),
        permissionScope: input.permissionScope,
        sourceRefs: [subject.id, ...subject.evidenceRefs]
      }
    ];
  });

  const resolutionItems = input.resolutions.flatMap(
    (resolution): BrainContextItem[] => {
      if (!input.subjectIds.includes(resolution.subjectId)) {
        droppedItemIds.push(resolution.id);
        return [];
      }

      if (!input.externalSystems.includes(resolution.externalSystem)) {
        droppedItemIds.push(resolution.id);
        return [];
      }

      if (resolution.confidence < input.minimumConfidence) {
        droppedItemIds.push(resolution.id);
        return [];
      }

      const content = `Subject ${resolution.subjectId} resolves to ${resolution.externalSystem} external id ${resolution.externalId}.`;
      return [
        {
          id: `identity-context:resolution:${resolution.id}`,
          source: "identity",
          summary: `${resolution.externalSystem} identity resolution for ${resolution.subjectId}`,
          content,
          confidence: resolution.confidence,
          relevance: 0.95,
          estimatedTokens: estimateContextTokens(content),
          permissionScope: input.permissionScope,
          sourceRefs: [resolution.id, resolution.subjectId, ...resolution.evidenceRefs]
        }
      ];
    }
  );

  return {
    source: "identity",
    items: [...subjectItems, ...resolutionItems],
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

function hasAnyActiveGoal(snapshot: WorldStateSnapshot, goalIds: string[]): boolean {
  return goalIds.some((goalId) => snapshot.activeGoalIds.includes(goalId));
}

function meetsMinimumSeverity(
  actual: BlockerSeverity,
  minimum: BlockerSeverity
): boolean {
  const order: Record<BlockerSeverity, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  };

  return order[actual] >= order[minimum];
}

function estimateContextTokens(content: string): number {
  return Math.max(12, Math.ceil(content.trim().split(/\s+/).length * 1.5));
}

function formatSentenceList(items: string[]): string {
  const content = items.join("; ").trim();
  return content.endsWith(".") ? content : `${content}.`;
}

function formatList(items: string[]): string {
  return items.length === 0 ? "none" : items.join(", ");
}

function createPolicyDecisionContextId(
  decision: PolicyDecision,
  index: number
): string {
  const policyRef =
    decision.policyIds.length === 0
      ? `unattributed-${index}`
      : decision.policyIds.join("+");
  const actionRef = decision.action ?? "general";
  return `governance-context:policy:${actionRef}:${policyRef}`;
}

function calculateApplicabilityRelevance(
  artifactApplicability: string[],
  requestedApplicability: string[]
): number {
  if (artifactApplicability.length === 0) {
    return 0.5;
  }

  const matchingScopes = artifactApplicability.filter((scope) =>
    requestedApplicability.includes(scope)
  );

  return matchingScopes.length / artifactApplicability.length;
}

function createCapabilityNodeContextItem(input: {
  graphId: string;
  graphStatus: CapabilityGraphStatus;
  node: CapabilityNode;
  permissionScope: string[];
}): BrainContextItem {
  const content = `Capability ${input.node.id} is named ${input.node.name}, has level ${input.node.level}, graph status ${input.graphStatus}, and confidence ${input.node.confidence}.`;
  return {
    id: `capability-graph-context:node:${input.node.id}`,
    source: "capability-graph",
    summary: `${input.node.level} capability ${input.node.name}`,
    content,
    confidence: input.node.confidence,
    relevance: 1,
    estimatedTokens: estimateContextTokens(content),
    permissionScope: input.permissionScope,
    sourceRefs: [input.graphId, input.node.id, ...input.node.sourceRefs]
  };
}

function createCapabilityEdgeContextItem(input: {
  graphId: string;
  edge: CapabilityEdge;
  confidence: number;
  permissionScope: string[];
}): BrainContextItem {
  const content = `Capability ${input.edge.fromCapabilityId} ${input.edge.relationship} ${input.edge.toCapabilityId}.`;
  return {
    id: `capability-graph-context:edge:${input.edge.fromCapabilityId}:${input.edge.relationship}:${input.edge.toCapabilityId}`,
    source: "capability-graph",
    summary: `${input.edge.relationship} edge from ${input.edge.fromCapabilityId} to ${input.edge.toCapabilityId}`,
    content,
    confidence: input.confidence,
    relevance: 0.9,
    estimatedTokens: estimateContextTokens(content),
    permissionScope: input.permissionScope,
    sourceRefs: [input.graphId, input.edge.fromCapabilityId, input.edge.toCapabilityId]
  };
}

function findCapabilityConfidence(
  nodes: CapabilityNode[],
  capabilityId: string
): number {
  return nodes.find((node) => node.id === capabilityId)?.confidence ?? 0;
}
