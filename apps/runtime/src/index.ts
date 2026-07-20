import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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
  BrainModelUnavailableError,
  InvalidBrainModelOutputError,
  generateModelBackedPlan,
  type AtlasPlan,
  type BrainPlanningModelProvider,
  type PlanningModelSelectionInput
} from "@atlas-aios/brain";
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
  createBrowserUiInterfaceDriver,
  createRestInterfaceDriver,
  type BrowserUiDriverRequest,
  type BrowserUiDriverResult,
  type RestDriverResult
} from "@atlas-aios/interface-drivers";
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
  simulateWorldState,
  type WorldStateSimulationEffect,
  type WorldStateSimulationResult,
  type WorldStateSimulationThresholds
} from "@atlas-aios/simulation-engine";
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
import { createAtlasFlow, type AtlasFlow } from "@atlas-aios/workflow-dsl";
import {
  createInMemoryWorldStateStore,
  createWorldStateSnapshot,
  recordWorldStateSnapshot,
  type OperationalBlocker,
  type WorldStateStore
} from "@atlas-aios/world-state";

import {
  PlanRunApprovalError,
  createPlanRunRequestFingerprint,
  resumePlanRun,
  startPlanRun,
  type PlanOrchestratorDependencies,
  type PlanRun,
  type StartPlanRunInput
} from "./plan-orchestrator.js";

export interface AtlasRuntime {
  handle(request: Request): Promise<Response>;
}

export interface RuntimeAuthConfig {
  apiKey: string;
  requireIdentity?: boolean;
}

export interface RuntimePersistence {
  load(): RuntimeStateSnapshot | undefined;
  save(snapshot: RuntimeStateSnapshot): void;
}

export interface CreateAtlasRuntimeOptions {
  auth?: RuntimeAuthConfig;
  persistence?: RuntimePersistence;
  brain?: RuntimeBrainConfig;
}

export interface RuntimeBrainConfig {
  allowRemoteModels: boolean;
  allowFreeHostedEndpoints: boolean;
  providers: Readonly<Record<string, BrainPlanningModelProvider | undefined>>;
}

export interface GenerateRuntimeBrainPlanRequest {
  goalId: string;
  taskClass: PlanningModelSelectionInput["taskClass"];
  difficulty: PlanningModelSelectionInput["difficulty"];
  privacyClass: PlanningModelSelectionInput["privacyClass"];
}

export type CreateRuntimePlanRunRequest = Omit<StartPlanRunInput, "plan">;

export interface ResumeRuntimePlanRunRequest {
  resumedAt: string;
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
  driverId: "driver:rest" | "driver:browser-ui";
  operationId: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path?: string;
  selector?: string;
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

export interface RuntimeThought {
  id: string;
  kind: "observation" | "decision_rationale" | "risk" | "plan" | "reflection";
  summary: string;
  createdAt: string;
  goalId?: string;
  evidenceRefs: string[];
}

export interface CreateRuntimeSimulationRequest {
  id: string;
  goalId?: string;
  capabilityId: string;
  providerId: string;
  inputs: Record<string, unknown>;
  predictedWorldStateEffects: WorldStateSimulationEffect[];
  thresholds?: WorldStateSimulationThresholds;
  createdAt: string;
}

export interface RuntimeSimulationRecord {
  id: string;
  status: "simulated" | "blocked" | "failed";
  goalId?: string;
  capabilityId: string;
  providerId: string;
  inputs: Record<string, unknown>;
  interfacePreviewStatus?: RestDriverResult["status"];
  requestPreview?: RestDriverResult["requestPreview"];
  events: RestDriverResult["events"];
  worldStateSimulation?: WorldStateSimulationResult;
  createdAt: string;
}

export interface RuntimeStateSnapshot {
  goals: Goal[];
  goalEvents: Array<[string, GoalLifecycleEvent[]]>;
  capabilities: RuntimeCapabilityListItem[];
  capabilityGraphs: RuntimeCapabilityGraph[];
  interfaceDrivers: RuntimeInterfaceDriverMapping[];
  providers: RuntimeProviderListItem[];
  learningReview: LearningGovernanceReview | null;
  learningPromotionDecisions: LearningPromotionDecision[];
  learningPromotionApprovals: Array<[string, ApproveRuntimeLearningPromotionRequest]>;
  executions: RuntimeExecutionRecord[];
  approvalRequests: RuntimeApprovalRequest[];
  cognitiveLoopCycles: CognitiveLoopCycle[];
  auditLogs: RuntimeAuditEvent[];
  workflows: AtlasFlow[];
  thoughts: RuntimeThought[];
  simulations: RuntimeSimulationRecord[];
  brainPlans?: AtlasPlan[];
  planRuns?: PlanRun[];
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
  workflows: AtlasFlow[];
  thoughts: RuntimeThought[];
  simulations: RuntimeSimulationRecord[];
  brainPlans: AtlasPlan[];
  planRuns: PlanRun[];
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

export function createFileRuntimePersistence(filePath: string): RuntimePersistence {
  return {
    load: () => {
      if (!existsSync(filePath)) {
        return undefined;
      }

      return JSON.parse(readFileSync(filePath, "utf8")) as RuntimeStateSnapshot;
    },
    save: (snapshot) => {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    }
  };
}

export function createAtlasRuntime(
  options: CreateAtlasRuntimeOptions = {}
): AtlasRuntime {
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
    workflows: [],
    thoughts: [],
    simulations: [],
    brainPlans: [],
    planRuns: [],
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
  const snapshot = options.persistence?.load();

  if (snapshot !== undefined) {
    restoreRuntimeStateSnapshot(state, snapshot);
  }

  return {
    handle: async (request) => {
      const authorizationFailure = authorizeRuntimeRequest(request, options.auth);

      if (authorizationFailure !== undefined) {
        return authorizationFailure;
      }

      const response = await handleRuntimeRequest(request, state, options.brain);

      if (shouldPersistRuntimeRequest(request, response)) {
        options.persistence?.save(createRuntimeStateSnapshot(state));
      }

      return response;
    }
  };
}

async function handleRuntimeRequest(
  request: Request,
  state: RuntimeState,
  brain: RuntimeBrainConfig | undefined
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return json<RuntimeHealthResponse>({
      service: "atlas-runtime",
      status: "ok"
    });
  }

  if (request.method === "POST" && url.pathname === "/brain/plan") {
    const input = (await request.json()) as unknown;

    if (!isGenerateRuntimeBrainPlanRequest(input)) {
      return json(
        {
          error: "invalid_brain_plan_request",
          reason:
            "goalId, taskClass, difficulty, and privacyClass are required and must use supported values."
        },
        { status: 400 }
      );
    }

    const goal = state.goals.get(input.goalId);
    if (goal === undefined) {
      return json({ error: "goal_not_found", goalId: input.goalId }, { status: 404 });
    }

    const planNumber =
      state.brainPlans.filter((plan) => plan.goalId === goal.id).length + 1;
    const planId = `plan:${goal.id}:${planNumber}`;

    try {
      const result = await generateModelBackedPlan({
        planId,
        goalId: goal.id,
        objective: `${goal.title}\n${goal.description}`,
        context: createRuntimeBrainPlanningContext(state, goal),
        routing: {
          taskClass: input.taskClass,
          difficulty: input.difficulty,
          privacyClass: input.privacyClass,
          allowRemoteModels: brain?.allowRemoteModels ?? false,
          allowFreeHostedEndpoints: brain?.allowFreeHostedEndpoints ?? false
        },
        providers: brain?.providers ?? {}
      });
      state.brainPlans.push(result.plan);
      state.auditLogs.push({
        id: `audit:brain-plan:${result.plan.id}`,
        type: "brain.plan.generated",
        actorId: request.headers.get("x-atlas-identity-id") ?? "identity:runtime",
        subjectId: goal.id,
        occurredAt: new Date().toISOString(),
        summary: `Brain generated plan ${result.plan.id} using ${result.modelSelection.selectedProfileId}.`,
        evidenceRefs: [
          result.plan.id,
          ...(result.providerRequestId === undefined ? [] : [result.providerRequestId])
        ],
        metadata: {
          modelProfileId: result.modelSelection.selectedProfileId,
          modelLane: result.modelSelection.lane
        }
      });

      return json(result);
    } catch (error) {
      if (error instanceof BrainModelUnavailableError) {
        return json(
          {
            error: error.code,
            modelProfileId: error.modelProfileId,
            reason: error.message
          },
          { status: 503 }
        );
      }

      if (error instanceof InvalidBrainModelOutputError) {
        return json({ error: error.code, reason: error.message }, { status: 502 });
      }

      return json(
        {
          error: "model_provider_failed",
          reason: error instanceof Error ? error.message : "Model provider failed."
        },
        { status: 502 }
      );
    }
  }

  const planRunStartMatch = /^\/brain\/plans\/(.+)\/run$/.exec(url.pathname);
  if (request.method === "POST" && planRunStartMatch !== null) {
    const planId = decodeURIComponent(planRunStartMatch[1] ?? "");
    const plan = state.brainPlans.find((item) => item.id === planId);
    if (plan === undefined) {
      return json({ error: "brain_plan_not_found", planId }, { status: 404 });
    }

    const input = (await request.json()) as unknown;
    if (!isCreateRuntimePlanRunRequest(input, plan)) {
      return json(
        {
          error: "invalid_plan_run_request",
          reason:
            "The run must declare identity, authority, governance context, timestamp, and valid inputs and policy for every plan step."
        },
        { status: 400 }
      );
    }
    const requestFingerprint = createPlanRunRequestFingerprint({ ...input, plan });
    const existingRun = state.planRuns.find((run) => run.id === input.id);
    if (existingRun !== undefined) {
      if (
        existingRun.planId !== plan.id ||
        existingRun.requestFingerprint !== requestFingerprint
      ) {
        return json(
          {
            error: "plan_run_conflict",
            planRunId: input.id,
            existingPlanId: existingRun.planId
          },
          { status: 409 }
        );
      }

      return json({ planRun: existingRun });
    }

    try {
      const planRun = await startPlanRun(
        { ...input, plan },
        createRuntimePlanOrchestratorDependencies(state)
      );
      state.planRuns.push(planRun);
      recordRuntimePlanRunEvidence(state, planRun, "started");

      return json({ planRun }, { status: 201 });
    } catch (error) {
      return json(
        {
          error: "plan_run_failed",
          reason: error instanceof Error ? error.message : "Plan run failed."
        },
        { status: 422 }
      );
    }
  }

  const planRunResumeMatch = /^\/brain\/plan-runs\/(.+)\/resume$/.exec(url.pathname);
  if (request.method === "POST" && planRunResumeMatch !== null) {
    const planRunId = decodeURIComponent(planRunResumeMatch[1] ?? "");
    const planRun = state.planRuns.find((run) => run.id === planRunId);
    if (planRun === undefined) {
      return json({ error: "plan_run_not_found", planRunId }, { status: 404 });
    }

    const plan = state.brainPlans.find((item) => item.id === planRun.planId);
    if (plan === undefined) {
      return json(
        { error: "brain_plan_not_found", planId: planRun.planId },
        { status: 404 }
      );
    }

    const input = (await request.json()) as unknown;
    if (!isRuntimeRecord(input) || !isNonEmptyRuntimeString(input.resumedAt)) {
      return json(
        {
          error: "invalid_plan_run_resume_request",
          reason: "resumedAt is required."
        },
        { status: 400 }
      );
    }
    const approvedApprovalRequestIds = planRun.steps.flatMap((step) =>
      step.approvalRequestId !== undefined &&
      state.approvalRequests.some(
        (approval) =>
          approval.id === step.approvalRequestId && approval.status === "approved"
      )
        ? [step.approvalRequestId]
        : []
    );

    try {
      const resumedRun = await resumePlanRun(
        {
          run: planRun,
          plan,
          approvedApprovalRequestIds,
          resumedAt: input.resumedAt
        },
        createRuntimePlanOrchestratorDependencies(state)
      );
      state.planRuns = state.planRuns.map((item) =>
        item.id === planRunId ? resumedRun : item
      );
      recordRuntimePlanRunEvidence(state, resumedRun, "resumed");

      return json({ planRun: resumedRun });
    } catch (error) {
      if (error instanceof PlanRunApprovalError) {
        return json(
          {
            error: error.code,
            approvalRequestId: error.approvalRequestId,
            reason: error.message
          },
          { status: 409 }
        );
      }

      return json(
        {
          error: "plan_run_resume_failed",
          reason: error instanceof Error ? error.message : "Plan run resume failed."
        },
        { status: 422 }
      );
    }
  }

  const planRunDetailMatch = /^\/brain\/plan-runs\/(.+)$/.exec(url.pathname);
  if (request.method === "GET" && planRunDetailMatch !== null) {
    const planRunId = decodeURIComponent(planRunDetailMatch[1] ?? "");
    const planRun = state.planRuns.find((run) => run.id === planRunId);

    return planRun === undefined
      ? json({ error: "plan_run_not_found", planRunId }, { status: 404 })
      : json({ planRun });
  }

  if (request.method === "POST" && url.pathname === "/workflows") {
    try {
      const workflow = createAtlasFlow((await request.json()) as AtlasFlow);
      state.workflows = [
        ...state.workflows.filter((item) => item.id !== workflow.id),
        workflow
      ];

      return json({ workflow }, { status: 201 });
    } catch (error) {
      return json(
        {
          error: "invalid_workflow",
          reason: error instanceof Error ? error.message : "Workflow validation failed."
        },
        { status: 400 }
      );
    }
  }

  if (request.method === "GET" && url.pathname === "/workflows") {
    return json({
      workflows: state.workflows
    });
  }

  const workflowDetailMatch = /^\/workflows\/(.+)$/.exec(url.pathname);
  if (request.method === "GET" && workflowDetailMatch !== null) {
    const workflowId = decodeURIComponent(workflowDetailMatch[1] ?? "");
    const workflow = state.workflows.find((item) => item.id === workflowId);

    if (workflow === undefined) {
      return json({ error: "workflow_not_found", workflowId }, { status: 404 });
    }

    return json({ workflow });
  }

  if (request.method === "POST" && url.pathname === "/thoughts") {
    const thought = (await request.json()) as RuntimeThought;
    state.thoughts = [
      ...state.thoughts.filter((item) => item.id !== thought.id),
      {
        ...thought,
        evidenceRefs: [...thought.evidenceRefs]
      }
    ];

    return json({ thought }, { status: 201 });
  }

  if (request.method === "GET" && url.pathname === "/thoughts") {
    const goalId = url.searchParams.get("goalId");

    return json({
      thoughts:
        goalId === null
          ? state.thoughts
          : state.thoughts.filter((thought) => thought.goalId === goalId)
    });
  }

  if (request.method === "POST" && url.pathname === "/simulations") {
    const input = (await request.json()) as unknown;
    if (!isCreateRuntimeSimulationRequest(input)) {
      return json(
        {
          error: "invalid_simulation_request",
          reason:
            "Simulation requires identity fields, inputs, timestamp, and explicit predicted World State effects."
        },
        { status: 400 }
      );
    }
    const simulation = await simulateRuntimeProvider(state, input);
    state.simulations = [
      ...state.simulations.filter((item) => item.id !== simulation.id),
      simulation
    ];

    return json({ simulation }, { status: 201 });
  }

  if (request.method === "GET" && url.pathname === "/simulations") {
    return json({
      simulations: state.simulations
    });
  }

  if (
    request.method === "POST" &&
    url.pathname === "/interface-drivers/browser-ui/execute"
  ) {
    const input = (await request.json()) as BrowserUiDriverRequest;

    return json({
      result: await executeRuntimeBrowserUiDriver(input)
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

  if (request.method === "GET" && url.pathname === "/approvals") {
    return json({
      approvals: state.approvalRequests
    });
  }

  const approvalAliasDecisionMatch = /^\/approvals\/(.+)\/(approve|reject)$/.exec(
    url.pathname
  );
  if (request.method === "POST" && approvalAliasDecisionMatch !== null) {
    return decideRuntimeApprovalRequest(state, approvalAliasDecisionMatch, request);
  }

  const approvalDecisionMatch = /^\/approval-requests\/(.+)\/(approve|reject)$/.exec(
    url.pathname
  );
  if (request.method === "POST" && approvalDecisionMatch !== null) {
    return decideRuntimeApprovalRequest(state, approvalDecisionMatch, request);
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

function authorizeRuntimeRequest(
  request: Request,
  auth: RuntimeAuthConfig | undefined
): Response | undefined {
  if (auth === undefined || isRuntimeAuthExempt(request)) {
    return undefined;
  }

  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const apiKey = request.headers.get("x-atlas-api-key") ?? bearerToken;

  if (apiKey !== auth.apiKey) {
    return json(
      {
        error: "unauthorized",
        reason: "Missing or invalid Atlas runtime API key."
      },
      { status: 401 }
    );
  }

  if (
    auth.requireIdentity === true &&
    request.headers.get("x-atlas-identity-id") === null
  ) {
    return json(
      {
        error: "unauthorized",
        reason: "Missing Atlas runtime identity."
      },
      { status: 401 }
    );
  }

  return undefined;
}

function isRuntimeAuthExempt(request: Request): boolean {
  const url = new URL(request.url);

  return request.method === "GET" && url.pathname === "/health";
}

function isGenerateRuntimeBrainPlanRequest(
  value: unknown
): value is GenerateRuntimeBrainPlanRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const input = value as Record<string, unknown>;
  return (
    typeof input.goalId === "string" &&
    input.goalId.length > 0 &&
    isOneOf(input.taskClass, [
      "routine",
      "planning",
      "architecture",
      "governance-review",
      "hard-debugging",
      "research-synthesis"
    ]) &&
    isOneOf(input.difficulty, ["low", "medium", "high", "critical"]) &&
    isOneOf(input.privacyClass, ["public", "internal", "private", "confidential"])
  );
}

function isCreateRuntimePlanRunRequest(
  value: unknown,
  plan: AtlasPlan
): value is CreateRuntimePlanRunRequest {
  if (!isRuntimeRecord(value) || !isRuntimeRecord(value.steps)) {
    return false;
  }
  const stepPolicies = value.steps;

  if (
    !isNonEmptyRuntimeString(value.id) ||
    !isNonEmptyRuntimeString(value.requesterIdentityId) ||
    !isOneOf(value.authorityMode, ["broad", "trusted", "restricted"]) ||
    !isNonEmptyRuntimeString(value.governanceContextId) ||
    !isNonEmptyRuntimeString(value.startedAt)
  ) {
    return false;
  }

  return plan.steps.every((step) => {
    const policy = stepPolicies[step.id];
    if (!isRuntimeRecord(policy) || !isRuntimeRecord(policy.inputs)) {
      return false;
    }

    return (
      isOneOf(policy.reversibility, [
        "reversible",
        "partially_reversible",
        "irreversible"
      ]) &&
      Array.isArray(policy.externalImpacts) &&
      policy.externalImpacts.every((impact) =>
        isOneOf(impact, [
          "money",
          "production_system",
          "legal_commitment",
          "private_data",
          "public_communication",
          "destructive_action",
          "privilege_escalation",
          "real_desktop_control"
        ])
      ) &&
      Array.isArray(policy.predictedWorldStateEffects) &&
      policy.predictedWorldStateEffects.every(isWorldStateSimulationEffect)
    );
  });
}

function isCreateRuntimeSimulationRequest(
  value: unknown
): value is CreateRuntimeSimulationRequest {
  if (!isRuntimeRecord(value)) {
    return false;
  }

  return (
    isNonEmptyRuntimeString(value.id) &&
    (value.goalId === undefined || isNonEmptyRuntimeString(value.goalId)) &&
    isNonEmptyRuntimeString(value.capabilityId) &&
    isNonEmptyRuntimeString(value.providerId) &&
    isRuntimeRecord(value.inputs) &&
    isNonEmptyRuntimeString(value.createdAt) &&
    Array.isArray(value.predictedWorldStateEffects) &&
    value.predictedWorldStateEffects.every(isWorldStateSimulationEffect) &&
    (value.thresholds === undefined ||
      isWorldStateSimulationThresholds(value.thresholds))
  );
}

function isWorldStateSimulationEffect(
  value: unknown
): value is WorldStateSimulationEffect {
  if (!isRuntimeRecord(value) || !isNonEmptyRuntimeString(value.type)) {
    return false;
  }

  switch (value.type) {
    case "add_active_goal":
    case "remove_active_goal":
      return isNonEmptyRuntimeString(value.goalId);
    case "add_active_execution":
    case "remove_active_execution":
      return isNonEmptyRuntimeString(value.executionId);
    case "remove_blocker":
      return isNonEmptyRuntimeString(value.blockerId);
    case "add_blocker":
      return (
        isRuntimeRecord(value.blocker) &&
        isNonEmptyRuntimeString(value.blocker.id) &&
        isNonEmptyRuntimeString(value.blocker.summary) &&
        isOneOf(value.blocker.severity, ["low", "medium", "high", "critical"]) &&
        (value.blocker.ownerId === undefined ||
          isNonEmptyRuntimeString(value.blocker.ownerId))
      );
    default:
      return false;
  }
}

function isWorldStateSimulationThresholds(
  value: unknown
): value is WorldStateSimulationThresholds {
  if (!isRuntimeRecord(value)) {
    return false;
  }

  return [value.maximumBlockers, value.maximumCriticalBlockers].every(
    (threshold) =>
      threshold === undefined ||
      (typeof threshold === "number" && Number.isInteger(threshold) && threshold >= 0)
  );
}

function isRuntimeRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyRuntimeString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function createRuntimeBrainPlanningContext(state: RuntimeState, goal: Goal): string[] {
  const goalContext = [
    `Goal owner: ${goal.ownerId}. Priority: ${goal.priority}. Status: ${goal.status}.`,
    `Success criteria: ${goal.successCriteria.join("; ")}`
  ];
  const capabilityContext = state.capabilities
    .slice(0, 20)
    .map(
      (capability) =>
        `Available capability ${capability.id} (${capability.name}) has confidence ${capability.confidence}.`
    );
  const blockerContext = createRuntimeOperationalBlockers(state).map(
    (blocker) =>
      `Operational blocker ${blocker.id} has severity ${blocker.severity}: ${blocker.summary}`
  );

  return [...goalContext, ...capabilityContext, ...blockerContext];
}

function shouldPersistRuntimeRequest(request: Request, response: Response): boolean {
  return request.method !== "GET" && request.method !== "HEAD" && response.status < 500;
}

function createRuntimeStateSnapshot(state: RuntimeState): RuntimeStateSnapshot {
  return {
    goals: [...state.goals.values()],
    goalEvents: [...state.goalEvents.entries()],
    capabilities: state.capabilities,
    capabilityGraphs: state.capabilityGraphs,
    interfaceDrivers: state.interfaceDrivers,
    providers: state.providers,
    learningReview: state.learningReview,
    learningPromotionDecisions: state.learningPromotionDecisions,
    learningPromotionApprovals: [...state.learningPromotionApprovals.entries()],
    executions: state.executions,
    approvalRequests: state.approvalRequests,
    cognitiveLoopCycles: state.cognitiveLoopCycles,
    auditLogs: state.auditLogs,
    workflows: state.workflows,
    thoughts: state.thoughts,
    simulations: state.simulations,
    brainPlans: state.brainPlans,
    planRuns: state.planRuns
  };
}

function restoreRuntimeStateSnapshot(
  state: RuntimeState,
  snapshot: RuntimeStateSnapshot
): void {
  state.goals = new Map(snapshot.goals.map((goal) => [goal.id, goal]));
  state.goalEvents = new Map(snapshot.goalEvents);
  state.capabilities = snapshot.capabilities;
  state.capabilityGraphs = snapshot.capabilityGraphs;
  state.interfaceDrivers = snapshot.interfaceDrivers;
  state.providers = snapshot.providers;
  state.learningReview = snapshot.learningReview;
  state.learningPromotionDecisions = snapshot.learningPromotionDecisions;
  state.learningPromotionApprovals = new Map(snapshot.learningPromotionApprovals);
  state.executions = snapshot.executions;
  state.approvalRequests = snapshot.approvalRequests;
  state.cognitiveLoopCycles = snapshot.cognitiveLoopCycles;
  state.auditLogs = snapshot.auditLogs;
  state.workflows = snapshot.workflows ?? [];
  state.thoughts = snapshot.thoughts ?? [];
  state.simulations = snapshot.simulations ?? [];
  state.brainPlans = snapshot.brainPlans ?? [];
  state.planRuns = snapshot.planRuns ?? [];
}

function createRuntimePlanOrchestratorDependencies(
  state: RuntimeState
): PlanOrchestratorDependencies {
  return {
    resolveCapability: (request) => resolveRuntimeCapability({ state, request }),
    simulateStep: async (input) => {
      const simulation = await simulateRuntimeProvider(state, {
        id: `simulation:${input.runId}:${input.stepId}`,
        goalId: input.goalId,
        capabilityId: input.capabilityId,
        providerId: input.providerId,
        inputs: input.inputs,
        predictedWorldStateEffects: input.predictedWorldStateEffects,
        createdAt: input.startedAt
      });
      state.simulations = [
        ...state.simulations.filter((item) => item.id !== simulation.id),
        simulation
      ];

      return {
        id: simulation.id,
        status: simulation.status,
        evidenceRefs: [
          simulation.id,
          ...simulation.events.map(
            (event, index) => `${simulation.id}:event:${index + 1}:${event.type}`
          )
        ]
      };
    },
    requestApproval: ({ runId, goalId, governanceContextId, step, requestedAt }) => {
      const approvalRequest = createRuntimeApprovalRequest({
        goalId,
        capabilityId: step.capabilityId,
        providerId: step.providerId,
        executionId: `${runId}:${step.stepId}`,
        governanceContextId,
        requestedAt,
        reason:
          step.resolution.approvalReason ??
          step.decision.rationale ??
          "Plan step requires approval."
      });
      state.approvalRequests.push(approvalRequest);
      return approvalRequest.id;
    },
    executeCapability: async ({ node }) =>
      executeRuntimeProvider(
        state,
        requiredStringRuntimeInput(node.inputs, "providerId"),
        requiredStringRuntimeInput(node.inputs, "capabilityId"),
        requiredRecordRuntimeInput(node.inputs, "inputs")
      )
  };
}

function recordRuntimePlanRunEvidence(
  state: RuntimeState,
  planRun: PlanRun,
  phase: "started" | "resumed"
): void {
  const occurredAt =
    phase === "resumed"
      ? (planRun.execution?.session.startedAt ?? planRun.startedAt)
      : planRun.startedAt;
  const evidenceRefs = [
    planRun.planId,
    ...planRun.steps.flatMap((step) => [
      step.decision.requestId,
      ...(step.simulation?.evidenceRefs ?? []),
      ...(step.approvalRequestId === undefined ? [] : [step.approvalRequestId])
    ]),
    ...(planRun.execution?.steps.flatMap((step) => step.evidenceRefs) ?? [])
  ];
  state.auditLogs.push({
    id: `audit:plan-run:${planRun.id}:${phase}`,
    type: `brain.plan-run.${phase}`,
    actorId: planRun.requesterIdentityId,
    subjectId: planRun.id,
    occurredAt,
    summary: `Plan run ${planRun.id} ${phase} with status ${planRun.status}.`,
    evidenceRefs,
    metadata: {
      planId: planRun.planId,
      goalId: planRun.goalId,
      status: planRun.status
    }
  });
  recordMemoryEvent(state.memoryStore, {
    id: `memory:event:plan-run:${planRun.id}:${phase}`,
    kind: phase === "resumed" ? "execution" : "decision",
    occurredAt,
    summary: `Plan run ${planRun.id} ${phase} with status ${planRun.status}.`,
    subjectIds: [planRun.goalId, planRun.planId, planRun.id],
    sourceIds: evidenceRefs,
    evidenceRefs,
    metadata: {
      status: planRun.status,
      phase
    }
  });
}

async function simulateRuntimeProvider(
  state: RuntimeState,
  input: CreateRuntimeSimulationRequest
): Promise<RuntimeSimulationRecord> {
  if (
    !state.providers.some(
      (provider) =>
        provider.providerId === input.providerId &&
        provider.capabilityId === input.capabilityId
    )
  ) {
    return {
      id: input.id,
      ...(input.goalId === undefined ? {} : { goalId: input.goalId }),
      status: "blocked",
      capabilityId: input.capabilityId,
      providerId: input.providerId,
      inputs: input.inputs,
      interfacePreviewStatus: "blocked",
      events: [],
      createdAt: input.createdAt
    };
  }

  const restRequest = runtimeProviderRestRequest(input.providerId, input.inputs);
  const driver = createRestInterfaceDriver({
    transport: async () => ({
      status: 204,
      headers: {},
      body: {}
    })
  });
  const result = await driver.execute({
    operationId: input.providerId,
    method: restRequest.method,
    url: `atlas-fixture://unknown-business${restRequest.path}`,
    body: restRequest.body,
    requiredPermissions: ["network"],
    grantedPermissions: ["network"],
    simulation: true
  });

  if (result.status !== "simulated") {
    return {
      id: input.id,
      ...(input.goalId === undefined ? {} : { goalId: input.goalId }),
      status: result.status === "blocked" ? "blocked" : "failed",
      capabilityId: input.capabilityId,
      providerId: input.providerId,
      inputs: { ...input.inputs },
      interfacePreviewStatus: result.status,
      ...(result.requestPreview === undefined
        ? {}
        : { requestPreview: result.requestPreview }),
      events: result.events,
      createdAt: input.createdAt
    };
  }

  const sourceSnapshot = recordWorldStateSnapshot(
    state.worldStateStore,
    createRuntimeWorldStateSnapshot(state, input.createdAt)
  );
  const worldStateSimulation = simulateWorldState({
    id: `${input.id}:world-state`,
    simulatedAt: input.createdAt,
    source: sourceSnapshot,
    effects: input.predictedWorldStateEffects,
    ...(input.thresholds === undefined ? {} : { thresholds: input.thresholds })
  });

  return {
    id: input.id,
    ...(input.goalId === undefined ? {} : { goalId: input.goalId }),
    status:
      worldStateSimulation.status === "passed"
        ? "simulated"
        : worldStateSimulation.status,
    capabilityId: input.capabilityId,
    providerId: input.providerId,
    inputs: { ...input.inputs },
    interfacePreviewStatus: result.status,
    ...(result.requestPreview === undefined
      ? {}
      : { requestPreview: result.requestPreview }),
    events: result.events,
    worldStateSimulation,
    createdAt: input.createdAt
  };
}

async function executeRuntimeBrowserUiDriver(
  request: BrowserUiDriverRequest
): Promise<BrowserUiDriverResult> {
  const html = createUnknownBusinessBrowserUiFixture().render();
  const driver = createBrowserUiInterfaceDriver({
    surface: {
      click: (selector) => readRuntimeBrowserElement(html, selector),
      fill: (selector, value) => ({
        ...readRuntimeBrowserElement(html, selector),
        value
      }),
      read: (selector) => readRuntimeBrowserElement(html, selector)
    }
  });

  return driver.execute(request);
}

function readRuntimeBrowserElement(html: string, selector: string) {
  const capabilityMatch = /^\[data-atlas-capability="([^"]+)"\]$/.exec(selector);

  if (capabilityMatch !== null) {
    const capabilityId = capabilityMatch[1] ?? "";

    return {
      selector,
      matched: html.includes(`data-atlas-capability="${capabilityId}"`),
      capabilityId
    };
  }

  return {
    selector,
    matched: selector === "main" ? html.includes("<main") : html.includes(selector),
    html
  };
}

async function decideRuntimeApprovalRequest(
  state: RuntimeState,
  match: RegExpExecArray,
  request: Request
): Promise<Response> {
  const approvalRequestId = decodeURIComponent(match[1] ?? "");
  const decision = match[2] === "approve" ? "approved" : "rejected";
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
      simulationIds: state.simulations
        .filter(
          (simulation) =>
            simulation.status === "simulated" &&
            (input.goalId === undefined || simulation.goalId === input.goalId)
        )
        .map((simulation) => simulation.id),
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
      ]),
      ...cycle.observations.simulationIds
    ],
    evidenceRefs: [
      ...cycle.nextAction.targetRefs,
      ...optionalRuntimeRefs([
        cycle.observations.worldStateSnapshotId,
        cycle.observations.selfModelSnapshotId
      ]),
      ...cycle.observations.simulationIds
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
