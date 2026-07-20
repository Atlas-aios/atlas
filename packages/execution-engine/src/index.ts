import type {
  DecisionAlternative,
  DecisionAuditSeverity,
  DecisionOutcome
} from "@atlas-aios/decision-engine";
import {
  executeProvider,
  type ExecuteProviderOptions,
  type ProviderRegistry
} from "@atlas-aios/providers-sdk";

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

export type ExecutionSessionStatus = "running" | "completed" | "failed" | "waiting";
export type ExecutionStepStatus = "completed" | "failed" | "skipped" | "waiting";
export type ExecutionEventType =
  | "execution.session.started"
  | "execution.session.completed"
  | "execution.session.failed"
  | "execution.session.waiting"
  | "execution.rollback.started"
  | "execution.rollback.completed"
  | "execution.rollback.failed"
  | "execution.step.started"
  | "execution.step.retrying"
  | "execution.step.completed"
  | "execution.step.failed"
  | "execution.step.waiting"
  | "execution.compensation.started"
  | "execution.compensation.completed"
  | "execution.compensation.failed";

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
  retryPolicy?: ExecutionRetryPolicy;
  inputs: Record<string, unknown>;
}

export interface ExecutionRetryPolicy {
  maxAttempts: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
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

export interface ExecutionParallelBranch {
  id: string;
  nodes: ExecutionWorkflowNode[];
  edges: ExecutionWorkflowEdge[];
}

export type ExecutionCheckpointReason =
  | "step_completed"
  | "step_failed"
  | "step_waiting"
  | "rollback_completed"
  | "rollback_failed"
  | "session_completed"
  | "session_failed";

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
  attempt?: number;
  delayMs?: number;
}

export type ExecutionEventSink = (event: ExecutionEvent) => Promise<void> | void;

export interface ExecutionStepResult {
  nodeId: string;
  status: ExecutionStepStatus;
  outputs: Record<string, unknown>;
  evidenceRefs: string[];
  resourceUsage?: ExecutionResourceUsage;
  compensation?: ExecutionCompensationPlan;
  error?: string;
}

export interface ExecutionResourceUsage {
  cost: number;
  unit: string;
  evidenceRef: string;
}

export type ExecutionCompensationPlan = ProviderExecutionCompensationPlan;

export interface ProviderExecutionCompensationPlan {
  type: "provider";
  providerId: string;
  capabilityId: string;
  inputs: Record<string, unknown>;
  compensationRef: string;
}

export type ExecutionCompensationStatus = "compensated" | "failed";
export type ExecutionRollbackStatus = "completed" | "failed";

export interface ExecutionCompensationResult {
  nodeId: string;
  status: ExecutionCompensationStatus;
  outputs: Record<string, unknown>;
  evidenceRefs: string[];
  error?: string;
}

export interface ExecutionRollbackResult {
  status: ExecutionRollbackStatus;
  compensations: ExecutionCompensationResult[];
}

export interface ExecutionCheckpoint {
  id: string;
  executionId: string;
  workflowId: string;
  reason: ExecutionCheckpointReason;
  status: ExecutionSessionStatus;
  completedNodeIds: string[];
  failedNodeIds: string[];
  steps: ExecutionStepResult[];
  events: ExecutionEvent[];
  rollback?: ExecutionRollbackResult;
  createdAt: string;
  lastNodeId?: string;
}

export interface ExecutionCheckpointStore {
  save(checkpoint: ExecutionCheckpoint): Promise<void> | void;
}

export interface MemoryCheckpointStore extends ExecutionCheckpointStore {
  checkpoints: ExecutionCheckpoint[];
}

export interface ExecuteWorkflowNodeInput {
  session: ExecutionSession;
  node: ExecutionWorkflowNode;
  previousOutputs: ExecutionStepResult[];
}

export interface ExecuteWorkflowNodeResult {
  status?: Extract<ExecutionStepStatus, "completed" | "waiting">;
  outputs: Record<string, unknown>;
  evidenceRefs: string[];
  resourceUsage?: ExecutionResourceUsage;
  compensation?: ExecutionCompensationPlan;
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
  scheduleDelay?: (delayMs: number) => Promise<void> | void;
  checkpointStore?: ExecutionCheckpointStore;
  checkpointClock?: () => string;
  onEvent?: ExecutionEventSink;
  providerRegistry?: ProviderRegistry;
  providerExecuteOptions?: ExecuteProviderOptions;
}

export interface ProviderBackedCapabilityHandlerInput {
  registry: ProviderRegistry;
  executeOptions?: ExecuteProviderOptions;
}

export interface ExecutionRunResult {
  session: ExecutionSession;
  status: ExecutionSessionStatus;
  steps: ExecutionStepResult[];
  events: ExecutionEvent[];
  rollback?: ExecutionRollbackResult;
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

export function createMemoryCheckpointStore(): MemoryCheckpointStore {
  const checkpoints: ExecutionCheckpoint[] = [];

  return {
    checkpoints,
    save: (checkpoint) => {
      checkpoints.push(checkpoint);
    }
  };
}

export async function runSequentialWorkflow(
  input: RunSequentialWorkflowInput
): Promise<ExecutionRunResult> {
  const validation = validateWorkflow(input.workflow);
  const events: ExecutionEvent[] = [];
  const steps: ExecutionStepResult[] = [];
  let checkpointSequence = 0;
  await emitExecutionEvent(
    input,
    events,
    createExecutionEvent("execution.session.started", input.session.id)
  );

  if (!validation.valid) {
    await emitExecutionEvent(
      input,
      events,
      createExecutionEvent("execution.session.failed", input.session.id)
    );
    checkpointSequence += 1;
    await saveExecutionCheckpoint(input, checkpointSequence, {
      reason: "session_failed",
      status: "failed",
      steps,
      events
    });

    return {
      session: { ...input.session, status: "failed" },
      status: "failed",
      steps,
      events
    };
  }

  for (const node of orderedWorkflowNodes(input.workflow)) {
    await emitExecutionEvent(
      input,
      events,
      createExecutionEvent("execution.step.started", input.session.id, node.id)
    );

    const handler = resolveWorkflowNodeHandler(input, node);
    if (handler === undefined) {
      const step = {
        nodeId: node.id,
        status: "failed" as const,
        outputs: {},
        evidenceRefs: [],
        error: `No handler registered for node type: ${node.type}`
      };

      steps.push(step);
      await emitExecutionEvent(
        input,
        events,
        createExecutionEvent("execution.step.failed", input.session.id, node.id)
      );
      await emitExecutionEvent(
        input,
        events,
        createExecutionEvent("execution.session.failed", input.session.id)
      );
      const rollback = await rollbackCompletedSteps(input, steps, events);
      checkpointSequence += 1;
      await saveExecutionCheckpoint(input, checkpointSequence, {
        reason: rollbackCheckpointReason(rollback),
        status: "failed",
        steps,
        events,
        ...(rollback === undefined ? {} : { rollback }),
        lastNodeId: node.id
      });

      return {
        session: { ...input.session, status: "failed" },
        status: "failed",
        steps,
        events,
        ...(rollback === undefined ? {} : { rollback })
      };
    }

    try {
      const result = await executeNodeWithRetry(input, node, handler, steps, events);
      const stepStatus = result.status ?? "completed";

      if (stepStatus === "waiting") {
        const resourceUsage = validatedResourceUsage(result.resourceUsage);
        steps.push({
          nodeId: node.id,
          status: "waiting",
          outputs: result.outputs,
          evidenceRefs: result.evidenceRefs,
          ...(resourceUsage === undefined ? {} : { resourceUsage })
        });
        await emitExecutionEvent(
          input,
          events,
          createExecutionEvent("execution.step.waiting", input.session.id, node.id)
        );
        await emitExecutionEvent(
          input,
          events,
          createExecutionEvent("execution.session.waiting", input.session.id)
        );
        checkpointSequence += 1;
        await saveExecutionCheckpoint(input, checkpointSequence, {
          reason: "step_waiting",
          status: "waiting",
          steps,
          events,
          lastNodeId: node.id
        });

        return {
          session: { ...input.session, status: "waiting" },
          status: "waiting",
          steps,
          events
        };
      }

      const resourceUsage = validatedResourceUsage(result.resourceUsage);
      steps.push({
        nodeId: node.id,
        status: "completed",
        outputs: result.outputs,
        evidenceRefs: result.evidenceRefs,
        ...(resourceUsage === undefined ? {} : { resourceUsage }),
        ...(result.compensation === undefined
          ? {}
          : { compensation: result.compensation })
      });
      await emitExecutionEvent(
        input,
        events,
        createExecutionEvent("execution.step.completed", input.session.id, node.id)
      );
      checkpointSequence += 1;
      await saveExecutionCheckpoint(input, checkpointSequence, {
        reason: "step_completed",
        status: "running",
        steps,
        events,
        lastNodeId: node.id
      });
    } catch (error) {
      const failedStep = {
        nodeId: node.id,
        status: "failed" as const,
        outputs: {},
        evidenceRefs: [],
        error: error instanceof Error ? error.message : "Workflow node failed"
      };
      steps.push({
        ...failedStep
      });
      await emitExecutionEvent(
        input,
        events,
        createExecutionEvent("execution.step.failed", input.session.id, node.id)
      );
      await emitExecutionEvent(
        input,
        events,
        createExecutionEvent("execution.session.failed", input.session.id)
      );
      const rollback = await rollbackCompletedSteps(input, steps, events);
      checkpointSequence += 1;
      await saveExecutionCheckpoint(input, checkpointSequence, {
        reason: rollbackCheckpointReason(rollback),
        status: "failed",
        steps,
        events,
        ...(rollback === undefined ? {} : { rollback }),
        lastNodeId: node.id
      });

      return {
        session: { ...input.session, status: "failed" },
        status: "failed",
        steps,
        events,
        ...(rollback === undefined ? {} : { rollback })
      };
    }
  }

  await emitExecutionEvent(
    input,
    events,
    createExecutionEvent("execution.session.completed", input.session.id)
  );
  checkpointSequence += 1;
  await saveExecutionCheckpoint(input, checkpointSequence, {
    reason: "session_completed",
    status: "completed",
    steps,
    events
  });

  return {
    session: { ...input.session, status: "completed" },
    status: "completed",
    steps,
    events
  };
}

function validatedResourceUsage(
  usage: ExecutionResourceUsage | undefined
): ExecutionResourceUsage | undefined {
  if (usage === undefined) {
    return undefined;
  }
  if (!Number.isFinite(usage.cost) || usage.cost < 0) {
    throw new Error("Execution resource usage cost must be finite and non-negative.");
  }
  if (usage.unit.trim().length === 0) {
    throw new Error("Execution resource usage unit is required.");
  }
  if (usage.evidenceRef.trim().length === 0) {
    throw new Error("Execution resource usage evidence is required.");
  }

  return { ...usage };
}

async function executeNodeWithRetry(
  input: RunSequentialWorkflowInput,
  node: ExecutionWorkflowNode,
  handler: WorkflowNodeHandler,
  steps: ExecutionStepResult[],
  events: ExecutionEvent[]
): Promise<ExecuteWorkflowNodeResult> {
  const maxAttempts = Math.max(1, node.retryPolicy?.maxAttempts ?? 1);
  const initialDelayMs = node.retryPolicy?.initialDelayMs ?? 0;
  const backoffMultiplier = node.retryPolicy?.backoffMultiplier ?? 1;
  let lastError: unknown = new Error("Workflow node failed");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await handler({
        session: input.session,
        node,
        previousOutputs: steps
      });
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        const delayMs = retryDelayMs(initialDelayMs, backoffMultiplier, attempt);
        await emitExecutionEvent(
          input,
          events,
          createExecutionEvent("execution.step.retrying", input.session.id, node.id, {
            attempt,
            delayMs
          })
        );
        await scheduleExecutionDelay(input, delayMs);
      }
    }
  }

  throw lastError;
}

async function emitExecutionEvent(
  input: RunSequentialWorkflowInput,
  events: ExecutionEvent[],
  event: ExecutionEvent
): Promise<void> {
  events.push(event);
  await input.onEvent?.(event);
}

function rollbackCheckpointReason(
  rollback: ExecutionRollbackResult | undefined
): ExecutionCheckpointReason {
  if (rollback === undefined) {
    return "step_failed";
  }

  return rollback.status === "failed" ? "rollback_failed" : "rollback_completed";
}

async function rollbackCompletedSteps(
  input: RunSequentialWorkflowInput,
  steps: ExecutionStepResult[],
  events: ExecutionEvent[]
): Promise<ExecutionRollbackResult | undefined> {
  const compensatableSteps = steps
    .filter((step) => step.status === "completed" && step.compensation !== undefined)
    .reverse();

  if (compensatableSteps.length === 0) {
    return undefined;
  }

  await emitExecutionEvent(
    input,
    events,
    createExecutionEvent("execution.rollback.started", input.session.id)
  );

  const compensations: ExecutionCompensationResult[] = [];

  for (const step of compensatableSteps) {
    await emitExecutionEvent(
      input,
      events,
      createExecutionEvent(
        "execution.compensation.started",
        input.session.id,
        step.nodeId
      )
    );

    const compensation = await executeStepCompensation(input, step);
    compensations.push(compensation);

    await emitExecutionEvent(
      input,
      events,
      createExecutionEvent(
        compensation.status === "compensated"
          ? "execution.compensation.completed"
          : "execution.compensation.failed",
        input.session.id,
        step.nodeId
      )
    );

    if (compensation.status === "failed") {
      await emitExecutionEvent(
        input,
        events,
        createExecutionEvent("execution.rollback.failed", input.session.id)
      );

      return {
        status: "failed",
        compensations
      };
    }
  }

  await emitExecutionEvent(
    input,
    events,
    createExecutionEvent("execution.rollback.completed", input.session.id)
  );

  return {
    status: "completed",
    compensations
  };
}

async function executeStepCompensation(
  input: RunSequentialWorkflowInput,
  step: ExecutionStepResult
): Promise<ExecutionCompensationResult> {
  const plan = step.compensation;

  if (plan === undefined) {
    return {
      nodeId: step.nodeId,
      status: "failed",
      outputs: {},
      evidenceRefs: [],
      error: "Step has no compensation plan"
    };
  }

  switch (plan.type) {
    case "provider": {
      if (input.providerRegistry === undefined) {
        return {
          nodeId: step.nodeId,
          status: "failed",
          outputs: {},
          evidenceRefs: [],
          error: "Provider registry is required for provider compensation"
        };
      }

      const result = await executeProvider(
        input.providerRegistry,
        {
          providerId: plan.providerId,
          capabilityId: plan.capabilityId,
          inputs: plan.inputs,
          executionContextId: input.session.id,
          compensationRef: plan.compensationRef
        },
        input.providerExecuteOptions
      );

      if (result.status === "compensated" && result.result !== undefined) {
        return {
          nodeId: step.nodeId,
          status: "compensated",
          outputs: result.result.outputs,
          evidenceRefs: result.result.evidence
        };
      }

      return {
        nodeId: step.nodeId,
        status: "failed",
        outputs: {},
        evidenceRefs: [],
        error: result.error ?? `Compensation failed for ${step.nodeId}`
      };
    }
  }
}

function resolveWorkflowNodeHandler(
  input: RunSequentialWorkflowInput,
  node: ExecutionWorkflowNode
): WorkflowNodeHandler | undefined {
  const handler = input.handlers[node.type];

  if (handler !== undefined) {
    return handler;
  }

  if (node.type === "wait") {
    return createWaitNodeHandler(input);
  }

  if (node.type === "approval") {
    return createApprovalNodeHandler();
  }

  if (node.type === "human_provider") {
    return createHumanProviderNodeHandler();
  }

  if (node.type === "parallel") {
    return createParallelNodeHandler(input);
  }

  return undefined;
}

function createWaitNodeHandler(input: RunSequentialWorkflowInput): WorkflowNodeHandler {
  return async ({ node }) => {
    const delayMs = requiredNonNegativeNumberInput(node, "delayMs");
    await scheduleExecutionDelay(input, delayMs);

    return {
      outputs: { waitedMs: delayMs },
      evidenceRefs: [`execution.wait:${node.id}`]
    };
  };
}

function createApprovalNodeHandler(): WorkflowNodeHandler {
  return ({ node }) => {
    const approvalRequestId = requiredStringInput(node, "approvalRequestId");
    const reason = requiredStringInput(node, "reason");

    return {
      status: "waiting",
      outputs: {
        approvalRequestId,
        reason
      },
      evidenceRefs: [`execution.approval:${approvalRequestId}`]
    };
  };
}

function createHumanProviderNodeHandler(): WorkflowNodeHandler {
  return ({ node }) => {
    const humanProviderId = requiredStringInput(node, "humanProviderId");
    const task = requiredStringInput(node, "task");
    const instructions = requiredStringInput(node, "instructions");

    return {
      status: "waiting",
      outputs: {
        humanProviderId,
        task,
        instructions
      },
      evidenceRefs: [`execution.human_provider:${humanProviderId}`]
    };
  };
}

function createParallelNodeHandler(
  input: RunSequentialWorkflowInput
): WorkflowNodeHandler {
  return async ({ session, node }) => {
    const branches = requiredParallelBranchesInput(node);
    const branchRuns = await Promise.all(
      branches.map(async (branch) => ({
        branchId: branch.id,
        result: await runSequentialWorkflow(
          branchRunInput(input, session, node, branch)
        )
      }))
    );
    const failedBranch = branchRuns.find((branch) => branch.result.status === "failed");

    if (failedBranch !== undefined) {
      throw new Error(`Parallel branch failed: ${failedBranch.branchId}`);
    }

    const waitingBranch = branchRuns.find(
      (branch) => branch.result.status === "waiting"
    );

    return {
      status: waitingBranch === undefined ? "completed" : "waiting",
      outputs: {
        branches: branchRuns.map((branch) => ({
          branchId: branch.branchId,
          status: branch.result.status,
          steps: branch.result.steps
        }))
      },
      evidenceRefs: [`execution.parallel:${node.id}`]
    };
  };
}

function branchRunInput(
  input: RunSequentialWorkflowInput,
  session: ExecutionSession,
  node: ExecutionWorkflowNode,
  branch: ExecutionParallelBranch
): RunSequentialWorkflowInput {
  return {
    session: createExecutionSession({
      id: `${session.id}:${node.id}:${branch.id}`,
      workflowId: `${input.workflow.id}:${node.id}:${branch.id}`,
      startedAt: session.startedAt
    }),
    workflow: {
      id: `${input.workflow.id}:${node.id}:${branch.id}`,
      version: input.workflow.version,
      nodes: branch.nodes,
      edges: branch.edges
    },
    handlers: input.handlers,
    ...(input.scheduleDelay === undefined
      ? {}
      : { scheduleDelay: input.scheduleDelay }),
    ...(input.checkpointStore === undefined
      ? {}
      : { checkpointStore: input.checkpointStore }),
    ...(input.checkpointClock === undefined
      ? {}
      : { checkpointClock: input.checkpointClock }),
    ...(input.onEvent === undefined ? {} : { onEvent: input.onEvent }),
    ...(input.providerRegistry === undefined
      ? {}
      : { providerRegistry: input.providerRegistry }),
    ...(input.providerExecuteOptions === undefined
      ? {}
      : { providerExecuteOptions: input.providerExecuteOptions })
  };
}

async function saveExecutionCheckpoint(
  input: RunSequentialWorkflowInput,
  checkpointSequence: number,
  checkpoint: {
    reason: ExecutionCheckpointReason;
    status: ExecutionSessionStatus;
    steps: ExecutionStepResult[];
    events: ExecutionEvent[];
    rollback?: ExecutionRollbackResult;
    lastNodeId?: string;
  }
): Promise<void> {
  if (input.checkpointStore === undefined) {
    return;
  }

  const executionCheckpoint = {
    id: `${input.session.id}:checkpoint:${checkpointSequence}`,
    executionId: input.session.id,
    workflowId: input.workflow.id,
    reason: checkpoint.reason,
    status: checkpoint.status,
    completedNodeIds: checkpoint.steps
      .filter((step) => step.status === "completed")
      .map((step) => step.nodeId),
    failedNodeIds: checkpoint.steps
      .filter((step) => step.status === "failed")
      .map((step) => step.nodeId),
    steps: checkpoint.steps.map((step) => ({ ...step })),
    events: checkpoint.events.map((event) => ({ ...event })),
    ...(checkpoint.rollback === undefined ? {} : { rollback: checkpoint.rollback }),
    createdAt: (input.checkpointClock ?? (() => new Date().toISOString()))(),
    ...(checkpoint.lastNodeId === undefined
      ? {}
      : { lastNodeId: checkpoint.lastNodeId })
  };

  await input.checkpointStore.save(executionCheckpoint);
}

export function createProviderBackedCapabilityHandler(
  input: ProviderBackedCapabilityHandlerInput
): WorkflowNodeHandler {
  return async ({ session, node }) => {
    const providerId = requiredStringInput(node, "providerId");
    const capabilityId = requiredStringInput(node, "capabilityId");
    const providerInputs = requiredRecordInput(node, "inputs");
    const providerResult = await executeProvider(
      input.registry,
      {
        providerId,
        capabilityId,
        inputs: providerInputs,
        executionContextId: session.id
      },
      input.executeOptions
    );

    if (providerResult.status !== "completed" || providerResult.result === undefined) {
      throw new Error(
        providerResult.error ?? `Provider execution failed: ${providerId}`
      );
    }

    return {
      outputs: providerResult.result.outputs,
      evidenceRefs: providerResult.result.evidence,
      ...(providerResult.result.compensationRef === undefined
        ? {}
        : {
            compensation: {
              type: "provider",
              providerId,
              capabilityId,
              inputs: providerInputs,
              compensationRef: providerResult.result.compensationRef
            }
          })
    };
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
  nodeId?: string,
  metadata: Pick<ExecutionEvent, "attempt" | "delayMs"> = {}
): ExecutionEvent {
  return nodeId === undefined
    ? { type, executionId, ...metadata }
    : { type, executionId, nodeId, ...metadata };
}

async function scheduleExecutionDelay(
  input: RunSequentialWorkflowInput,
  delayMs: number
): Promise<void> {
  if (delayMs <= 0) {
    return;
  }

  if (input.scheduleDelay !== undefined) {
    await input.scheduleDelay(delayMs);
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

function requiredStringInput(node: ExecutionWorkflowNode, key: string): string {
  const value = node.inputs[key];

  if (typeof value !== "string") {
    throw new Error(`Capability node ${node.id} missing string input: ${key}`);
  }

  return value;
}

function requiredRecordInput(
  node: ExecutionWorkflowNode,
  key: string
): Record<string, unknown> {
  const value = node.inputs[key];

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Capability node ${node.id} missing object input: ${key}`);
  }

  return { ...value };
}

function requiredParallelBranchesInput(
  node: ExecutionWorkflowNode
): ExecutionParallelBranch[] {
  const value = node.inputs.branches;

  if (!Array.isArray(value)) {
    throw new Error(`Parallel node ${node.id} missing branches array`);
  }

  return value.map((branch, index) => {
    if (typeof branch !== "object" || branch === null || Array.isArray(branch)) {
      throw new Error(`Parallel node ${node.id} has invalid branch at index ${index}`);
    }

    const branchRecord = branch as Record<string, unknown>;
    const id = branchRecord.id;
    const nodes = branchRecord.nodes;
    const edges = branchRecord.edges;

    if (typeof id !== "string") {
      throw new Error(`Parallel node ${node.id} branch missing string id`);
    }

    if (!Array.isArray(nodes)) {
      throw new Error(`Parallel node ${node.id} branch ${id} missing nodes array`);
    }

    if (!Array.isArray(edges)) {
      throw new Error(`Parallel node ${node.id} branch ${id} missing edges array`);
    }

    return {
      id,
      nodes: nodes.map((branchNode) =>
        assertExecutionWorkflowNode(node.id, id, branchNode)
      ),
      edges: edges.map((edge) => assertExecutionWorkflowEdge(node.id, id, edge))
    };
  });
}

function assertExecutionWorkflowNode(
  parallelNodeId: string,
  branchId: string,
  value: unknown
): ExecutionWorkflowNode {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      `Parallel node ${parallelNodeId} branch ${branchId} has invalid node`
    );
  }

  const nodeRecord = value as Record<string, unknown>;

  if (typeof nodeRecord.id !== "string") {
    throw new Error(
      `Parallel node ${parallelNodeId} branch ${branchId} node missing id`
    );
  }

  if (typeof nodeRecord.type !== "string") {
    throw new Error(
      `Parallel node ${parallelNodeId} branch ${branchId} node missing type`
    );
  }

  if (
    typeof nodeRecord["inputs"] !== "object" ||
    nodeRecord["inputs"] === null ||
    Array.isArray(nodeRecord["inputs"])
  ) {
    throw new Error(
      `Parallel node ${parallelNodeId} branch ${branchId} node missing inputs`
    );
  }

  return {
    id: nodeRecord.id,
    type: nodeRecord.type as ExecutionWorkflowNodeType,
    inputs: { ...(nodeRecord["inputs"] as Record<string, unknown>) },
    ...(isExecutionRetryPolicy(nodeRecord["retryPolicy"])
      ? { retryPolicy: nodeRecord["retryPolicy"] }
      : {})
  };
}

function assertExecutionWorkflowEdge(
  parallelNodeId: string,
  branchId: string,
  value: unknown
): ExecutionWorkflowEdge {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      `Parallel node ${parallelNodeId} branch ${branchId} has invalid edge`
    );
  }

  const edgeRecord = value as Record<string, unknown>;

  if (
    typeof edgeRecord.fromNodeId !== "string" ||
    typeof edgeRecord.toNodeId !== "string"
  ) {
    throw new Error(
      `Parallel node ${parallelNodeId} branch ${branchId} edge missing node ids`
    );
  }

  return {
    fromNodeId: edgeRecord.fromNodeId,
    toNodeId: edgeRecord.toNodeId,
    ...(typeof edgeRecord.condition === "string"
      ? { condition: edgeRecord.condition }
      : {})
  };
}

function isExecutionRetryPolicy(value: unknown): value is ExecutionRetryPolicy {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const retryPolicy = value as Record<string, unknown>;
  return typeof retryPolicy["maxAttempts"] === "number";
}

function requiredNonNegativeNumberInput(
  node: ExecutionWorkflowNode,
  key: string
): number {
  const value = node.inputs[key];

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Wait node ${node.id} missing non-negative number input: ${key}`);
  }

  return value;
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
