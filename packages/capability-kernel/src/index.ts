export interface CapabilityResolutionRequest {
  goalId: string;
  capabilityId: string;
  inputs: Record<string, unknown>;
  governanceContextId: string;
}

export interface ProviderCandidate {
  providerId: string;
  capabilityId: string;
  confidence: number;
  riskScore: number;
  estimatedCost: number;
}

export interface CapabilityResolution {
  selectedProviderId: string;
  candidates: ProviderCandidate[];
  approvalRequired: boolean;
  rationale: string;
}

export interface CapabilityKernel {
  resolve(request: CapabilityResolutionRequest): Promise<CapabilityResolution>;
}
