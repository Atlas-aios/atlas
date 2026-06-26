export interface CapabilityConfidence {
  capabilityId: string;
  providerId: string;
  confidence: number;
  knownLimitations: string[];
}

export interface SelfModelSnapshot {
  id: string;
  generatedAt: string;
  grantedAuthority: string[];
  capabilityConfidence: CapabilityConfidence[];
}
