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

export type RestDriverTransport = (
  request: RestDriverTransportRequest
) => Promise<RestDriverResponse> | RestDriverResponse;

export interface RestInterfaceDriver {
  manifest: InterfaceDriverManifest;
  execute(request: RestDriverRequest): Promise<RestDriverResult>;
}

export interface CreateRestInterfaceDriverInput {
  transport: RestDriverTransport;
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

function toTransportRequest(request: RestDriverRequest): RestDriverTransportRequest {
  return {
    method: request.method,
    url: request.url,
    headers: request.headers ?? {},
    ...(request.body === undefined ? {} : { body: request.body })
  };
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
