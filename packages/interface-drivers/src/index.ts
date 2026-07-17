export type InterfaceDriverKind =
  | "rest"
  | "graphql"
  | "grpc"
  | "mcp"
  | "browser_ui"
  | "desktop_ui"
  | "cli"
  | "sdk"
  | "database"
  | "filesystem"
  | "local_os"
  | "ipc"
  | "message_queue"
  | "human";

export interface InterfaceDriverManifest {
  id: string;
  kind: InterfaceDriverKind;
  permissions: string[];
  supportedOperations: string[];
}

export type RestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type OpenApiMethod = Lowercase<RestMethod>;

export type OpenApiCapabilityLevel = "L0" | "L1" | "L2" | "L3" | "L4";

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
}

export type OpenApiPathItem = Partial<Record<OpenApiMethod, OpenApiOperation>>;

export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, OpenApiPathItem>;
}

export interface OpenApiCapabilityNode {
  id: string;
  schemaVersion: "0.1";
  name: string;
  level: OpenApiCapabilityLevel;
  confidence: number;
  sourceRefs: string[];
}

export interface OpenApiCapabilityEdge {
  fromCapabilityId: string;
  toCapabilityId: string;
  relationship: "requires" | "composes" | "fallbacks_to";
}

export interface OpenApiDraftCapabilityGraph {
  id: string;
  schemaVersion: "0.1";
  status: "draft";
  generatedAt: string;
  nodes: OpenApiCapabilityNode[];
  edges: OpenApiCapabilityEdge[];
}

export interface OpenApiDriverMapping {
  capabilityId: string;
  driverId: "driver:rest";
  operationId: string;
  method: RestMethod;
  path: string;
  requiredPermissions: string[];
}

export interface IngestOpenApiDocumentInput {
  graphId: string;
  generatedAt: string;
  document: OpenApiDocument;
}

export interface IngestOpenApiDocumentResult {
  graph: OpenApiDraftCapabilityGraph;
  driverMappings: OpenApiDriverMapping[];
}

export interface RestDriverRequest {
  operationId: string;
  method: RestMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  requiredPermissions: string[];
  grantedPermissions: string[];
  simulation?: boolean;
}

export interface RestDriverTransportRequest {
  method: RestMethod;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface RestDriverResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export type InterfaceDriverEventType =
  | "interface-driver.request.started"
  | "interface-driver.request.completed"
  | "interface-driver.request.simulated"
  | "interface-driver.request.blocked"
  | "interface-driver.request.failed";

export interface InterfaceDriverEvent {
  type: InterfaceDriverEventType;
  driverId: string;
  operationId: string;
}

export type InterfaceDriverExecutionStatus =
  | "completed"
  | "simulated"
  | "blocked"
  | "failed";

export interface RestDriverResult {
  status: InterfaceDriverExecutionStatus;
  response?: RestDriverResponse;
  requestPreview?: RestDriverTransportRequest;
  error?: string;
  events: InterfaceDriverEvent[];
}

export type BrowserUiAction = "click" | "fill" | "read";

export interface BrowserUiDriverRequest {
  operationId: string;
  action: BrowserUiAction;
  selector: string;
  value?: string;
  requiredPermissions: string[];
  grantedPermissions: string[];
  simulation?: boolean;
}

export interface BrowserUiRequestPreview {
  action: BrowserUiAction;
  selector: string;
  value?: string;
}

export interface BrowserUiDriverResult {
  status: InterfaceDriverExecutionStatus;
  output?: unknown;
  requestPreview?: BrowserUiRequestPreview;
  error?: string;
  events: InterfaceDriverEvent[];
}

export type RestDriverTransport = (
  request: RestDriverTransportRequest
) => Promise<RestDriverResponse> | RestDriverResponse;

export interface BrowserUiSurface {
  click(selector: string): Promise<unknown> | unknown;
  fill(selector: string, value: string): Promise<unknown> | unknown;
  read(selector: string): Promise<unknown> | unknown;
}

export interface RestInterfaceDriver {
  manifest: InterfaceDriverManifest;
  execute(request: RestDriverRequest): Promise<RestDriverResult>;
}

export interface BrowserUiInterfaceDriver {
  manifest: InterfaceDriverManifest;
  execute(request: BrowserUiDriverRequest): Promise<BrowserUiDriverResult>;
}

export interface CreateRestInterfaceDriverInput {
  transport: RestDriverTransport;
}

export interface CreateBrowserUiInterfaceDriverInput {
  surface: BrowserUiSurface;
}

export function createRestInterfaceDriver(
  input: CreateRestInterfaceDriverInput
): RestInterfaceDriver {
  const manifest: InterfaceDriverManifest = {
    id: "driver:rest",
    kind: "rest",
    permissions: ["network"],
    supportedOperations: ["request"]
  };

  return {
    manifest,
    execute: async (request) => executeRestRequest(manifest, input.transport, request)
  };
}

export function createBrowserUiInterfaceDriver(
  input: CreateBrowserUiInterfaceDriverInput
): BrowserUiInterfaceDriver {
  const manifest: InterfaceDriverManifest = {
    id: "driver:browser-ui",
    kind: "browser_ui",
    permissions: ["browser_ui:read", "browser_ui:write"],
    supportedOperations: ["click", "fill", "read"]
  };

  return {
    manifest,
    execute: async (request) =>
      executeBrowserUiRequest(manifest, input.surface, request)
  };
}

export function ingestOpenApiDocument(
  input: IngestOpenApiDocumentInput
): IngestOpenApiDocumentResult {
  const operations = extractOpenApiOperations(input.document);
  const nodes = operations.map((operation) => ({
    id: operation.capabilityId,
    schemaVersion: "0.1" as const,
    name: operation.name,
    level: "L2" as const,
    confidence: confidenceForOpenApiOperation(operation.method),
    sourceRefs: [`openapi:${operation.method} ${operation.path}`]
  }));
  const driverMappings = operations.map((operation) => ({
    capabilityId: operation.capabilityId,
    driverId: "driver:rest" as const,
    operationId: operation.operationId,
    method: operation.method,
    path: operation.path,
    requiredPermissions: ["network"]
  }));

  return {
    graph: {
      id: input.graphId,
      schemaVersion: "0.1",
      status: "draft",
      generatedAt: input.generatedAt,
      nodes,
      edges: []
    },
    driverMappings
  };
}

async function executeRestRequest(
  manifest: InterfaceDriverManifest,
  transport: RestDriverTransport,
  request: RestDriverRequest
): Promise<RestDriverResult> {
  const startedEvent = createDriverEvent(
    "interface-driver.request.started",
    manifest.id,
    request.operationId
  );
  const missingPermissions = request.requiredPermissions.filter(
    (permission) => !request.grantedPermissions.includes(permission)
  );

  if (missingPermissions.length > 0) {
    return {
      status: "blocked",
      error: `Missing driver permissions: ${missingPermissions.join(", ")}`,
      events: [
        startedEvent,
        createDriverEvent(
          "interface-driver.request.blocked",
          manifest.id,
          request.operationId
        )
      ]
    };
  }

  const transportRequest = toTransportRequest(request);

  if (request.simulation === true) {
    return {
      status: "simulated",
      requestPreview: transportRequest,
      events: [
        startedEvent,
        createDriverEvent(
          "interface-driver.request.simulated",
          manifest.id,
          request.operationId
        )
      ]
    };
  }

  try {
    return {
      status: "completed",
      response: await transport(transportRequest),
      events: [
        startedEvent,
        createDriverEvent(
          "interface-driver.request.completed",
          manifest.id,
          request.operationId
        )
      ]
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "REST driver request failed",
      events: [
        startedEvent,
        createDriverEvent(
          "interface-driver.request.failed",
          manifest.id,
          request.operationId
        )
      ]
    };
  }
}

async function executeBrowserUiRequest(
  manifest: InterfaceDriverManifest,
  surface: BrowserUiSurface,
  request: BrowserUiDriverRequest
): Promise<BrowserUiDriverResult> {
  const startedEvent = createDriverEvent(
    "interface-driver.request.started",
    manifest.id,
    request.operationId
  );
  const missingPermissions = request.requiredPermissions.filter(
    (permission) => !request.grantedPermissions.includes(permission)
  );

  if (missingPermissions.length > 0) {
    return {
      status: "blocked",
      error: `Missing driver permissions: ${missingPermissions.join(", ")}`,
      events: [
        startedEvent,
        createDriverEvent(
          "interface-driver.request.blocked",
          manifest.id,
          request.operationId
        )
      ]
    };
  }

  const requestPreview = toBrowserUiRequestPreview(request);

  if (request.simulation === true) {
    return {
      status: "simulated",
      requestPreview,
      events: [
        startedEvent,
        createDriverEvent(
          "interface-driver.request.simulated",
          manifest.id,
          request.operationId
        )
      ]
    };
  }

  try {
    return {
      status: "completed",
      output: await executeBrowserUiSurfaceAction(surface, request),
      events: [
        startedEvent,
        createDriverEvent(
          "interface-driver.request.completed",
          manifest.id,
          request.operationId
        )
      ]
    };
  } catch (error) {
    return {
      status: "failed",
      error:
        error instanceof Error ? error.message : "Browser UI driver request failed",
      events: [
        startedEvent,
        createDriverEvent(
          "interface-driver.request.failed",
          manifest.id,
          request.operationId
        )
      ]
    };
  }
}

function toTransportRequest(request: RestDriverRequest): RestDriverTransportRequest {
  return {
    method: request.method,
    url: request.url,
    headers: request.headers ?? {},
    ...(request.body === undefined ? {} : { body: request.body })
  };
}

function toBrowserUiRequestPreview(
  request: BrowserUiDriverRequest
): BrowserUiRequestPreview {
  return {
    action: request.action,
    selector: request.selector,
    ...(request.value === undefined ? {} : { value: request.value })
  };
}

async function executeBrowserUiSurfaceAction(
  surface: BrowserUiSurface,
  request: BrowserUiDriverRequest
): Promise<unknown> {
  switch (request.action) {
    case "click":
      return surface.click(request.selector);
    case "fill":
      return surface.fill(request.selector, request.value ?? "");
    case "read":
      return surface.read(request.selector);
  }
}

function createDriverEvent(
  type: InterfaceDriverEventType,
  driverId: string,
  operationId: string
): InterfaceDriverEvent {
  return {
    type,
    driverId,
    operationId
  };
}

interface ExtractedOpenApiOperation {
  capabilityId: string;
  operationId: string;
  name: string;
  method: RestMethod;
  path: string;
}

function extractOpenApiOperations(
  document: OpenApiDocument
): ExtractedOpenApiOperation[] {
  return Object.entries(document.paths).flatMap(([path, pathItem]) =>
    Object.entries(pathItem).map(([method, operation]) =>
      toExtractedOpenApiOperation(path, method as OpenApiMethod, operation)
    )
  );
}

function toExtractedOpenApiOperation(
  path: string,
  method: OpenApiMethod,
  operation: OpenApiOperation | undefined
): ExtractedOpenApiOperation {
  const operationId = operation?.operationId ?? fallbackOperationId(method, path);
  const name = operation?.summary ?? titleCase(operationIdToWords(operationId));

  return {
    capabilityId: `capability:${slugify(operationIdToWords(operationId))}`,
    operationId,
    name,
    method: method.toUpperCase() as RestMethod,
    path
  };
}

function fallbackOperationId(method: OpenApiMethod, path: string): string {
  const pathName = path
    .split("/")
    .filter((part) => part.length > 0)
    .map((part) => part.replace(/[{}]/g, ""))
    .join("-");

  return `${method}-${pathName}`;
}

function operationIdToWords(operationId: string): string {
  return operationId
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function titleCase(value: string): string {
  return value
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function confidenceForOpenApiOperation(method: RestMethod): number {
  return method === "GET" ? 0.74 : 0.8;
}
