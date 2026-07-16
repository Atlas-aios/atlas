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

export function createAtlasRuntime(): AtlasRuntime {
  return {
    handle: async (request) => handleRuntimeRequest(request)
  };
}

async function handleRuntimeRequest(request: Request): Promise<Response> {
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
    return json<UnknownBusinessMvpResponse>(await runUnknownBusinessMvpFlow());
  }

  return json({ error: "not_found" }, { status: 404 });
}

async function runUnknownBusinessMvpFlow(): Promise<UnknownBusinessMvpResponse> {
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

  return {
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
  };
}

function extractBrowserCapabilities(html: string): string[] {
  return [...html.matchAll(/data-atlas-capability="([^"]+)"/g)].map(
    (match) => match[1] ?? ""
  );
}

function json<TBody>(body: TBody, init: ResponseInit = {}): Response {
  return Response.json(body, init);
}
