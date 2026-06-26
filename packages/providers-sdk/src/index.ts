export interface CapabilityProviderManifest {
  id: string;
  name: string;
  version: string;
  capabilityIds: string[];
  interfaceDriverIds: string[];
  requiredPermissions: string[];
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
