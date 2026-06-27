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

export type ExecutionSessionStatus = "running" | "completed" | "failed";
export type ExecutionStepStatus = "completed" | "failed" | "skipped";
export type ExecutionEventType =
  | "execution.session.started"
  | "execution.session.completed"
  | "execution.session.failed"
  | "execution.step.started"
  | "execution.step.completed"
  | "execution.step.failed";

export type ExecutionWorkflowNodeType =
  | "capability"
  | "approval"
  | "human_provider"
  | "wait"
  | "parallel"
  | "compensation";

export interface ExecutionWorkflowNode {
  id: string;
  type: ExecutionWorkflowNodeType;
  inputs: Record<string, unknown>;
}

export interface ExecutionWorkflowEdge {
  fromNodeId: string;
  toNodeId: string;
  condition?: string;
}

export interface ExecutionWorkflow {
  id: string;
  version: string;
  nodes: ExecutionWorkflowNode[];
  edges: ExecutionWorkflowEdge[];
}

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

export interface WorkflowValidation {
  valid: boolean;
  errors: string[];
}

export interface ExecutionSessionInput {
  id: string;
  workflowId: string;
  startedAt: string;
}

export interface ExecutionSession extends ExecutionSessionInput {
  status: ExecutionSessionStatus;
}

export interface ExecutionEvent {
  type: ExecutionEventType;
  executionId: string;
  nodeId?: string;
}

export interface ExecutionStepResult {
  nodeId: string;
  status: ExecutionStepStatus;
  outputs: Record<string, unknown>;
  evidenceRefs: string[];
  error?: string;
}

export interface ExecuteWorkflowNodeInput {
  session: ExecutionSession;
  node: ExecutionWorkflowNode;
  previousOutputs: ExecutionStepResult[];
}

export interface ExecuteWorkflowNodeResult {
  outputs: Record<string, unknown>;
  evidenceRefs: string[];
}

export type WorkflowNodeHandler = (
  input: ExecuteWorkflowNodeInput
) => Promise<ExecuteWorkflowNodeResult> | ExecuteWorkflowNodeResult;

export type WorkflowNodeHandlers = Partial<
  Record<ExecutionWorkflowNodeType, WorkflowNodeHandler>
>;

export interface RunSequentialWorkflowInput {
  session: ExecutionSession;
  workflow: ExecutionWorkflow;
  handlers: WorkflowNodeHandlers;
}

export interface ExecutionRunResult {
  session: ExecutionSession;
  status: ExecutionSessionStatus;
  steps: ExecutionStepResult[];
  events: ExecutionEvent[];
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

export function validateWorkflow(workflow: ExecutionWorkflow): WorkflowValidation {
  const errors: string[] = [];
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));

  if (workflow.nodes.length === 0) {
    errors.push("Workflow must include at least one node.");
  }

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.fromNodeId)) {
      errors.push(`Edge source node not found: ${edge.fromNodeId}`);
    }

    if (!nodeIds.has(edge.toNodeId)) {
      errors.push(`Edge target node not found: ${edge.toNodeId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function createExecutionSession(input: ExecutionSessionInput): ExecutionSession {
  return {
    ...input,
    status: "running"
  };
}

export async function runSequentialWorkflow(
  input: RunSequentialWorkflowInput
): Promise<ExecutionRunResult> {
  const validation = validateWorkflow(input.workflow);
  const events: ExecutionEvent[] = [
    createExecutionEvent("execution.session.started", input.session.id)
  ];
  const steps: ExecutionStepResult[] = [];

  if (!validation.valid) {
    return {
      session: { ...input.session, status: "failed" },
      status: "failed",
      steps,
      events: [
        ...events,
        createExecutionEvent("execution.session.failed", input.session.id)
      ]
    };
  }

  for (const node of orderedWorkflowNodes(input.workflow)) {
    events.push(
      createExecutionEvent("execution.step.started", input.session.id, node.id)
    );

    const handler = input.handlers[node.type];
    if (handler === undefined) {
      const step = {
        nodeId: node.id,
        status: "failed" as const,
        outputs: {},
        evidenceRefs: [],
        error: `No handler registered for node type: ${node.type}`
      };

      steps.push(step);
      events.push(
        createExecutionEvent("execution.step.failed", input.session.id, node.id),
        createExecutionEvent("execution.session.failed", input.session.id)
      );

      return {
        session: { ...input.session, status: "failed" },
        status: "failed",
        steps,
        events
      };
    }

    try {
      const result = await handler({
        session: input.session,
        node,
        previousOutputs: steps
      });
      steps.push({
        nodeId: node.id,
        status: "completed",
        outputs: result.outputs,
        evidenceRefs: result.evidenceRefs
      });
      events.push(
        createExecutionEvent("execution.step.completed", input.session.id, node.id)
      );
    } catch (error) {
      steps.push({
        nodeId: node.id,
        status: "failed",
        outputs: {},
        evidenceRefs: [],
        error: error instanceof Error ? error.message : "Workflow node failed"
      });
      events.push(
        createExecutionEvent("execution.step.failed", input.session.id, node.id),
        createExecutionEvent("execution.session.failed", input.session.id)
      );

      return {
        session: { ...input.session, status: "failed" },
        status: "failed",
        steps,
        events
      };
    }
  }

  events.push(createExecutionEvent("execution.session.completed", input.session.id));

  return {
    session: { ...input.session, status: "completed" },
    status: "completed",
    steps,
    events
  };
}

function orderedWorkflowNodes(workflow: ExecutionWorkflow): ExecutionWorkflowNode[] {
  if (workflow.edges.length === 0) {
    return workflow.nodes;
  }

  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const destinationIds = new Set(workflow.edges.map((edge) => edge.toNodeId));
  const firstNode =
    workflow.nodes.find((node) => !destinationIds.has(node.id)) ?? workflow.nodes[0];
  const ordered: ExecutionWorkflowNode[] = [];
  const visited = new Set<string>();
  let current = firstNode;

  while (current !== undefined && !visited.has(current.id)) {
    ordered.push(current);
    visited.add(current.id);
    const nextEdge = workflow.edges.find((edge) => edge.fromNodeId === current?.id);
    current = nextEdge === undefined ? undefined : nodesById.get(nextEdge.toNodeId);
  }

  for (const node of workflow.nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }

  return ordered;
}

function createExecutionEvent(
  type: ExecutionEventType,
  executionId: string,
  nodeId?: string
): ExecutionEvent {
  return nodeId === undefined ? { type, executionId } : { type, executionId, nodeId };
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
