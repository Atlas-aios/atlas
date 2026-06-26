export type GovernanceDecision = "allow" | "deny" | "requires_approval";

export interface PolicyDecision {
  decision: GovernanceDecision;
  policyIds: string[];
  reason: string;
}

export interface ApprovalRequirement {
  id: string;
  action: string;
  requiredApproverRole: string;
  reason: string;
}
