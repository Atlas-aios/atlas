export interface PlanningContext {
  goalId: string;
  worldStateSnapshotId: string;
  availableCapabilityGraphId: string;
  governancePolicySetId: string;
}

export interface PlanStep {
  id: string;
  capabilityId: string;
  purpose: string;
  requiresApproval: boolean;
}

export interface AtlasPlan {
  id: string;
  goalId: string;
  rationale: string;
  risks: string[];
  steps: PlanStep[];
}

export interface BrainEngine {
  plan(context: PlanningContext): Promise<AtlasPlan>;
}
