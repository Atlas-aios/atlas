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
  retryPolicy?: ProviderRetryPolicy;
  metadata?: Record<string, unknown>;
}

export interface ProviderRetryPolicy {
  maxAttempts: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
}

export interface ProviderExecutionRequest {
  providerId: string;
  capabilityId: string;
  inputs: Record<string, unknown>;
  executionContextId: string;
  compensationRef?: string;
}

export interface ProviderExecutionResult {
  outputs: Record<string, unknown>;
  evidence: string[];
  compensationRef?: string;
}

export type ProviderRuntimeEventType =
  | "provider.execution.started"
  | "provider.execution.completed"
  | "provider.execution.failed"
  | "provider.execution.retrying"
  | "provider.compensation.started"
  | "provider.compensation.completed"
  | "provider.compensation.failed";

export interface ProviderRuntimeEvent {
  type: ProviderRuntimeEventType;
  providerId: string;
  capabilityId: string;
  executionContextId: string;
  attempt?: number;
  delayMs?: number;
}

export type ProviderExecutionStatus = "completed" | "failed" | "compensated";

export interface ProviderExecutionReport {
  status: ProviderExecutionStatus;
  result?: ProviderExecutionResult;
  error?: string;
  events: ProviderRuntimeEvent[];
}

export type ProviderHandler = (
  request: ProviderExecutionRequest
) => Promise<ProviderExecutionResult> | ProviderExecutionResult;

export interface ProviderCompensationRequest extends ProviderExecutionRequest {
  compensationRef: string;
}

export type ProviderCompensationHandler = (
  request: ProviderCompensationRequest
) => Promise<ProviderExecutionResult> | ProviderExecutionResult;

export interface RegisterProviderInput {
  manifest: CapabilityProviderManifest;
  handler: ProviderHandler;
  compensate?: ProviderCompensationHandler;
  registeredAt?: string;
}

export type CodingProviderPlatform =
  | "codex"
  | "claude_code"
  | "local_code_agent"
  | "human_code_review";

export interface CreateCodingProviderManifestInput {
  id: string;
  name: string;
  version: string;
  platform: CodingProviderPlatform;
  lifecycle: ProviderLifecycleState;
  requiredPermissions: string[];
  interfaceDriverIds: string[];
  maxEstimatedCostUsd: number;
}

export interface RegisteredCapabilityProvider {
  manifest: CapabilityProviderManifest;
  handler: ProviderHandler;
  compensate?: ProviderCompensationHandler;
  registeredAt: string;
}

export interface ProviderRegistry {
  providers: Map<string, RegisteredCapabilityProvider>;
  providerVersions: Map<string, RegisteredCapabilityProvider[]>;
}

export interface ExecuteProviderOptions {
  scheduleDelay?: (delayMs: number) => Promise<void> | void;
}

export function createProviderRegistry(): ProviderRegistry {
  return {
    providers: new Map(),
    providerVersions: new Map()
  };
}

export function createCodingProviderManifest(
  input: CreateCodingProviderManifestInput
): CapabilityProviderManifest {
  return {
    id: input.id,
    name: input.name,
    version: input.version,
    lifecycle: input.lifecycle,
    capabilityIds: ["capability:modify-code"],
    interfaceDriverIds: input.interfaceDriverIds,
    requiredPermissions: input.requiredPermissions,
    inputSchema: [
      { name: "repository", type: "string", required: true },
      { name: "branch", type: "string", required: true },
      { name: "task", type: "string", required: true },
      { name: "constraints", type: "array" },
      { name: "maxEstimatedCostUsd", type: "number" }
    ],
    outputSchema: [
      { name: "summary", type: "string", required: true },
      { name: "changedFiles", type: "array", required: true },
      { name: "commitId", type: "string" },
      { name: "pullRequestUrl", type: "string" },
      { name: "estimatedCostUsd", type: "number" }
    ],
    retryPolicy: { maxAttempts: 1 },
    metadata: {
      providerKind: "ai_coding_platform",
      platform: input.platform,
      maxEstimatedCostUsd: input.maxEstimatedCostUsd
    }
  };
}

export function registerProvider(
  registry: ProviderRegistry,
  input: RegisterProviderInput
): RegisteredCapabilityProvider {
  const versions = registry.providerVersions.get(input.manifest.id) ?? [];

  if (
    versions.some((provider) => provider.manifest.version === input.manifest.version)
  ) {
    throw new Error(
      `Provider version already registered: ${input.manifest.id}@${input.manifest.version}`
    );
  }

  const provider = {
    manifest: input.manifest,
    handler: input.handler,
    ...(input.compensate === undefined ? {} : { compensate: input.compensate }),
    registeredAt: input.registeredAt ?? new Date().toISOString()
  };

  const nextVersions = [...versions, provider].sort(compareProviderVersions);
  registry.providerVersions.set(input.manifest.id, nextVersions);
  registry.providers.set(input.manifest.id, nextVersions[nextVersions.length - 1]!);
  return provider;
}

export function getProviderVersions(
  registry: ProviderRegistry,
  providerId: string
): RegisteredCapabilityProvider[] {
  return [...(registry.providerVersions.get(providerId) ?? [])];
}

export function getLatestProviderVersion(
  registry: ProviderRegistry,
  providerId: string
): RegisteredCapabilityProvider | null {
  return registry.providers.get(providerId) ?? null;
}

export async function executeProvider(
  registry: ProviderRegistry,
  request: ProviderExecutionRequest,
  options: ExecuteProviderOptions = {}
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

  if (request.compensationRef !== undefined) {
    return executeCompensation(provider, request);
  }

  const inputError = validateFields(provider.manifest.inputSchema, request.inputs);
  if (inputError !== null) {
    return failedExecution(request, startedEvent, inputError);
  }

  const events = [startedEvent];
  const maxAttempts = Math.max(1, provider.manifest.retryPolicy?.maxAttempts ?? 1);
  const initialDelayMs = provider.manifest.retryPolicy?.initialDelayMs ?? 0;
  const backoffMultiplier = provider.manifest.retryPolicy?.backoffMultiplier ?? 1;
  let lastError = "Provider execution failed";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await provider.handler(request);
      const outputError = validateFields(
        provider.manifest.outputSchema,
        result.outputs
      );

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
          ...events,
          createProviderRuntimeEvent("provider.execution.completed", request)
        ]
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Provider execution failed";

      if (attempt < maxAttempts) {
        const delayMs = retryDelayMs(initialDelayMs, backoffMultiplier, attempt);
        events.push(
          createProviderRuntimeEvent("provider.execution.retrying", request, {
            attempt,
            delayMs
          })
        );
        await scheduleRetryDelay(options, delayMs);
      }
    }
  }

  return {
    status: "failed",
    error: lastError,
    events: [
      ...events,
      createProviderRuntimeEvent("provider.execution.failed", request)
    ]
  };
}

async function executeCompensation(
  provider: RegisteredCapabilityProvider,
  request: ProviderExecutionRequest
): Promise<ProviderExecutionReport> {
  const compensationRequest = {
    ...request,
    compensationRef: request.compensationRef!
  };
  const startedEvent = createProviderRuntimeEvent(
    "provider.compensation.started",
    request
  );

  if (provider.compensate === undefined) {
    return {
      status: "failed",
      error: `Provider has no compensation hook: ${request.providerId}`,
      events: [
        startedEvent,
        createProviderRuntimeEvent("provider.compensation.failed", request)
      ]
    };
  }

  try {
    return {
      status: "compensated",
      result: await provider.compensate(compensationRequest),
      events: [
        startedEvent,
        createProviderRuntimeEvent("provider.compensation.completed", request)
      ]
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Provider compensation failed",
      events: [
        startedEvent,
        createProviderRuntimeEvent("provider.compensation.failed", request)
      ]
    };
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
  request: ProviderExecutionRequest,
  metadata: Pick<ProviderRuntimeEvent, "attempt" | "delayMs"> = {}
): ProviderRuntimeEvent {
  return {
    type,
    providerId: request.providerId,
    capabilityId: request.capabilityId,
    executionContextId: request.executionContextId,
    ...metadata
  };
}

async function scheduleRetryDelay(
  options: ExecuteProviderOptions,
  delayMs: number
): Promise<void> {
  if (delayMs <= 0) {
    return;
  }

  if (options.scheduleDelay !== undefined) {
    await options.scheduleDelay(delayMs);
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function retryDelayMs(
  initialDelayMs: number,
  backoffMultiplier: number,
  failedAttempt: number
): number {
  return Math.round(
    initialDelayMs * Math.max(1, backoffMultiplier) ** (failedAttempt - 1)
  );
}

function compareProviderVersions(
  left: RegisteredCapabilityProvider,
  right: RegisteredCapabilityProvider
): number {
  const versionComparison = compareSemver(
    left.manifest.version,
    right.manifest.version
  );

  if (versionComparison !== 0) {
    return versionComparison;
  }

  return left.registeredAt.localeCompare(right.registeredAt);
}

function compareSemver(left: string, right: string): number {
  const leftParts = semverParts(left);
  const rightParts = semverParts(right);
  const partCount = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < partCount; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return left.localeCompare(right);
}

function semverParts(version: string): number[] {
  return version
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}
