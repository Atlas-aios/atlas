import {
  createGoal,
  monitorGoals,
  satisfyGoalCompletionCriterion,
  transitionGoal,
  type CreateGoalInput,
  type Goal,
  type GoalLifecycleEvent
} from "@atlas-aios/agoe";
import {
  createCapabilityKernel,
  type CapabilityResolution,
  type CapabilityResolutionRequest,
  type ProviderCandidate
} from "@atlas-aios/capability-kernel";
import {
  runBoundedCognitiveLoopCycle,
  type CognitiveLoopCycle
} from "@atlas-aios/cognitive-loop";
import {
  createExecutionSession,
  runSequentialWorkflow,
  type ExecutionRunResult,
  type ExecuteWorkflowNodeResult
} from "@atlas-aios/execution-engine";
import {
  createInMemoryExperienceStore,
  recordExperienceArtifact,
  type ExperienceArtifactType,
  type ExperienceLookupQuery,
  type ExperienceStore,
  type RecordExperienceArtifactInput
} from "@atlas-aios/experience";
import {
  createDefaultGovernancePolicies,
  createInMemoryGovernancePolicyStore,
  recordGovernancePolicy,
  type GovernanceAction,
  type GovernancePolicy,
  type GovernancePolicyStore,
  type PolicyDecision
} from "@atlas-aios/governance";
import {
  createIdentityResolution,
  createIdentitySubject,
  createInMemoryIdentityStore,
  recordIdentityResolution,
  recordIdentitySubject,
  type IdentityKind,
  type IdentityLookupQuery,
  type IdentityResolutionFilter,
  type IdentityResolutionInput,
  type IdentityStore,
  type IdentitySubjectFilter,
  type IdentitySubjectInput
} from "@atlas-aios/identity";
import {
  createUnknownBusinessBrowserUiFixture,
  createUnknownBusinessCreateResourceBenchmark,
  createUnknownBusinessSystemRestFixture,
  createUnknownBusinessSystemOpenApiFixture,
  createLearningGovernanceReview,
  decideLearningPromotion,
  type LearningGovernanceReview,
  type LearningPromotionDecision,
  type UnknownBusinessSystemRestFixture,
  learnOpenApiCapabilities
} from "@atlas-aios/learning";
import {
  createInMemoryMemoryStore,
  recordMemoryEvent,
  type ListMemoryEventsFilter,
  type MemoryEvent,
  type MemoryEventKind,
  type MemoryStore,
  type RecordMemoryEventInput
} from "@atlas-aios/memory";
import {
  createInMemorySelfModelStore,
  createSelfModelSnapshot,
  updateSelfModelFromExecutionOutcome,
  type SelfModelSnapshot,
  type SelfModelStore
} from "@atlas-aios/self-model";
import {
  createInMemorySemanticWorldModelStore,
  createSemanticEntity,
  createSemanticRelationship,
  recordSemanticEntity,
  recordSemanticRelationship,
  type SemanticEntityFilter,
  type SemanticEntityInput,
  type SemanticRelationshipFilter,
  type SemanticRelationshipInput,
  type SemanticWorldModelStore
} from "@atlas-aios/swm";
import {
  createInMemoryWorldStateStore,
  createWorldStateSnapshot,
  recordWorldStateSnapshot,
  type OperationalBlocker,
  type WorldStateStore
} from "@atlas-aios/world-state";

export interface AtlasRuntime {
  handle(request: Request): Promise<Response>;
}

export interface RuntimeHealthResponse {
  service: "atlas-runtime";
  status: "ok";
}

export interface UnknownBusinessMvpResponse {
  scenario: "Create Resource";
  learnedCapabilities: string[];
  providerCandidates: string[];
  browserCapabilities: string[];
  benchmark: {
    id: string;
    passed: boolean;
    evidence: string[];
  };
}

export type CreateRuntimeGoalRequest = CreateGoalInput;

export interface TransitionRuntimeGoalStatusRequest {
  eventId: string;
  toStatus: Goal["status"];
  occurredAt: string;
  reason: string;
  sourceRefs?: string[];
}

export interface SatisfyRuntimeGoalCompletionCriterionRequest {
  eventId: string;
  evidenceRef: string;
  occurredAt: string;
}

export interface RuntimeGoalListItem {
  id: string;
  title: string;
  status: string;
  priority: number;
  ownerId: string;
}

export interface RuntimeCapabilityListItem {
  id: string;
  name: string;
  level: string;
  confidence: number;
  graphId: string;
  graphStatus: string;
  sourceRefs: string[];
}

export interface RuntimeCapabilityGraph {
  id: string;
  schemaVersion: "0.1";
  status: "draft" | "trusted" | "production";
  generatedAt: string;
  nodes: Array<{
    id: string;
    schemaVersion: "0.1";
    name: string;
    level: string;
    confidence: number;
    sourceRefs: string[];
  }>;
  edges: Array<{
    fromCapabilityId: string;
    toCapabilityId: string;
    relationship: "requires" | "composes" | "fallbacks_to";
  }>;
}

export interface RuntimeInterfaceDriverMapping {
  capabilityId: string;
  driverId: "driver:rest";
  operationId: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  requiredPermissions: string[];
}

export interface RuntimeProviderListItem {
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

export interface ResolveRuntimeCapabilityRequest {
  goalId: string;
  inputs: Record<string, unknown>;
  governanceContextId: string;
}

export interface ResolveGoalScopedRuntimeCapabilityRequest {
  inputs: Record<string, unknown>;
  governanceContextId: string;
}

export interface DispatchGoalScopedRuntimeCapabilityRequest {
  executionId: string;
  inputs: Record<string, unknown>;
  governanceContextId: string;
  startedAt: string;
}

export type RuntimeApprovalRequestStatus = "requested" | "approved" | "rejected";

export interface RuntimeApprovalRequest {
  id: string;
  status: RuntimeApprovalRequestStatus;
  goalId: string;
  capabilityId: string;
  providerId: string;
  executionId: string;
  governanceContextId: string;
  requestedAt: string;
  reason: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
}

export interface DecideRuntimeApprovalRequest {
  decidedBy: string;
  decidedAt: string;
  reason: string;
}

export interface ApproveRuntimeLearningPromotionRequest {
  governanceApprovalRef: string;
  decidedBy: string;
  decidedAt: string;
  reason: string;
}

export interface RuntimeAuditEvent {
  id: string;
  type: string;
  actorId: string;
  subjectId: string;
  occurredAt: string;
  summary: string;
  evidenceRefs: string[];
  metadata: Record<string, string>;
}

export interface DispatchGoalScopedRuntimeCapabilityResponse {
  resolution: CapabilityResolution;
  execution: ExecutionRunResult;
  approvalRequest?: RuntimeApprovalRequest;
}

export interface CreateRuntimeExecutionRequest {
  id: string;
  goalId?: string;
  capabilityId: string;
  providerId: string;
  inputs: Record<string, unknown>;
  startedAt: string;
}

export interface RuntimeExecutionRecord {
  request: CreateRuntimeExecutionRequest;
  result: ExecutionRunResult;
}

export interface RuntimeExecutionListItem {
  id: string;
  workflowId: string;
  status: string;
  goalId?: string;
  capabilityId: string;
  providerId: string;
  startedAt: string;
  stepCount: number;
  eventCount: number;
}

export type RuntimeTimelineEvent =
  | GoalLifecycleEvent
  | {
      type: string;
      goalId: string;
      executionId: string;
      occurredAt: string;
      nodeId?: string;
    };

export interface RuntimeGoalTimelineResponse {
  goalId: string;
  events: RuntimeTimelineEvent[];
}

export interface CreateRuntimeCognitiveLoopCycleRequest {
  id: string;
  goalId?: string;
  startedAt: string;
  completedAt?: string;
}

export type CreateRuntimeGovernancePolicyRequest = GovernancePolicy;
export interface EvaluateRuntimeGovernancePolicyRequest extends GovernanceAction {
  evaluatedAt?: string;
}

interface RuntimeState {
  goals: Map<string, Goal>;
  goalEvents: Map<string, GoalLifecycleEvent[]>;
  capabilities: RuntimeCapabilityListItem[];
  capabilityGraphs: RuntimeCapabilityGraph[];
  interfaceDrivers: RuntimeInterfaceDriverMapping[];
  providers: RuntimeProviderListItem[];
  learningReview: LearningGovernanceReview | null;
  learningPromotionDecisions: LearningPromotionDecision[];
  learningPromotionApprovals: Map<string, ApproveRuntimeLearningPromotionRequest>;
  executions: RuntimeExecutionRecord[];
  approvalRequests: RuntimeApprovalRequest[];
  cognitiveLoopCycles: CognitiveLoopCycle[];
  auditLogs: RuntimeAuditEvent[];
  governancePolicyStore: GovernancePolicyStore;
  memoryStore: MemoryStore;
  experienceStore: ExperienceStore;
  identityStore: IdentityStore;
  selfModelStore: SelfModelStore;
  semanticWorldModelStore: SemanticWorldModelStore;
  worldStateStore: WorldStateStore;
  unknownBusinessRest: UnknownBusinessSystemRestFixture;
}

interface UnknownBusinessMvpFlowResult {
  response: UnknownBusinessMvpResponse;
  capabilities: RuntimeCapabilityListItem[];
  capabilityGraphs: RuntimeCapabilityGraph[];
  interfaceDrivers: RuntimeInterfaceDriverMapping[];
  providers: RuntimeProviderListItem[];
  learningReview: LearningGovernanceReview;
  learningPromotionDecisions: LearningPromotionDecision[];
}

export function createAtlasRuntime(): AtlasRuntime {
  const state: RuntimeState = {
    goals: new Map<string, Goal>(),
    goalEvents: new Map<string, GoalLifecycleEvent[]>(),
    capabilities: [],
    capabilityGraphs: [],
    interfaceDrivers: [],
    providers: [],
    learningReview: null,
    learningPromotionDecisions: [],
    learningPromotionApprovals: new Map<
      string,
      ApproveRuntimeLearningPromotionRequest
    >(),
    executions: [],
    approvalRequests: [],
    cognitiveLoopCycles: [],
    auditLogs: [],
    governancePolicyStore: createInMemoryGovernancePolicyStore(
      createDefaultGovernancePolicies()
    ),
    memoryStore: createInMemoryMemoryStore(),
    experienceStore: createInMemoryExperienceStore(),
    identityStore: createInMemoryIdentityStore(),
    selfModelStore: createInMemorySelfModelStore(),
    semanticWorldModelStore: createInMemorySemanticWorldModelStore(),
    worldStateStore: createInMemoryWorldStateStore(),
    unknownBusinessRest: createUnknownBusinessSystemRestFixture()
  };

  return {
    handle: async (request) => handleRuntimeRequest(request, state)
  };
}

async function handleRuntimeRequest(
  request: Request,
  state: RuntimeState
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return json<RuntimeHealthResponse>({
      service: "atlas-runtime",
      status: "ok"
    });
  }

  if (
    request.method === "POST" &&
    url.pathname === "/mvp/unknown-business/learn-and-execute"
  ) {
    const result = await runUnknownBusinessMvpFlow();
    state.capabilities = result.capabilities;
    state.capabilityGraphs = result.capabilityGraphs;
    state.interfaceDrivers = result.interfaceDrivers;
    state.providers = result.providers;
    state.learningReview = result.learningReview;
    state.learningPromotionDecisions = result.learningPromotionDecisions;
    recordMemoryEvent(state.memoryStore, createUnknownBusinessMvpMemoryEvent(result));
    recordExperienceArtifact(
      state.experienceStore,
      createUnknownBusinessMvpExperienceArtifact()
    );
    recordUnknownBusinessMvpSemanticWorld(state, result);
    recordUnknownBusinessMvpSelfModel(state, result, "2026-07-16T00:00:00.000Z");

    return json<UnknownBusinessMvpResponse>(result.response);
  }

  if (request.method === "POST" && url.pathname === "/goals") {
    const input = (await request.json()) as CreateRuntimeGoalRequest;
    const result = createGoal(input);
    state.goals.set(result.goal.id, result.goal);
    state.goalEvents.set(result.goal.id, [result.event]);

    return json(result, { status: 201 });
  }

  if (request.method === "GET" && url.pathname === "/goals") {
    return json({
      goals: [...state.goals.values()].map(toGoalListItem)
    });
  }

  const goalStatusMatch = /^\/goals\/([^/]+)\/status$/.exec(url.pathname);
  if (request.method === "POST" && goalStatusMatch !== null) {
    const goalId = decodeURIComponent(goalStatusMatch[1] ?? "");
    const goal = state.goals.get(goalId);

    if (goal === undefined) {
      return json({ error: "goal_not_found", goalId }, { status: 404 });
    }

    const input = (await request.json()) as TransitionRuntimeGoalStatusRequest;
    const result = transitionGoal({
      goal,
      eventId: input.eventId,
      toStatus: input.toStatus,
      occurredAt: input.occurredAt,
      reason: input.reason,
      ...(input.sourceRefs === undefined ? {} : { sourceRefs: input.sourceRefs })
    });

    if (!result.ok) {
      return json(result.error, { status: 409 });
    }

    state.goals.set(goalId, result.goal);
    state.goalEvents.set(goalId, [
      ...(state.goalEvents.get(goalId) ?? []),
      result.event
    ]);

    return json(result);
  }

  const goalCriterionSatisfactionMatch =
    /^\/goals\/([^/]+)\/completion-criteria\/([^/]+)\/satisfy$/.exec(url.pathname);
  if (request.method === "POST" && goalCriterionSatisfactionMatch !== null) {
    const goalId = decodeURIComponent(goalCriterionSatisfactionMatch[1] ?? "");
    const criterionId = decodeURIComponent(goalCriterionSatisfactionMatch[2] ?? "");
    const goal = state.goals.get(goalId);

    if (goal === undefined) {
      return json({ error: "goal_not_found", goalId }, { status: 404 });
    }

    const input =
      (await request.json()) as SatisfyRuntimeGoalCompletionCriterionRequest;
    const result = satisfyGoalCompletionCriterion({
      goal,
      criterionId,
      evidenceRef: input.evidenceRef,
      eventId: input.eventId,
      occurredAt: input.occurredAt
    });

    if (!result.ok) {
      return json(result.error, { status: 404 });
    }

    const monitoringResult = monitorGoals({
      goals: [result.goal],
      checkedAt: input.occurredAt,
      eventIdPrefix: `${goalId}:event:auto`
    });
    const completionUpdate = monitoringResult.updates[0];
    const nextGoal = completionUpdate?.goal ?? result.goal;
    const events = [
      result.event,
      ...(completionUpdate === undefined ? [] : [completionUpdate.event])
    ];

    state.goals.set(goalId, nextGoal);
    state.goalEvents.set(goalId, [...(state.goalEvents.get(goalId) ?? []), ...events]);

    return json({
      ...result,
      goal: nextGoal,
      ...(completionUpdate === undefined
        ? {}
        : { autoCompletionEvent: completionUpdate.event })
    });
  }

  const goalExecutionMatch = /^\/goals\/(.+)\/executions$/.exec(url.pathname);
  if (request.method === "POST" && goalExecutionMatch !== null) {
    const goalId = decodeURIComponent(goalExecutionMatch[1] ?? "");

    if (!state.goals.has(goalId)) {
      return json({ error: "goal_not_found", goalId }, { status: 404 });
    }

    const input = (await request.json()) as CreateRuntimeExecutionRequest;

    return json(await createRuntimeExecution(state, { ...input, goalId }), {
      status: 201
    });
  }

  const goalCapabilityResolutionMatch =
    /^\/goals\/([^/]+)\/capabilities\/([^/]+)\/resolve$/.exec(url.pathname);
  if (request.method === "POST" && goalCapabilityResolutionMatch !== null) {
    const goalId = decodeURIComponent(goalCapabilityResolutionMatch[1] ?? "");
    const capabilityId = decodeURIComponent(goalCapabilityResolutionMatch[2] ?? "");

    if (!state.goals.has(goalId)) {
      return json({ error: "goal_not_found", goalId }, { status: 404 });
    }

    const input = (await request.json()) as ResolveGoalScopedRuntimeCapabilityRequest;

    return json(
      await resolveRuntimeCapability({
        state,
        request: {
          goalId,
          capabilityId,
          inputs: input.inputs,
          governanceContextId: input.governanceContextId
        }
      })
    );
  }

  const goalCapabilityDispatchMatch =
    /^\/goals\/([^/]+)\/capabilities\/([^/]+)\/dispatch$/.exec(url.pathname);
  if (request.method === "POST" && goalCapabilityDispatchMatch !== null) {
    const goalId = decodeURIComponent(goalCapabilityDispatchMatch[1] ?? "");
    const capabilityId = decodeURIComponent(goalCapabilityDispatchMatch[2] ?? "");

    if (!state.goals.has(goalId)) {
      return json({ error: "goal_not_found", goalId }, { status: 404 });
    }

    const input = (await request.json()) as DispatchGoalScopedRuntimeCapabilityRequest;
    const resolution = await resolveRuntimeCapability({
      state,
      request: {
        goalId,
        capabilityId,
        inputs: input.inputs,
        governanceContextId: input.governanceContextId
      }
    });
    const execution = await createRuntimeExecution(state, {
      id: input.executionId,
      goalId,
      capabilityId,
      providerId: resolution.selectedProviderId,
      inputs: input.inputs,
      startedAt: input.startedAt
    });
    const approvalRequest =
      resolution.approvalRequired === false
        ? undefined
        : createRuntimeApprovalRequest({
            goalId,
            capabilityId,
            providerId: resolution.selectedProviderId,
            executionId: input.executionId,
            governanceContextId: input.governanceContextId,
            requestedAt: input.startedAt,
            reason: resolution.approvalReason ?? "Provider execution requires approval."
          });

    if (approvalRequest !== undefined) {
      state.approvalRequests.push(approvalRequest);
    }

    return json<DispatchGoalScopedRuntimeCapabilityResponse>(
      {
        resolution,
        execution,
        ...(approvalRequest === undefined ? {} : { approvalRequest })
      },
      { status: 201 }
    );
  }

  const goalTimelineMatch = /^\/goals\/([^/]+)\/timeline$/.exec(url.pathname);
  if (request.method === "GET" && goalTimelineMatch !== null) {
    const goalId = decodeURIComponent(goalTimelineMatch[1] ?? "");

    if (!state.goals.has(goalId)) {
      return json({ error: "goal_not_found", goalId }, { status: 404 });
    }

    return json<RuntimeGoalTimelineResponse>({
      goalId,
      events: createRuntimeGoalTimeline(state, goalId)
    });
  }

  const goalDetailMatch = /^\/goals\/(.+)$/.exec(url.pathname);
  if (request.method === "GET" && goalDetailMatch !== null) {
    const goalId = decodeURIComponent(goalDetailMatch[1] ?? "");
    const goal = state.goals.get(goalId);

    if (goal === undefined) {
      return json({ error: "goal_not_found", goalId }, { status: 404 });
    }

    return json({
      goal: toGoalListItem(goal),
      executions: state.executions
        .filter((execution) => execution.request.goalId === goalId)
        .map(toExecutionListItem)
    });
  }

  if (request.method === "GET" && url.pathname === "/capabilities") {
    return json({
      capabilities: state.capabilities
    });
  }

  if (request.method === "GET" && url.pathname === "/capability-graphs") {
    return json({
      capabilityGraphs: state.capabilityGraphs
    });
  }

  if (request.method === "GET" && url.pathname === "/interface-drivers") {
    return json({
      interfaceDrivers: state.interfaceDrivers
    });
  }

  if (request.method === "GET" && url.pathname === "/learning/reports") {
    return json({
      learningReview: state.learningReview,
      promotionDecisions: state.learningPromotionDecisions,
      reports: state.learningReview?.reports ?? []
    });
  }

  const learningPromotionApprovalMatch =
    /^\/learning\/promotion-decisions\/(development|production)\/approve$/.exec(
      url.pathname
    );
  if (request.method === "POST" && learningPromotionApprovalMatch !== null) {
    if (state.learningReview === null) {
      return json({ error: "learning_review_not_found" }, { status: 404 });
    }

    const stage = learningPromotionApprovalMatch[1] as "development" | "production";
    const input = (await request.json()) as ApproveRuntimeLearningPromotionRequest;
    state.learningPromotionApprovals.set(stage, input);

    const promotionDecision = decideLearningPromotion({
      subjectId: "learning:unknown-business-system",
      stage,
      review: state.learningReview,
      governanceApprovalRef: input.governanceApprovalRef
    });
    state.learningPromotionDecisions = state.learningPromotionDecisions.map(
      (decision) => (decision.stage === stage ? promotionDecision : decision)
    );
    state.auditLogs.push(
      createLearningPromotionApprovalAuditEvent({
        stage,
        input,
        subjectId: "learning:unknown-business-system"
      })
    );
    recordMemoryEvent(
      state.memoryStore,
      createLearningPromotionApprovalMemoryEvent({
        stage,
        input,
        subjectId: "learning:unknown-business-system"
      })
    );

    return json({ promotionDecision });
  }

  if (request.method === "POST" && url.pathname === "/memory/events") {
    const input = (await request.json()) as RecordMemoryEventInput;

    return json(
      {
        memoryEvent: recordMemoryEvent(state.memoryStore, input)
      },
      { status: 201 }
    );
  }

  if (request.method === "GET" && url.pathname === "/memory/events") {
    return json({
      memoryEvents: state.memoryStore.list(createMemoryEventFilter(url))
    });
  }

  if (request.method === "POST" && url.pathname === "/experience/artifacts") {
    const input = (await request.json()) as RecordExperienceArtifactInput;

    return json(
      {
        experienceArtifact: recordExperienceArtifact(state.experienceStore, input)
      },
      { status: 201 }
    );
  }

  if (request.method === "GET" && url.pathname === "/experience/artifacts") {
    return json({
      experienceArtifacts: state.experienceStore.list(createExperienceLookupQuery(url))
    });
  }

  if (request.method === "POST" && url.pathname === "/identity/entities") {
    const input = (await request.json()) as IdentitySubjectInput;

    return json(
      {
        identity: recordIdentitySubject(
          state.identityStore,
          createIdentitySubject(input)
        )
      },
      { status: 201 }
    );
  }

  if (request.method === "GET" && url.pathname === "/identity/entities") {
    return json({
      identities: state.identityStore.listSubjects(createIdentitySubjectFilter(url))
    });
  }

  if (request.method === "GET" && url.pathname === "/identity/entities/resolve") {
    const identity = state.identityStore.findSubject(createIdentityLookupQuery(url));

    if (identity === undefined) {
      return json({ error: "identity_not_found" }, { status: 404 });
    }

    return json({ identity });
  }

  if (request.method === "POST" && url.pathname === "/identity/resolutions") {
    const input = (await request.json()) as IdentityResolutionInput;

    return json(
      {
        resolution: recordIdentityResolution(
          state.identityStore,
          createIdentityResolution(input)
        )
      },
      { status: 201 }
    );
  }

  if (request.method === "GET" && url.pathname === "/identity/resolutions") {
    return json({
      resolutions: state.identityStore.listResolutions(
        createIdentityResolutionFilter(url)
      )
    });
  }

  if (request.method === "GET" && url.pathname === "/self-model") {
    const generatedAt = url.searchParams.get("generatedAt") ?? new Date().toISOString();

    return json({
      selfModel: createRuntimeSelfModelSnapshot(state, generatedAt)
    });
  }

  if (request.method === "POST" && url.pathname === "/cognitive-loop/cycles") {
    const input = (await request.json()) as CreateRuntimeCognitiveLoopCycleRequest;
    const result = runRuntimeCognitiveLoopCycle(state, input);

    return json(result, { status: 201 });
  }

  if (request.method === "GET" && url.pathname === "/cognitive-loop/cycles") {
    return json({
      cycles: state.cognitiveLoopCycles
    });
  }

  if (request.method === "POST" && url.pathname === "/swm/entities") {
    const input = (await request.json()) as SemanticEntityInput;

    return json(
      {
        entity: recordSemanticEntity(
          state.semanticWorldModelStore,
          createSemanticEntity(input)
        )
      },
      { status: 201 }
    );
  }

  if (request.method === "GET" && url.pathname === "/swm/entities") {
    return json({
      entities: state.semanticWorldModelStore.listEntities(
        createSemanticEntityFilter(url)
      )
    });
  }

  if (request.method === "POST" && url.pathname === "/swm/relationships") {
    const input = (await request.json()) as SemanticRelationshipInput;

    return json(
      {
        relationship: recordSemanticRelationship(
          state.semanticWorldModelStore,
          createSemanticRelationship(input)
        )
      },
      { status: 201 }
    );
  }

  if (request.method === "GET" && url.pathname === "/swm/relationships") {
    return json({
      relationships: state.semanticWorldModelStore.listRelationships(
        createSemanticRelationshipFilter(url)
      )
    });
  }

  if (request.method === "GET" && url.pathname === "/world-state") {
    const capturedAt = url.searchParams.get("capturedAt") ?? new Date().toISOString();

    return json({
      worldState: recordWorldStateSnapshot(
        state.worldStateStore,
        createRuntimeWorldStateSnapshot(state, capturedAt)
      )
    });
  }

  if (request.method === "GET" && url.pathname === "/audit-logs") {
    return json({
      auditLogs: state.auditLogs
    });
  }

  if (request.method === "GET" && url.pathname === "/governance/policies") {
    return json({
      policies: state.governancePolicyStore.list()
    });
  }

  if (request.method === "POST" && url.pathname === "/governance/policies") {
    const input = (await request.json()) as CreateRuntimeGovernancePolicyRequest;

    return json(
      {
        policy: recordGovernancePolicy(state.governancePolicyStore, input)
      },
      { status: 201 }
    );
  }

  if (request.method === "POST" && url.pathname === "/governance/evaluate") {
    const input = (await request.json()) as EvaluateRuntimeGovernancePolicyRequest;
    const policyDecision = state.governancePolicyStore.evaluate(input);

    state.auditLogs.push(
      createGovernancePolicyEvaluationAuditEvent(input, policyDecision)
    );

    return json({ policyDecision });
  }

  if (request.method === "GET" && url.pathname === "/providers") {
    return json({
      providers: state.providers
    });
  }

  if (request.method === "GET" && url.pathname === "/approval-requests") {
    return json({
      approvalRequests: state.approvalRequests
    });
  }

  const approvalDecisionMatch = /^\/approval-requests\/(.+)\/(approve|reject)$/.exec(
    url.pathname
  );
  if (request.method === "POST" && approvalDecisionMatch !== null) {
    const approvalRequestId = decodeURIComponent(approvalDecisionMatch[1] ?? "");
    const decision = approvalDecisionMatch[2] === "approve" ? "approved" : "rejected";
    const approvalRequest = state.approvalRequests.find(
      (item) => item.id === approvalRequestId
    );

    if (approvalRequest === undefined) {
      return json(
        { error: "approval_request_not_found", approvalRequestId },
        { status: 404 }
      );
    }

    const input = (await request.json()) as DecideRuntimeApprovalRequest;
    const decidedRequest: RuntimeApprovalRequest = {
      ...approvalRequest,
      status: decision,
      decidedBy: input.decidedBy,
      decidedAt: input.decidedAt,
      decisionReason: input.reason
    };

    state.approvalRequests = state.approvalRequests.map((item) =>
      item.id === approvalRequestId ? decidedRequest : item
    );
    recordApprovalActorIdentity(state, decidedRequest);

    return json({ approvalRequest: decidedRequest });
  }

  if (request.method === "POST" && url.pathname === "/executions") {
    const input = (await request.json()) as CreateRuntimeExecutionRequest;

    return json(await createRuntimeExecution(state, input), { status: 201 });
  }

  if (request.method === "GET" && url.pathname === "/executions") {
    return json({
      executions: state.executions.map(toExecutionListItem)
    });
  }

  const executionDetailMatch = /^\/executions\/(.+)$/.exec(url.pathname);
  if (request.method === "GET" && executionDetailMatch !== null) {
    const executionId = decodeURIComponent(executionDetailMatch[1] ?? "");
    const record = state.executions.find(
      (execution) => execution.result.session.id === executionId
    );

    if (record === undefined) {
      return json({ error: "execution_not_found", executionId }, { status: 404 });
    }

    return json(record);
  }

  const capabilityResolutionMatch = /^\/capabilities\/([^/]+)\/resolve$/.exec(
    url.pathname
  );
  if (request.method === "POST" && capabilityResolutionMatch !== null) {
    const capabilityId = decodeURIComponent(capabilityResolutionMatch[1] ?? "");
    const input = (await request.json()) as ResolveRuntimeCapabilityRequest;

    return json(
      await resolveRuntimeCapability({
        state,
        request: {
          goalId: input.goalId,
          capabilityId,
          inputs: input.inputs,
          governanceContextId: input.governanceContextId
        }
      })
    );
  }

  return json({ error: "not_found" }, { status: 404 });
}

function recordUnknownBusinessMvpSemanticWorld(
  state: RuntimeState,
  result: UnknownBusinessMvpFlowResult
): void {
  const systemEntityId = "swm:entity:system:unknown-business";
  recordSemanticEntity(
    state.semanticWorldModelStore,
    createSemanticEntity({
      id: systemEntityId,
      type: "software_system",
      label: "Unknown Business System",
      attributes: {
        systemId: "learning:unknown-business-system",
        capabilityGraphId: "capability-graph:unknown-business-system"
      },
      confidence: 0.8,
      evidenceRefs: ["fixture:unknown-business-system"],
      observedAt: "2026-07-16T00:00:00.000Z"
    })
  );

  for (const capability of result.capabilities) {
    const entityId = semanticCapabilityEntityId(capability.id);
    recordSemanticEntity(
      state.semanticWorldModelStore,
      createSemanticEntity({
        id: entityId,
        type: "capability",
        label: capability.name,
        attributes: {
          capabilityId: capability.id,
          level: capability.level,
          graphId: capability.graphId
        },
        confidence: capability.confidence,
        evidenceRefs: capability.sourceRefs,
        observedAt: "2026-07-16T00:00:00.000Z"
      })
    );
    recordSemanticRelationship(
      state.semanticWorldModelStore,
      createSemanticRelationship({
        id: `swm:relationship:system-has-${capability.id}`,
        fromEntityId: systemEntityId,
        toEntityId: entityId,
        type: "has_capability",
        confidence: capability.confidence,
        evidenceRefs: [capability.graphId, ...capability.sourceRefs],
        observedAt: "2026-07-16T00:00:00.000Z"
      })
    );
  }
}

function recordUnknownBusinessMvpSelfModel(
  state: RuntimeState,
  result: UnknownBusinessMvpFlowResult,
  generatedAt: string
): void {
  state.selfModelStore.recordSnapshot(
    createSelfModelSnapshot({
      id: `self-model:runtime:${generatedAt}`,
      generatedAt,
      availableCapabilityIds: result.capabilities.map((capability) => capability.id),
      grantedAuthority: ["authority:execute:simulation"],
      resourceLimits: {
        maxEstimatedCostPerExecution: 0.01,
        maxEstimatedLatencyMs: 500
      },
      capabilityConfidence: result.providers.map((provider) => ({
        capabilityId: provider.capabilityId,
        providerId: provider.providerId,
        confidence: provider.confidence,
        knownLimitations: runtimeProviderKnownLimitations(provider.providerId),
        knownFailureModes: [],
        evidenceRefs: runtimeProviderEvidenceRefs(provider.providerId),
        updatedAt: generatedAt
      })),
      interfaceMaturity: [
        {
          interfaceId: "interface:openapi:unknown-business-system",
          maturity: "validated",
          confidence: 0.8,
          evidenceRefs: ["benchmark:unknown-business:create-resource"],
          updatedAt: generatedAt
        }
      ],
      subsystemMaturity: [
        {
          subsystemId: "subsystem:capability-kernel",
          maturity: "tested",
          confidence: 0.8,
          evidenceRefs: ["test:capability-kernel"],
          updatedAt: generatedAt
        },
        {
          subsystemId: "subsystem:execution-engine",
          maturity: "tested",
          confidence: 0.8,
          evidenceRefs: ["test:execution-engine"],
          updatedAt: generatedAt
        }
      ],
      knownLimitations: [
        "Browser UI driver is available as fixture evidence but is not yet the runtime execution path."
      ],
      knownFailureModes: [
        "Provider execution fails when the learned provider is not registered."
      ]
    })
  );
}

function createRuntimeSelfModelSnapshot(
  state: RuntimeState,
  generatedAt: string
): SelfModelSnapshot {
  const currentSnapshot = state.selfModelStore.getCurrentSnapshot();

  if (currentSnapshot === undefined || state.capabilities.length > 0) {
    const generatedSnapshot = createSelfModelSnapshot({
      id: `self-model:runtime:${generatedAt}`,
      generatedAt,
      availableCapabilityIds: state.capabilities.map((capability) => capability.id),
      grantedAuthority: ["authority:execute:simulation"],
      resourceLimits: {
        maxEstimatedCostPerExecution: 0.01,
        maxEstimatedLatencyMs: 500
      },
      capabilityConfidence:
        currentSnapshot?.capabilityConfidence ??
        state.providers.map((provider) => ({
          capabilityId: provider.capabilityId,
          providerId: provider.providerId,
          confidence: provider.confidence,
          knownLimitations: runtimeProviderKnownLimitations(provider.providerId),
          knownFailureModes: [],
          evidenceRefs: runtimeProviderEvidenceRefs(provider.providerId),
          updatedAt: generatedAt
        })),
      interfaceMaturity:
        state.interfaceDrivers.length === 0
          ? (currentSnapshot?.interfaceMaturity ?? [])
          : [
              {
                interfaceId: "interface:openapi:unknown-business-system",
                maturity: "validated",
                confidence: 0.8,
                evidenceRefs: ["benchmark:unknown-business:create-resource"],
                updatedAt: generatedAt
              }
            ],
      subsystemMaturity: currentSnapshot?.subsystemMaturity ?? [
        {
          subsystemId: "subsystem:capability-kernel",
          maturity: "tested",
          confidence: 0.8,
          evidenceRefs: ["test:capability-kernel"],
          updatedAt: generatedAt
        },
        {
          subsystemId: "subsystem:execution-engine",
          maturity: "tested",
          confidence: 0.8,
          evidenceRefs: ["test:execution-engine"],
          updatedAt: generatedAt
        }
      ],
      knownLimitations: currentSnapshot?.knownLimitations ?? [
        "Browser UI driver is available as fixture evidence but is not yet the runtime execution path."
      ],
      knownFailureModes: currentSnapshot?.knownFailureModes ?? [
        "Provider execution fails when the learned provider is not registered."
      ]
    });

    return state.selfModelStore.recordSnapshot(generatedSnapshot);
  }

  return state.selfModelStore.recordSnapshot(
    createSelfModelSnapshot({
      ...currentSnapshot,
      id: `self-model:runtime:${generatedAt}`,
      generatedAt
    })
  );
}

function updateRuntimeSelfModelFromExecution(
  state: RuntimeState,
  input: CreateRuntimeExecutionRequest,
  result: ExecutionRunResult
): void {
  updateSelfModelFromExecutionOutcome(state.selfModelStore, {
    capabilityId: input.capabilityId,
    providerId: input.providerId,
    status: result.status === "completed" ? "completed" : "failed",
    occurredAt: result.session.startedAt,
    evidenceRefs: [
      result.session.id,
      ...result.steps.flatMap((step) => step.evidenceRefs)
    ],
    ...(result.status === "completed"
      ? {}
      : {
          failureMode: `Runtime execution ended with status ${result.status}.`,
          limitation:
            "Provider execution requires successful runtime workflow completion."
        })
  });
}

function runRuntimeCognitiveLoopCycle(
  state: RuntimeState,
  input: CreateRuntimeCognitiveLoopCycleRequest
): { cycle: CognitiveLoopCycle; memoryEvent: MemoryEvent } {
  const completedAt = input.completedAt ?? input.startedAt;
  const worldState = recordWorldStateSnapshot(
    state.worldStateStore,
    createRuntimeWorldStateSnapshot(state, input.startedAt)
  );
  const selfModel = createRuntimeSelfModelSnapshot(state, input.startedAt);
  const cycle = runBoundedCognitiveLoopCycle({
    id: input.id,
    ...(input.goalId === undefined ? {} : { goalId: input.goalId }),
    startedAt: input.startedAt,
    completedAt,
    observations: {
      activeGoalIds: [...worldState.activeGoalIds],
      activeExecutionIds: [...worldState.activeExecutionIds],
      blockerIds: worldState.blockers.map((blocker) => blocker.id),
      memoryEventIds: state.memoryStore.list().map((event) => event.id),
      experienceArtifactIds: state.experienceStore
        .list({ applicability: [] })
        .map((artifact) => artifact.id),
      capabilityIds: state.capabilities.map((capability) => capability.id),
      identityIds: state.identityStore.listSubjects().map((identity) => identity.id),
      selfModelSnapshotId: selfModel.id,
      worldStateSnapshotId: worldState.id
    }
  });
  const memoryEvent = recordMemoryEvent(
    state.memoryStore,
    createCognitiveLoopMemoryEvent(cycle)
  );

  state.cognitiveLoopCycles.push(cycle);

  return { cycle, memoryEvent };
}

function createCognitiveLoopMemoryEvent(
  cycle: CognitiveLoopCycle
): RecordMemoryEventInput {
  return {
    id: `memory:event:cognitive-loop:${cycle.id}`,
    kind: "conversation",
    occurredAt: cycle.completedAt,
    summary: `Cognitive Loop cycle ${cycle.id} recommended ${cycle.nextAction.type}.`,
    subjectIds: optionalRuntimeRefs([cycle.goalId]),
    sourceIds: [
      cycle.id,
      ...optionalRuntimeRefs([
        cycle.observations.worldStateSnapshotId,
        cycle.observations.selfModelSnapshotId
      ])
    ],
    evidenceRefs: [
      ...cycle.nextAction.targetRefs,
      ...optionalRuntimeRefs([
        cycle.observations.worldStateSnapshotId,
        cycle.observations.selfModelSnapshotId
      ])
    ],
    metadata: {
      nextActionType: cycle.nextAction.type,
      nextActionStatus: cycle.nextAction.status,
      bounded: String(cycle.bounded),
      executedAction: String(cycle.executedAction)
    }
  };
}

function optionalRuntimeRefs(refs: Array<string | undefined>): string[] {
  return refs.filter((ref): ref is string => ref !== undefined);
}

function runtimeProviderKnownLimitations(providerId: string): string[] {
  return providerId.startsWith("provider:openapi:")
    ? ["Requires OpenAPI-derived provider registration and valid request payloads."]
    : [];
}

function runtimeProviderEvidenceRefs(providerId: string): string[] {
  switch (providerId) {
    case "provider:openapi:create-folio":
      return ["openapi:POST /folios"];
    case "provider:openapi:allocate-settlement":
      return ["openapi:POST /settlements/allocate"];
    case "provider:openapi:dispatch-work-packet":
      return ["openapi:POST /work-packets/dispatch"];
    default:
      return [];
  }
}

function semanticCapabilityEntityId(capabilityId: string): string {
  return `swm:entity:${capabilityId}`;
}

function createRuntimeWorldStateSnapshot(state: RuntimeState, capturedAt: string) {
  return createWorldStateSnapshot({
    id: `world-state:runtime:${capturedAt}`,
    capturedAt,
    goals: [...state.goals.values()].map((goal) => ({
      id: goal.id,
      status: goal.status
    })),
    executions: state.executions.map((execution) => ({
      id: execution.result.session.id,
      status: execution.result.status
    })),
    blockers: createRuntimeOperationalBlockers(state)
  });
}

function createRuntimeOperationalBlockers(state: RuntimeState): OperationalBlocker[] {
  return state.approvalRequests
    .filter((approvalRequest) => approvalRequest.status === "requested")
    .map((approvalRequest) => ({
      id: `blocker:approval:${approvalRequest.id}`,
      summary: `Approval requested for ${approvalRequest.providerId} on ${approvalRequest.capabilityId}: ${approvalRequest.reason}`,
      severity: "high"
    }));
}

function createUnknownBusinessMvpExperienceArtifact(): RecordExperienceArtifactInput {
  return {
    id: "experience:playbook:unknown-business:openapi-browser-benchmark",
    type: "playbook",
    summary:
      "For unknown software with OpenAPI and browser evidence, generate a draft Capability Graph, create provider candidates, and require benchmark evidence before promotion.",
    evidenceMemoryEventIds: ["memory:event:mvp:unknown-business:learn-and-execute"],
    applicability: [
      "learning:unknown-business-system",
      "interface:openapi",
      "interface:browser-ui",
      "capability:create-resource"
    ],
    confidence: 0.7
  };
}

function createUnknownBusinessMvpMemoryEvent(
  result: UnknownBusinessMvpFlowResult
): RecordMemoryEventInput {
  return {
    id: "memory:event:mvp:unknown-business:learn-and-execute",
    kind: "execution",
    occurredAt: "2026-07-16T00:00:00.000Z",
    summary: `Learned ${result.capabilities.length} capabilities, generated ${result.providers.length} provider candidates, and passed benchmark ${result.response.benchmark.id}.`,
    subjectIds: [
      "learning:unknown-business-system",
      ...result.capabilityGraphs.map((graph) => graph.id),
      result.response.benchmark.id
    ],
    sourceIds: [
      ...result.capabilities.flatMap((capability) => capability.sourceRefs),
      ...result.response.benchmark.evidence
    ],
    evidenceRefs: result.response.benchmark.evidence,
    metadata: {
      benchmarkPassed: String(result.response.benchmark.passed),
      learnedCapabilities: String(result.capabilities.length),
      providerCandidates: String(result.providers.length)
    }
  };
}

async function runUnknownBusinessMvpFlow(): Promise<UnknownBusinessMvpFlowResult> {
  const openApiFixture = createUnknownBusinessSystemOpenApiFixture();
  const learningResult = learnOpenApiCapabilities({
    graphId: openApiFixture.graphId,
    generatedAt: "2026-07-16T00:00:00.000Z",
    providerVersion: "0.1.0",
    defaultEstimatedCost: 0.05,
    defaultEstimatedLatencyMs: 900,
    document: openApiFixture.document
  });
  const browserFixture = createUnknownBusinessBrowserUiFixture();
  const benchmark = await createUnknownBusinessCreateResourceBenchmark().run();
  const learningReview = createLearningGovernanceReview({
    subjectId: "learning:unknown-business-system",
    reviewItems: learningResult.reviewItems,
    benchmarkPassed: benchmark.passed,
    evidenceRefs: benchmark.evidence
  });
  const learningPromotionDecisions = [
    decideLearningPromotion({
      subjectId: "learning:unknown-business-system",
      stage: "development",
      review: learningReview
    }),
    decideLearningPromotion({
      subjectId: "learning:unknown-business-system",
      stage: "production",
      review: learningReview
    })
  ];
  const capabilities = learningResult.graph.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    level: node.level,
    confidence: node.confidence,
    graphId: learningResult.graph.id,
    graphStatus: learningResult.graph.status,
    sourceRefs: node.sourceRefs
  }));

  return {
    capabilities,
    capabilityGraphs: [learningResult.graph],
    interfaceDrivers: learningResult.driverMappings,
    providers: learningResult.providerCandidates.map((candidate) => ({
      providerId: candidate.providerId,
      capabilityId: candidate.capabilityId,
      confidence: candidate.confidence,
      riskScore: candidate.riskScore,
      estimatedCost: candidate.estimatedCost,
      estimatedLatencyMs: candidate.estimatedLatencyMs,
      ...(candidate.permissionFit === undefined
        ? {}
        : { permissionFit: candidate.permissionFit }),
      ...(candidate.policyRiskScore === undefined
        ? {}
        : { policyRiskScore: candidate.policyRiskScore }),
      ...(candidate.reputationScore === undefined
        ? {}
        : { reputationScore: candidate.reputationScore })
    })),
    learningReview,
    learningPromotionDecisions,
    response: {
      scenario: "Create Resource",
      learnedCapabilities: learningResult.graph.nodes.map((node) => node.id),
      providerCandidates: learningResult.providerCandidates.map(
        (candidate) => candidate.providerId
      ),
      browserCapabilities: extractBrowserCapabilities(browserFixture.render()),
      benchmark: {
        id: benchmark.id,
        passed: benchmark.passed,
        evidence: benchmark.evidence
      }
    }
  };
}

function extractBrowserCapabilities(html: string): string[] {
  return [...html.matchAll(/data-atlas-capability="([^"]+)"/g)].map(
    (match) => match[1] ?? ""
  );
}

function toGoalListItem(goal: Goal): RuntimeGoalListItem {
  return {
    id: goal.id,
    title: goal.title,
    status: goal.status,
    priority: goal.priority,
    ownerId: goal.ownerId
  };
}

async function resolveRuntimeCapability(input: {
  state: RuntimeState;
  request: CapabilityResolutionRequest;
}): Promise<CapabilityResolution> {
  const kernel = createCapabilityKernel({
    artifacts: [],
    providers: input.state.providers.map(toProviderCandidate)
  });

  return kernel.resolve(input.request);
}

async function createRuntimeExecution(
  state: RuntimeState,
  input: CreateRuntimeExecutionRequest
): Promise<ExecutionRunResult> {
  const result = await runSequentialWorkflow({
    session: createExecutionSession({
      id: input.id,
      workflowId: `workflow:runtime:${input.id}`,
      startedAt: input.startedAt
    }),
    workflow: {
      id: `workflow:runtime:${input.id}`,
      version: "0.1",
      nodes: [
        {
          id: "node:runtime-provider",
          type: "capability",
          inputs: {
            providerId: input.providerId,
            capabilityId: input.capabilityId,
            inputs: input.inputs
          }
        }
      ],
      edges: []
    },
    handlers: {
      capability: async ({ node }) =>
        executeRuntimeProvider(
          state,
          requiredStringRuntimeInput(node.inputs, "providerId"),
          requiredStringRuntimeInput(node.inputs, "capabilityId"),
          requiredRecordRuntimeInput(node.inputs, "inputs")
        )
    }
  });

  state.executions.push({
    request: input,
    result
  });
  updateRuntimeSelfModelFromExecution(state, input, result);

  return result;
}

async function executeRuntimeProvider(
  state: RuntimeState,
  providerId: string,
  capabilityId: string,
  inputs: Record<string, unknown>
): Promise<ExecuteWorkflowNodeResult> {
  if (
    !state.providers.some(
      (provider) =>
        provider.providerId === providerId && provider.capabilityId === capabilityId
    )
  ) {
    throw new Error(`Provider ${providerId} is not registered for ${capabilityId}`);
  }

  const restRequest = runtimeProviderRestRequest(providerId, inputs);
  const result = await state.unknownBusinessRest.handle(restRequest);

  return {
    outputs: {
      status: result.status,
      body: result.body
    },
    evidenceRefs: [
      `fixture:rest:${restRequest.method} ${restRequest.path}`,
      `runtime:provider:${providerId}`
    ]
  };
}

function runtimeProviderRestRequest(
  providerId: string,
  inputs: Record<string, unknown>
) {
  switch (providerId) {
    case "provider:openapi:create-folio":
      return {
        method: "POST" as const,
        path: "/folios" as const,
        body: inputs
      };
    case "provider:openapi:allocate-settlement":
      return {
        method: "POST" as const,
        path: "/settlements/allocate" as const,
        body: inputs
      };
    case "provider:openapi:dispatch-work-packet":
      return {
        method: "POST" as const,
        path: "/work-packets/dispatch" as const,
        body: inputs
      };
    default:
      throw new Error(`Runtime provider is not executable: ${providerId}`);
  }
}

function requiredStringRuntimeInput(
  inputs: Record<string, unknown>,
  key: string
): string {
  const value = inputs[key];

  if (typeof value !== "string") {
    throw new Error(`Runtime execution missing string input: ${key}`);
  }

  return value;
}

function requiredRecordRuntimeInput(
  inputs: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const value = inputs[key];

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Runtime execution missing object input: ${key}`);
  }

  return { ...value };
}

function toProviderCandidate(provider: RuntimeProviderListItem): ProviderCandidate {
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

function toExecutionListItem(record: RuntimeExecutionRecord): RuntimeExecutionListItem {
  return {
    id: record.result.session.id,
    workflowId: record.result.session.workflowId,
    status: record.result.status,
    ...(record.request.goalId === undefined ? {} : { goalId: record.request.goalId }),
    capabilityId: record.request.capabilityId,
    providerId: record.request.providerId,
    startedAt: record.result.session.startedAt,
    stepCount: record.result.steps.length,
    eventCount: record.result.events.length
  };
}

function createRuntimeApprovalRequest(input: {
  goalId: string;
  capabilityId: string;
  providerId: string;
  executionId: string;
  governanceContextId: string;
  requestedAt: string;
  reason: string;
}): RuntimeApprovalRequest {
  return {
    id: `approval:runtime:${input.executionId}`,
    status: "requested",
    goalId: input.goalId,
    capabilityId: input.capabilityId,
    providerId: input.providerId,
    executionId: input.executionId,
    governanceContextId: input.governanceContextId,
    requestedAt: input.requestedAt,
    reason: input.reason
  };
}

function recordApprovalActorIdentity(
  state: RuntimeState,
  approvalRequest: RuntimeApprovalRequest
): void {
  if (approvalRequest.decidedBy === undefined) {
    return;
  }

  recordIdentitySubject(
    state.identityStore,
    createIdentitySubject({
      id: approvalRequest.decidedBy,
      kind: "human",
      displayName: approvalRequest.decidedBy,
      confidence: 0.6,
      aliases: [approvalRequest.decidedBy],
      evidenceRefs: [approvalRequest.id]
    })
  );
}

function createGovernancePolicyEvaluationAuditEvent(
  action: EvaluateRuntimeGovernancePolicyRequest,
  policyDecision: PolicyDecision
): RuntimeAuditEvent {
  return {
    id: `audit:governance:${action.id}`,
    type: "governance.policy.evaluated",
    actorId: action.requesterIdentityId,
    subjectId: action.id,
    occurredAt: action.evaluatedAt ?? new Date(0).toISOString(),
    summary: `Governance decision ${policyDecision.decision} for ${action.action}: ${policyDecision.reason}`,
    evidenceRefs: [...action.evidenceRefs],
    metadata: {
      decision: policyDecision.decision,
      policyIds: policyDecision.policyIds.join(","),
      detectedImpacts: policyDecision.detectedImpacts.join(",")
    }
  };
}

function createLearningPromotionApprovalAuditEvent(input: {
  stage: "development" | "production";
  subjectId: string;
  input: ApproveRuntimeLearningPromotionRequest;
}): RuntimeAuditEvent {
  return {
    id: `audit:learning-promotion:${input.stage}:${input.input.decidedAt}`,
    type: "learning.promotion.approved",
    actorId: input.input.decidedBy,
    subjectId: input.subjectId,
    occurredAt: input.input.decidedAt,
    summary: `Approved ${input.stage} learning promotion gate: ${input.input.reason}`,
    evidenceRefs: [input.input.governanceApprovalRef],
    metadata: {
      stage: input.stage,
      governanceApprovalRef: input.input.governanceApprovalRef
    }
  };
}

function createLearningPromotionApprovalMemoryEvent(input: {
  stage: "development" | "production";
  subjectId: string;
  input: ApproveRuntimeLearningPromotionRequest;
}): RecordMemoryEventInput {
  return {
    id: `memory:event:learning-promotion:${input.stage}:${input.input.decidedAt}`,
    kind: "approval",
    occurredAt: input.input.decidedAt,
    summary: `Approved ${input.stage} learning promotion gate: ${input.input.reason}`,
    subjectIds: [input.subjectId],
    sourceIds: [input.input.governanceApprovalRef],
    evidenceRefs: [input.input.governanceApprovalRef],
    metadata: {
      actorId: input.input.decidedBy,
      stage: input.stage
    }
  };
}

function createMemoryEventFilter(url: URL): ListMemoryEventsFilter {
  const kinds = url.searchParams.getAll("kind").filter(isMemoryEventKind);
  const subjectIds = nonEmptyQueryValues(url, "subjectId");
  const sourceIds = nonEmptyQueryValues(url, "sourceId");

  return {
    ...(kinds.length === 0 ? {} : { kinds }),
    ...(subjectIds.length === 0 ? {} : { subjectIds }),
    ...(sourceIds.length === 0 ? {} : { sourceIds })
  };
}

function createExperienceLookupQuery(url: URL): ExperienceLookupQuery {
  const artifactTypes = url.searchParams
    .getAll("type")
    .filter(isExperienceArtifactType);
  const applicability = nonEmptyQueryValues(url, "applicability");
  const minimumConfidence = Number(url.searchParams.get("minimumConfidence"));

  return {
    applicability,
    ...(artifactTypes.length === 0 ? {} : { artifactTypes }),
    ...(Number.isFinite(minimumConfidence) ? { minimumConfidence } : {})
  };
}

function createIdentitySubjectFilter(url: URL): IdentitySubjectFilter {
  const kinds = url.searchParams.getAll("kind").filter(isIdentityKind);

  return {
    ...(kinds.length === 0 ? {} : { kinds })
  };
}

function createIdentityLookupQuery(url: URL): IdentityLookupQuery {
  const alias = url.searchParams.get("alias") ?? undefined;
  const externalSystem = url.searchParams.get("externalSystem") ?? undefined;
  const externalId = url.searchParams.get("externalId") ?? undefined;

  return {
    ...(alias === undefined ? {} : { alias }),
    ...(externalSystem === undefined ? {} : { externalSystem }),
    ...(externalId === undefined ? {} : { externalId })
  };
}

function createIdentityResolutionFilter(url: URL): IdentityResolutionFilter {
  const subjectId = url.searchParams.get("subjectId") ?? undefined;
  const externalSystem = url.searchParams.get("externalSystem") ?? undefined;

  return {
    ...(subjectId === undefined ? {} : { subjectId }),
    ...(externalSystem === undefined ? {} : { externalSystem })
  };
}

function createSemanticEntityFilter(url: URL): SemanticEntityFilter {
  const types = nonEmptyQueryValues(url, "type");
  const evidenceRefs = nonEmptyQueryValues(url, "evidenceRef");

  return {
    ...(types.length === 0 ? {} : { types }),
    ...(evidenceRefs.length === 0 ? {} : { evidenceRefs })
  };
}

function createSemanticRelationshipFilter(url: URL): SemanticRelationshipFilter {
  const types = nonEmptyQueryValues(url, "type");
  const evidenceRefs = nonEmptyQueryValues(url, "evidenceRef");
  const entityId = url.searchParams.get("entityId") ?? undefined;

  return {
    ...(types.length === 0 ? {} : { types }),
    ...(evidenceRefs.length === 0 ? {} : { evidenceRefs }),
    ...(entityId === undefined ? {} : { entityId })
  };
}

function nonEmptyQueryValues(url: URL, key: string): string[] {
  return url.searchParams.getAll(key).filter((value) => value.length > 0);
}

function isMemoryEventKind(value: string): value is MemoryEventKind {
  return [
    "conversation",
    "decision",
    "execution",
    "approval",
    "rejection",
    "correction",
    "meeting",
    "failure"
  ].includes(value);
}

function isExperienceArtifactType(value: string): value is ExperienceArtifactType {
  return [
    "heuristic",
    "playbook",
    "anti_pattern",
    "decision_pattern",
    "risk_pattern"
  ].includes(value);
}

function isIdentityKind(value: string): value is IdentityKind {
  return ["human", "system", "organization", "provider"].includes(value);
}

function createRuntimeGoalTimeline(
  state: RuntimeState,
  goalId: string
): RuntimeTimelineEvent[] {
  return [
    ...(state.goalEvents.get(goalId) ?? []),
    ...state.executions
      .filter((execution) => execution.request.goalId === goalId)
      .flatMap((execution) =>
        execution.result.events.map((event) => ({
          ...event,
          goalId,
          occurredAt: execution.result.session.startedAt
        }))
      )
  ];
}

function json<TBody>(body: TBody, init: ResponseInit = {}): Response {
  return Response.json(body, init);
}
