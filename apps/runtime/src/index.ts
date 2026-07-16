import { createGoal, type CreateGoalInput, type Goal } from "@atlas-aios/agoe";
import {
  createCapabilityKernel,
  type CapabilityResolution,
  type CapabilityResolutionRequest,
  type ProviderCandidate
} from "@atlas-aios/capability-kernel";
import {
  createExecutionSession,
  runSequentialWorkflow,
  type ExecutionRunResult,
  type ExecuteWorkflowNodeResult
} from "@atlas-aios/execution-engine";
import {
  createUnknownBusinessBrowserUiFixture,
  createUnknownBusinessCreateResourceBenchmark,
  createUnknownBusinessSystemRestFixture,
  createUnknownBusinessSystemOpenApiFixture,
  type UnknownBusinessSystemRestFixture,
  learnOpenApiCapabilities
} from "@atlas-aios/learning";

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

export interface DispatchGoalScopedRuntimeCapabilityResponse {
  resolution: CapabilityResolution;
  execution: ExecutionRunResult;
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

interface RuntimeState {
  goals: Map<string, Goal>;
  capabilities: RuntimeCapabilityListItem[];
  providers: RuntimeProviderListItem[];
  executions: RuntimeExecutionRecord[];
  unknownBusinessRest: UnknownBusinessSystemRestFixture;
}

interface UnknownBusinessMvpFlowResult {
  response: UnknownBusinessMvpResponse;
  capabilities: RuntimeCapabilityListItem[];
  providers: RuntimeProviderListItem[];
}

export function createAtlasRuntime(): AtlasRuntime {
  const state: RuntimeState = {
    goals: new Map<string, Goal>(),
    capabilities: [],
    providers: [],
    executions: [],
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
    state.providers = result.providers;

    return json<UnknownBusinessMvpResponse>(result.response);
  }

  if (request.method === "POST" && url.pathname === "/goals") {
    const input = (await request.json()) as CreateRuntimeGoalRequest;
    const result = createGoal(input);
    state.goals.set(result.goal.id, result.goal);

    return json(result, { status: 201 });
  }

  if (request.method === "GET" && url.pathname === "/goals") {
    return json({
      goals: [...state.goals.values()].map(toGoalListItem)
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

    return json<DispatchGoalScopedRuntimeCapabilityResponse>(
      { resolution, execution },
      { status: 201 }
    );
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

  if (request.method === "GET" && url.pathname === "/providers") {
    return json({
      providers: state.providers
    });
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

function json<TBody>(body: TBody, init: ResponseInit = {}): Response {
  return Response.json(body, init);
}
