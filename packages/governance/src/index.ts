export type GovernanceDecision = "allow" | "deny" | "requires_approval";

export type GovernanceImpactKind =
  | "money"
  | "production_system"
  | "legal_commitment"
  | "private_data"
  | "public_communication"
  | "destructive_action"
  | "privilege_escalation"
  | "real_desktop_control";

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  impactKinds: GovernanceImpactKind[];
  decision: GovernanceDecision;
  requiredApproverRole: string;
  reason: string;
  enabled: boolean;
}

export interface GovernanceAction {
  id: string;
  action: string;
  requesterIdentityId: string;
  externalImpacts: GovernanceImpactKind[];
  evidenceRefs: string[];
}

export interface PolicyDecision {
  decision: GovernanceDecision;
  policyIds: string[];
  action?: string;
  reason: string;
  detectedImpacts: GovernanceImpactKind[];
  approvalRequirements: ApprovalRequirement[];
}

export interface ApprovalRequirement {
  id: string;
  action: string;
  requiredApproverRole: string;
  reason: string;
  policyId: string;
}

export interface EvaluateGovernancePolicyInput {
  policies: GovernancePolicy[];
  action: GovernanceAction;
}

export interface GovernancePolicyStore {
  record(policy: GovernancePolicy): GovernancePolicy;
  list(): GovernancePolicy[];
  evaluate(action: GovernanceAction): PolicyDecision;
}

export function createDefaultGovernancePolicies(): GovernancePolicy[] {
  return [
    createApprovalPolicy({
      id: "policy:approval:money",
      name: "Money approval",
      description: "Spending money or charging customers requires explicit approval.",
      impactKind: "money",
      reason: "Money-impacting actions require explicit approval."
    }),
    createApprovalPolicy({
      id: "policy:approval:production-system",
      name: "Production system approval",
      description: "Production-impacting actions require explicit approval.",
      impactKind: "production_system",
      reason: "Production-impacting actions require explicit approval."
    }),
    createApprovalPolicy({
      id: "policy:approval:legal-commitment",
      name: "Legal commitment approval",
      description: "Legal commitments require explicit approval.",
      impactKind: "legal_commitment",
      reason: "Legal commitments require explicit approval."
    }),
    createApprovalPolicy({
      id: "policy:approval:private-data",
      name: "Private data approval",
      description: "Sharing or processing private data requires explicit approval.",
      impactKind: "private_data",
      reason: "Private-data actions require explicit approval."
    }),
    createApprovalPolicy({
      id: "policy:approval:public-communication",
      name: "Public communication approval",
      description: "Public or external communications require explicit approval.",
      impactKind: "public_communication",
      reason: "Public communication requires explicit approval."
    }),
    createApprovalPolicy({
      id: "policy:approval:destructive-action",
      name: "Destructive action approval",
      description: "Destructive actions require explicit approval.",
      impactKind: "destructive_action",
      reason: "Destructive actions require explicit approval."
    }),
    createApprovalPolicy({
      id: "policy:approval:privilege-escalation",
      name: "Privilege escalation approval",
      description: "Privilege escalation requires explicit approval.",
      impactKind: "privilege_escalation",
      reason: "Privilege escalation requires explicit approval."
    }),
    createApprovalPolicy({
      id: "policy:approval:real-desktop-control",
      name: "Real desktop control approval",
      description: "Real desktop control requires explicit approval.",
      impactKind: "real_desktop_control",
      reason: "Real desktop control requires explicit approval."
    })
  ];
}

export function detectSensitiveActionImpacts(
  actionText: string
): GovernanceImpactKind[] {
  const normalizedAction = actionText.toLowerCase();
  const impacts: GovernanceImpactKind[] = [];

  if (
    /\b(spend|charge|charges|payment|purchase|invoice|billing)\b/.test(normalizedAction)
  ) {
    impacts.push("money");
  }

  if (/\b(production|prod|deploy|migration|release)\b/.test(normalizedAction)) {
    impacts.push("production_system");
  }

  if (/\b(contract|legal|signature|agreement|terms)\b/.test(normalizedAction)) {
    impacts.push("legal_commitment");
  }

  if (
    /\b(private|confidential|secret|personal data|pii|customer data)\b/.test(
      normalizedAction
    )
  ) {
    impacts.push("private_data");
  }

  if (
    /\b(public|email|tweet|post|publish|announce|external)\b/.test(normalizedAction)
  ) {
    impacts.push("public_communication");
  }

  if (/\b(delete|destructive|destroy|remove|wipe|drop)\b/.test(normalizedAction)) {
    impacts.push("destructive_action");
  }

  if (/\b(admin|root|sudo|privilege|permission)\b/.test(normalizedAction)) {
    impacts.push("privilege_escalation");
  }

  if (/\b(desktop|computer control|mouse|keyboard|screen)\b/.test(normalizedAction)) {
    impacts.push("real_desktop_control");
  }

  return sortedUniqueImpacts(impacts);
}

export function evaluateGovernancePolicy(
  input: EvaluateGovernancePolicyInput
): PolicyDecision {
  const detectedImpacts = sortedUniqueImpacts([
    ...input.action.externalImpacts,
    ...detectSensitiveActionImpacts(input.action.action)
  ]);
  const matchingPolicies = input.policies.filter(
    (policy) =>
      policy.enabled &&
      policy.impactKinds.some((impactKind) => detectedImpacts.includes(impactKind))
  );
  const denyPolicies = matchingPolicies.filter((policy) => policy.decision === "deny");

  if (denyPolicies.length > 0) {
    const policy = sortPolicies(denyPolicies)[0]!;

    return {
      decision: "deny",
      policyIds: [policy.id],
      action: input.action.action,
      reason: policy.reason,
      detectedImpacts,
      approvalRequirements: []
    };
  }

  const approvalPolicies = sortPolicies(
    matchingPolicies.filter((policy) => policy.decision === "requires_approval")
  );

  if (approvalPolicies.length > 0) {
    return {
      decision: "requires_approval",
      policyIds: approvalPolicies.map((policy) => policy.id),
      action: input.action.action,
      reason: approvalPolicies[0]!.reason,
      detectedImpacts,
      approvalRequirements: approvalPolicies.map((policy) =>
        createApprovalRequirement(input.action, policy)
      )
    };
  }

  return {
    decision: "allow",
    policyIds: [],
    action: input.action.action,
    reason: "No enabled governance policy requires approval or denial.",
    detectedImpacts,
    approvalRequirements: []
  };
}

export function createInMemoryGovernancePolicyStore(
  initialPolicies: GovernancePolicy[] = []
): GovernancePolicyStore {
  const policies = new Map<string, GovernancePolicy>(
    initialPolicies.map((policy) => [policy.id, cloneGovernancePolicy(policy)])
  );

  return {
    record: (policy) => {
      const storedPolicy = cloneGovernancePolicy(policy);
      policies.set(storedPolicy.id, storedPolicy);

      return cloneGovernancePolicy(storedPolicy);
    },
    list: () => [...policies.values()].map(cloneGovernancePolicy),
    evaluate: (action) =>
      evaluateGovernancePolicy({
        policies: [...policies.values()].map(cloneGovernancePolicy),
        action
      })
  };
}

export function recordGovernancePolicy(
  store: GovernancePolicyStore,
  policy: GovernancePolicy
): GovernancePolicy {
  return store.record(policy);
}

function createApprovalPolicy(input: {
  id: string;
  name: string;
  description: string;
  impactKind: GovernanceImpactKind;
  reason: string;
}): GovernancePolicy {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    impactKinds: [input.impactKind],
    decision: "requires_approval",
    requiredApproverRole: "owner",
    reason: input.reason,
    enabled: true
  };
}

function createApprovalRequirement(
  action: GovernanceAction,
  policy: GovernancePolicy
): ApprovalRequirement {
  return {
    id: `approval-requirement:${action.id}:${policy.id}`,
    action: action.action,
    requiredApproverRole: policy.requiredApproverRole,
    reason: policy.reason,
    policyId: policy.id
  };
}

function sortPolicies(policies: GovernancePolicy[]): GovernancePolicy[] {
  return [...policies].sort((left, right) => left.id.localeCompare(right.id));
}

function sortedUniqueImpacts(impacts: GovernanceImpactKind[]): GovernanceImpactKind[] {
  const priority: GovernanceImpactKind[] = [
    "money",
    "production_system",
    "legal_commitment",
    "private_data",
    "public_communication",
    "destructive_action",
    "privilege_escalation",
    "real_desktop_control"
  ];
  const impactSet = new Set(impacts);

  return priority.filter((impact) => impactSet.has(impact));
}

function cloneGovernancePolicy(policy: GovernancePolicy): GovernancePolicy {
  return {
    ...policy,
    impactKinds: [...policy.impactKinds]
  };
}
