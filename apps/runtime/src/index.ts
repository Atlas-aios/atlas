import { createGoal, type CreateGoalInput, type Goal } from "@atlas-aios/agoe";
import {
  createCapabilityKernel,
  type CapabilityResolutionRequest,
  type ProviderCandidate
} from "@atlas-aios/capability-kernel";
import {
  createUnknownBusinessBrowserUiFixture,
  createUnknownBusinessCreateResourceBenchmark,
  createUnknownBusinessSystemOpenApiFixture,
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

interface RuntimeState {
  goals: Map<string, Goal>;
  capabilities: RuntimeCapabilityListItem[];
  providers: RuntimeProviderListItem[];
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
    providers: []
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
}): Promise<unknown> {
  const kernel = createCapabilityKernel({
    artifacts: [],
    providers: input.state.providers.map(toProviderCandidate)
  });

  return kernel.resolve(input.request);
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

function json<TBody>(body: TBody, init: ResponseInit = {}): Response {
  return Response.json(body, init);
}
