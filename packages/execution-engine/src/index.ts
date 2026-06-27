import type {
  DecisionAlternative,
  DecisionAuditSeverity,
  DecisionOutcome
} from "@atlas-aios/decision-engine";

export type ExecutionGateStatus =
  | "allowed"
  | "allowed_with_constraints"
  | "waiting"
  | "blocked";

export type ExecutionStatus =
  | "ready"
  | "waiting_for_discussion"
  | "waiting_for_alternative"
  | "waiting_for_simulation"
  | "waiting_for_human"
  | "blocked_by_decision";

export type ExecutionGateRequiredAction =
  | "execute"
  | "execute_with_constraints"
  | "discuss"
  | "revise_plan"
  | "simulate"
  | "delegate"
  | "stop";

export interface ExecutionGateRequest {
  executionId: string;
  capabilityId: string;
  providerId: string;
  decisionOutcome: DecisionOutcome;
}

export interface ExecutionGateOutcome {
  executionId: string;
  capabilityId: string;
  providerId: string;
  decisionRequestId: string;
  status: ExecutionGateStatus;
  executionStatus: ExecutionStatus;
  requiredAction: ExecutionGateRequiredAction;
  rationale: string;
  approvalRequired: boolean;
  auditSeverity: DecisionAuditSeverity;
  evidenceRefs: string[];
  constraints: string[];
  discussionPoints: string[];
  suggestedAlternative?: DecisionAlternative;
  simulationRequirement?: string;
}

export function evaluateExecutionGate(
  request: ExecutionGateRequest
): ExecutionGateOutcome {
  const { decisionOutcome } = request;

  switch (decisionOutcome.type) {
    case "approve":
      return createGateOutcome(request, {
        status: "allowed",
        executionStatus: "ready",
        requiredAction: "execute"
      });

    case "approve_with_constraints":
      return createGateOutcome(request, {
        status: "allowed_with_constraints",
        executionStatus: "ready",
        requiredAction: "execute_with_constraints"
      });

    case "discuss":
      return createGateOutcome(request, {
        status: "waiting",
        executionStatus: "waiting_for_discussion",
        requiredAction: "discuss"
      });

    case "suggest_alternative":
      return createGateOutcome(request, {
        status: "waiting",
        executionStatus: "waiting_for_alternative",
        requiredAction: "revise_plan"
      });

    case "simulate_first":
      return createGateOutcome(request, {
        status: "waiting",
        executionStatus: "waiting_for_simulation",
        requiredAction: "simulate"
      });

    case "reject":
      return createGateOutcome(request, {
        status: "blocked",
        executionStatus: "blocked_by_decision",
        requiredAction: "stop"
      });

    case "delegate_to_human":
      return createGateOutcome(request, {
        status: "waiting",
        executionStatus: "waiting_for_human",
        requiredAction: "delegate"
      });
  }
}

function createGateOutcome(
  request: ExecutionGateRequest,
  options: {
    status: ExecutionGateStatus;
    executionStatus: ExecutionStatus;
    requiredAction: ExecutionGateRequiredAction;
  }
): ExecutionGateOutcome {
  const { decisionOutcome } = request;

  return {
    executionId: request.executionId,
    capabilityId: request.capabilityId,
    providerId: request.providerId,
    decisionRequestId: decisionOutcome.requestId,
    status: options.status,
    executionStatus: options.executionStatus,
    requiredAction: options.requiredAction,
    rationale: decisionOutcome.rationale,
    approvalRequired: decisionOutcome.approvalRequired,
    auditSeverity: decisionOutcome.auditSeverity,
    evidenceRefs: decisionOutcome.evidenceRefs,
    constraints: decisionOutcome.constraints,
    discussionPoints: decisionOutcome.discussionPoints,
    ...(decisionOutcome.suggestedAlternative === undefined
      ? {}
      : { suggestedAlternative: decisionOutcome.suggestedAlternative }),
    ...(decisionOutcome.simulationRequirement === undefined
      ? {}
      : { simulationRequirement: decisionOutcome.simulationRequirement })
  };
}
