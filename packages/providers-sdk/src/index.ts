export type ProviderLifecycleState =
  | "draft"
  | "registered"
  | "healthy"
  | "degraded"
  | "disabled"
  | "failed";

export type ProviderSchemaFieldType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array";

export interface ProviderSchemaField {
  name: string;
  type: ProviderSchemaFieldType;
  required?: boolean;
}

export interface CapabilityProviderManifest {
  id: string;
  name: string;
  version: string;
  lifecycle: ProviderLifecycleState;
  capabilityIds: string[];
  interfaceDriverIds: string[];
  requiredPermissions: string[];
  inputSchema: ProviderSchemaField[];
  outputSchema: ProviderSchemaField[];
}

export interface ProviderExecutionRequest {
  providerId: string;
  capabilityId: string;
  inputs: Record<string, unknown>;
  executionContextId: string;
}

export interface ProviderExecutionResult {
  outputs: Record<string, unknown>;
  evidence: string[];
  compensationRef?: string;
}

export type ProviderRuntimeEventType =
  | "provider.execution.started"
  | "provider.execution.completed"
  | "provider.execution.failed";

export interface ProviderRuntimeEvent {
  type: ProviderRuntimeEventType;
  providerId: string;
  capabilityId: string;
  executionContextId: string;
}

export type ProviderExecutionStatus = "completed" | "failed";

export interface ProviderExecutionReport {
  status: ProviderExecutionStatus;
  result?: ProviderExecutionResult;
  error?: string;
  events: ProviderRuntimeEvent[];
}

export type ProviderHandler = (
  request: ProviderExecutionRequest
) => Promise<ProviderExecutionResult> | ProviderExecutionResult;

export interface RegisterProviderInput {
  manifest: CapabilityProviderManifest;
  handler: ProviderHandler;
  registeredAt?: string;
}

export interface RegisteredCapabilityProvider {
  manifest: CapabilityProviderManifest;
  handler: ProviderHandler;
  registeredAt: string;
}

export interface ProviderRegistry {
  providers: Map<string, RegisteredCapabilityProvider>;
}

export function createProviderRegistry(): ProviderRegistry {
  return {
    providers: new Map()
  };
}

export function registerProvider(
  registry: ProviderRegistry,
  input: RegisterProviderInput
): RegisteredCapabilityProvider {
  if (registry.providers.has(input.manifest.id)) {
    throw new Error(`Provider already registered: ${input.manifest.id}`);
  }

  const provider = {
    manifest: input.manifest,
    handler: input.handler,
    registeredAt: input.registeredAt ?? new Date().toISOString()
  };

  registry.providers.set(input.manifest.id, provider);
  return provider;
}

export async function executeProvider(
  registry: ProviderRegistry,
  request: ProviderExecutionRequest
): Promise<ProviderExecutionReport> {
  const startedEvent = createProviderRuntimeEvent(
    "provider.execution.started",
    request
  );
  const provider = registry.providers.get(request.providerId);

  if (provider === undefined) {
    return failedExecution(
      request,
      startedEvent,
      `Unknown provider: ${request.providerId}`
    );
  }

  if (provider.manifest.lifecycle === "disabled") {
    return failedExecution(
      request,
      startedEvent,
      `Provider is disabled: ${request.providerId}`
    );
  }

  if (!provider.manifest.capabilityIds.includes(request.capabilityId)) {
    return failedExecution(
      request,
      startedEvent,
      `Provider ${request.providerId} does not support ${request.capabilityId}`
    );
  }

  const inputError = validateFields(provider.manifest.inputSchema, request.inputs);
  if (inputError !== null) {
    return failedExecution(request, startedEvent, inputError);
  }

  try {
    const result = await provider.handler(request);
    const outputError = validateFields(provider.manifest.outputSchema, result.outputs);

    if (outputError !== null) {
      return failedExecution(
        request,
        startedEvent,
        outputError.replace("input", "output")
      );
    }

    return {
      status: "completed",
      result,
      events: [
        startedEvent,
        createProviderRuntimeEvent("provider.execution.completed", request)
      ]
    };
  } catch (error) {
    return failedExecution(
      request,
      startedEvent,
      error instanceof Error ? error.message : "Provider execution failed"
    );
  }
}

function validateFields(
  schema: ProviderSchemaField[],
  values: Record<string, unknown>
): string | null {
  for (const field of schema) {
    const value = values[field.name];

    if (field.required === true && value === undefined) {
      return `Missing required input: ${field.name}`;
    }

    if (value !== undefined && !matchesFieldType(value, field.type)) {
      return `Invalid input ${field.name}: expected ${field.type}`;
    }
  }

  return null;
}

function matchesFieldType(value: unknown, type: ProviderSchemaFieldType): boolean {
  switch (type) {
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return typeof value === type;
  }
}

function failedExecution(
  request: ProviderExecutionRequest,
  startedEvent: ProviderRuntimeEvent,
  error: string
): ProviderExecutionReport {
  return {
    status: "failed",
    error,
    events: [
      startedEvent,
      createProviderRuntimeEvent("provider.execution.failed", request)
    ]
  };
}

function createProviderRuntimeEvent(
  type: ProviderRuntimeEventType,
  request: ProviderExecutionRequest
): ProviderRuntimeEvent {
  return {
    type,
    providerId: request.providerId,
    capabilityId: request.capabilityId,
    executionContextId: request.executionContextId
  };
}
