export type DecisionOutcomeType =
  | "approve"
  | "approve_with_constraints"
  | "discuss"
  | "suggest_alternative"
  | "simulate_first"
  | "reject"
  | "delegate_to_human";

export type DecisionReversibility =
  | "reversible"
  | "partially_reversible"
  | "irreversible";

export type DecisionExternalImpact =
  | "money"
  | "production_system"
  | "legal_commitment"
  | "private_data"
  | "public_communication"
  | "destructive_action"
  | "privilege_escalation"
  | "real_desktop_control";

export type DecisionRiskSeverity = "low" | "medium" | "high" | "critical";
export type DecisionAuditSeverity = "low" | "medium" | "high" | "critical";
export type DecisionAuthorityMode = "broad" | "trusted" | "restricted";

export interface DecisionRisk {
  kind: string;
  severity: DecisionRiskSeverity;
  description: string;
  requiresRejection?: boolean;
}

export interface DecisionAlternative {
  action: string;
  reason: string;
  safetyGain: "low" | "medium" | "high";
}

export interface DecisionRequest {
  id: string;
  goalId: string;
  action: string;
  actionType: string;
  rationale: string;
  reversibility: DecisionReversibility;
  externalImpacts: DecisionExternalImpact[];
  risks: DecisionRisk[];
  alternatives: DecisionAlternative[];
  evidenceRefs: string[];
  requesterIdentityId: string;
  authorityMode: DecisionAuthorityMode;
  humanRequired?: boolean;
  approvalRequired?: boolean;
  simulationRequired?: boolean;
  simulationEvidenceRefs?: string[];
  approvalEvidenceRefs?: string[];
}

export interface DecisionOutcome {
  requestId: string;
  type: DecisionOutcomeType;
  rationale: string;
  constraints: string[];
  discussionPoints: string[];
  suggestedAlternative?: DecisionAlternative;
  simulationRequirement?: string;
  approvalRequired: boolean;
  auditSeverity: DecisionAuditSeverity;
  evidenceRefs: string[];
}

export interface DecisionEngine {
  decide(request: DecisionRequest): DecisionOutcome;
}

const communicationConstraints = [
  "Draft the communication first.",
  "Do not send externally until the final message is reviewed or explicitly authorized.",
  "Do not include confidential data unless the requester explicitly allows it."
];

const verifiedExecutionConstraints = [
  "Execute only the simulated provider, capability, and inputs.",
  "Preserve the verified rollback and validation evidence."
];

export function createDefaultDecisionEngine(): DecisionEngine {
  return {
    decide: decideWithDefaultRules
  };
}

function decideWithDefaultRules(request: DecisionRequest): DecisionOutcome {
  const memoryRejectionRisk = request.risks.find(
    (risk) => risk.kind === "memory_rejection" && risk.requiresRejection === true
  );

  if (memoryRejectionRisk !== undefined) {
    return createOutcome(request, {
      type: "reject",
      rationale: `Memory rejected this action: ${memoryRejectionRisk.description}`,
      auditSeverity: "critical",
      approvalRequired: true
    });
  }

  if (request.risks.some((risk) => risk.requiresRejection === true)) {
    return createOutcome(request, {
      type: "reject",
      rationale: "The action includes a risk that requires rejection.",
      auditSeverity: "critical",
      approvalRequired: true
    });
  }

  if (request.humanRequired === true) {
    return createOutcome(request, {
      type: "delegate_to_human",
      rationale: "This action requires a human decision or signature.",
      auditSeverity: "critical",
      approvalRequired: true
    });
  }

  const simulationRequired = requiresSimulation(request);
  const simulationEvidenceRefs = request.simulationEvidenceRefs ?? [];
  const approvalEvidenceRefs = request.approvalEvidenceRefs ?? [];

  if (simulationRequired && simulationEvidenceRefs.length === 0) {
    const productionImpact = request.externalImpacts.includes("production_system");

    return createOutcome(request, {
      type: "simulate_first",
      rationale: productionImpact
        ? "Production-impacting actions need simulation before execution."
        : "Provider or action risk requires simulation before execution.",
      auditSeverity: "high",
      approvalRequired: true,
      simulationRequirement: productionImpact
        ? "Simulate the action, produce expected effects, rollback path, and verification checks before execution."
        : "Simulate the exact provider, capability, and inputs and capture validation evidence before execution."
    });
  }

  if (simulationRequired && approvalEvidenceRefs.length === 0) {
    return createOutcome(request, {
      type: "delegate_to_human",
      rationale:
        "Simulation completed, but the action still requires explicit human approval.",
      auditSeverity: "high",
      approvalRequired: true
    });
  }

  if (simulationRequired) {
    return createOutcome(request, {
      type: "approve_with_constraints",
      rationale:
        "The exact action was simulated and explicitly approved for constrained execution.",
      auditSeverity: "high",
      approvalRequired: false,
      constraints: verifiedExecutionConstraints
    });
  }

  if (request.approvalRequired === true && approvalEvidenceRefs.length === 0) {
    return createOutcome(request, {
      type: "delegate_to_human",
      rationale: "The selected provider requires explicit human approval.",
      auditSeverity: "high",
      approvalRequired: true
    });
  }

  if (
    request.reversibility === "irreversible" ||
    request.externalImpacts.includes("destructive_action")
  ) {
    const suggestedAlternative = chooseBestAlternative(request.alternatives);

    return createOutcome(request, {
      type: "discuss",
      rationale:
        "The action is destructive or irreversible and should be discussed first.",
      auditSeverity: highestAuditSeverity(request.risks, "high"),
      approvalRequired: true,
      discussionPoints: ["This action is irreversible or destructive."],
      ...(suggestedAlternative === undefined ? {} : { suggestedAlternative })
    });
  }

  if (request.externalImpacts.includes("public_communication")) {
    return createOutcome(request, {
      type: "approve_with_constraints",
      rationale:
        "Communication work can proceed as a draft with external-send constraints.",
      auditSeverity: "medium",
      approvalRequired: false,
      constraints: communicationConstraints
    });
  }

  return createOutcome(request, {
    type: "approve",
    rationale: "The action is low-risk, reversible, and has no external impact.",
    auditSeverity: highestAuditSeverity(request.risks, "low"),
    approvalRequired: false
  });
}

function createOutcome(
  request: DecisionRequest,
  options: {
    type: DecisionOutcomeType;
    rationale: string;
    auditSeverity: DecisionAuditSeverity;
    approvalRequired: boolean;
    constraints?: string[];
    discussionPoints?: string[];
    suggestedAlternative?: DecisionAlternative;
    simulationRequirement?: string;
  }
): DecisionOutcome {
  const outcome: DecisionOutcome = {
    requestId: request.id,
    type: options.type,
    rationale: options.rationale,
    constraints: options.constraints ?? [],
    discussionPoints: options.discussionPoints ?? [],
    approvalRequired: options.approvalRequired,
    auditSeverity: options.auditSeverity,
    evidenceRefs: [
      ...new Set([
        ...request.evidenceRefs,
        ...(request.simulationEvidenceRefs ?? []),
        ...(request.approvalEvidenceRefs ?? [])
      ])
    ]
  };

  if (options.suggestedAlternative !== undefined) {
    outcome.suggestedAlternative = options.suggestedAlternative;
  }

  if (options.simulationRequirement !== undefined) {
    outcome.simulationRequirement = options.simulationRequirement;
  }

  return outcome;
}

function requiresSimulation(request: DecisionRequest): boolean {
  return (
    request.simulationRequired === true ||
    request.externalImpacts.some((impact) =>
      [
        "money",
        "production_system",
        "legal_commitment",
        "private_data",
        "privilege_escalation",
        "real_desktop_control"
      ].includes(impact)
    )
  );
}

function chooseBestAlternative(
  alternatives: DecisionAlternative[]
): DecisionAlternative | undefined {
  return (
    alternatives.find((alternative) => alternative.safetyGain === "high") ??
    alternatives.find((alternative) => alternative.safetyGain === "medium") ??
    alternatives[0]
  );
}

function highestAuditSeverity(
  risks: DecisionRisk[],
  fallback: DecisionAuditSeverity
): DecisionAuditSeverity {
  if (risks.some((risk) => risk.severity === "critical")) {
    return "critical";
  }

  if (risks.some((risk) => risk.severity === "high")) {
    return "high";
  }

  if (risks.some((risk) => risk.severity === "medium")) {
    return "medium";
  }

  if (risks.some((risk) => risk.severity === "low")) {
    return "low";
  }

  return fallback;
}
