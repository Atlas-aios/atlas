import { createHash } from "node:crypto";

import type { AtlasPlan } from "@atlas-aios/brain";
import type {
  CapabilityResolution,
  CapabilityResolutionRequest
} from "@atlas-aios/capability-kernel";
import {
  createDefaultDecisionEngine,
  type DecisionAlternative,
  type DecisionAuthorityMode,
  type DecisionExternalImpact,
  type DecisionOutcome,
  type DecisionRequest,
  type DecisionRisk,
  type DecisionReversibility
} from "@atlas-aios/decision-engine";
import {
  createExecutionSession,
  evaluateExecutionGate,
  runSequentialWorkflow,
  type ExecuteWorkflowNodeInput,
  type ExecuteWorkflowNodeResult,
  type ExecutionGateOutcome,
  type ExecutionRunResult
} from "@atlas-aios/execution-engine";
import {
  createAtlasFlow,
  type AtlasFlow,
  type AtlasFlowEdge,
  type AtlasFlowNode
} from "@atlas-aios/workflow-dsl";

export type PlanRunStatus =
  | "preparing"
  | "waiting_for_approval"
  | "waiting_for_discussion"
  | "blocked"
  | "executing"
  | "completed"
  | "failed";

export interface PlanRunStepPolicy {
  inputs: Record<string, unknown>;
  reversibility: DecisionReversibility;
  externalImpacts: DecisionExternalImpact[];
  alternatives?: DecisionAlternative[];
  risks?: DecisionRisk[];
  humanRequired?: boolean;
}

export interface StartPlanRunInput {
  id: string;
  plan: AtlasPlan;
  requesterIdentityId: string;
  authorityMode: DecisionAuthorityMode;
  governanceContextId: string;
  startedAt: string;
  steps: Record<string, PlanRunStepPolicy>;
}

export interface PlanStepSimulation {
  id: string;
  status: "simulated" | "blocked" | "failed";
  evidenceRefs: string[];
}

export interface PlanRunStepState {
  stepId: string;
  capabilityId: string;
  providerId: string;
  inputs: Record<string, unknown>;
  policy: PlanRunStepPolicy;
  resolution: CapabilityResolution;
  decision: DecisionOutcome;
  gate: ExecutionGateOutcome;
  simulation?: PlanStepSimulation;
  approvalRequestId?: string;
}

export interface PlanRun {
  id: string;
  requestFingerprint: string;
  planId: string;
  goalId: string;
  status: PlanRunStatus;
  startedAt: string;
  requesterIdentityId: string;
  authorityMode: DecisionAuthorityMode;
  governanceContextId: string;
  steps: PlanRunStepState[];
  workflow?: AtlasFlow;
  execution?: ExecutionRunResult;
  failureReason?: string;
}

export interface ResumePlanRunInput {
  run: PlanRun;
  plan: AtlasPlan;
  approvedApprovalRequestIds: string[];
  resumedAt: string;
}

export class PlanRunApprovalError extends Error {
  readonly code = "approval_not_satisfied";

  constructor(readonly approvalRequestId: string) {
    super(`Plan run approval is not satisfied: ${approvalRequestId}.`);
    this.name = "PlanRunApprovalError";
  }
}

export interface PlanOrchestratorDependencies {
  resolveCapability(
    request: CapabilityResolutionRequest
  ): Promise<CapabilityResolution>;
  simulateStep(input: {
    runId: string;
    stepId: string;
    goalId: string;
    capabilityId: string;
    providerId: string;
    inputs: Record<string, unknown>;
    startedAt: string;
  }): Promise<PlanStepSimulation>;
  requestApproval(input: {
    runId: string;
    goalId: string;
    governanceContextId: string;
    step: PlanRunStepState;
    requestedAt: string;
  }): Promise<string> | string;
  executeCapability(
    input: ExecuteWorkflowNodeInput
  ): Promise<ExecuteWorkflowNodeResult> | ExecuteWorkflowNodeResult;
}

export async function startPlanRun(
  input: StartPlanRunInput,
  dependencies: PlanOrchestratorDependencies
): Promise<PlanRun> {
  const decisionEngine = createDefaultDecisionEngine();
  const stepStates: PlanRunStepState[] = [];

  for (const step of input.plan.steps) {
    const policy = input.steps[step.id];
    if (policy === undefined) {
      throw new Error(`Plan run is missing policy and inputs for step ${step.id}.`);
    }

    const resolution = await dependencies.resolveCapability({
      goalId: input.plan.goalId,
      capabilityId: step.capabilityId,
      inputs: policy.inputs,
      governanceContextId: input.governanceContextId
    });
    const decision = decisionEngine.decide(
      createStepDecisionRequest(input, step, policy, resolution)
    );
    const gate = evaluateExecutionGate({
      executionId: `${input.id}:execution`,
      capabilityId: step.capabilityId,
      providerId: resolution.selectedProviderId,
      decisionOutcome: decision
    });

    stepStates.push({
      stepId: step.id,
      capabilityId: step.capabilityId,
      providerId: resolution.selectedProviderId,
      inputs: { ...policy.inputs },
      policy: cloneStepPolicy(policy),
      resolution,
      decision,
      gate
    });
  }

  for (let index = 0; index < stepStates.length; index += 1) {
    const stepState = stepStates[index];
    const planStep = input.plan.steps[index];
    if (
      stepState === undefined ||
      planStep === undefined ||
      stepState.gate.requiredAction !== "simulate"
    ) {
      continue;
    }

    const simulation = await dependencies.simulateStep({
      runId: input.id,
      stepId: stepState.stepId,
      goalId: input.plan.goalId,
      capabilityId: stepState.capabilityId,
      providerId: stepState.providerId,
      inputs: stepState.inputs,
      startedAt: input.startedAt
    });
    stepState.simulation = simulation;

    if (simulation.status !== "simulated") {
      return createStoppedPlanRun(input, stepStates, "failed", {
        failureReason: `Simulation ${simulation.id} ended with status ${simulation.status}.`
      });
    }

    stepState.decision = decisionEngine.decide(
      createStepDecisionRequest(
        input,
        planStep,
        stepState.policy,
        stepState.resolution,
        simulation.evidenceRefs
      )
    );
    stepState.gate = evaluateExecutionGate({
      executionId: `${input.id}:execution`,
      capabilityId: stepState.capabilityId,
      providerId: stepState.providerId,
      decisionOutcome: stepState.decision
    });
  }

  for (const stepState of stepStates) {
    if (stepState.gate.requiredAction === "delegate") {
      stepState.approvalRequestId = await dependencies.requestApproval({
        runId: input.id,
        goalId: input.plan.goalId,
        governanceContextId: input.governanceContextId,
        step: stepState,
        requestedAt: input.startedAt
      });
    }
  }

  if (stepStates.some((step) => step.gate.status === "blocked")) {
    return createStoppedPlanRun(input, stepStates, "blocked");
  }

  if (
    stepStates.some(
      (step) =>
        step.gate.requiredAction === "discuss" ||
        step.gate.requiredAction === "revise_plan"
    )
  ) {
    return createStoppedPlanRun(input, stepStates, "waiting_for_discussion");
  }

  if (stepStates.some((step) => step.approvalRequestId !== undefined)) {
    return createStoppedPlanRun(input, stepStates, "waiting_for_approval");
  }

  if (stepStates.some((step) => !isAllowedGate(step.gate))) {
    return {
      ...createStoppedPlanRun(input, stepStates, "blocked"),
      failureReason: "One or more execution gates did not allow execution."
    };
  }

  return executePlanRun(input, stepStates, dependencies);
}

export function createPlanRunRequestFingerprint(input: StartPlanRunInput): string {
  return `sha256:${createHash("sha256").update(stableStringify(input)).digest("hex")}`;
}

export async function resumePlanRun(
  input: ResumePlanRunInput,
  dependencies: PlanOrchestratorDependencies
): Promise<PlanRun> {
  if (input.run.status !== "waiting_for_approval") {
    throw new Error(`Plan run ${input.run.id} is not waiting for approval.`);
  }

  if (input.plan.id !== input.run.planId) {
    throw new Error(`Plan ${input.plan.id} does not match run ${input.run.id}.`);
  }

  const decisionEngine = createDefaultDecisionEngine();
  const startInput: StartPlanRunInput = {
    id: input.run.id,
    plan: input.plan,
    requesterIdentityId: input.run.requesterIdentityId,
    authorityMode: input.run.authorityMode,
    governanceContextId: input.run.governanceContextId,
    startedAt: input.run.startedAt,
    steps: Object.fromEntries(
      input.run.steps.map((step) => [step.stepId, cloneStepPolicy(step.policy)])
    )
  };

  for (const stepState of input.run.steps) {
    const approvalRequestId = stepState.approvalRequestId;
    if (
      approvalRequestId === undefined ||
      !input.approvedApprovalRequestIds.includes(approvalRequestId)
    ) {
      throw new PlanRunApprovalError(
        approvalRequestId ?? `approval:${input.run.id}:${stepState.stepId}`
      );
    }

    const planStep = input.plan.steps.find((step) => step.id === stepState.stepId);
    if (planStep === undefined) {
      throw new Error(`Plan step ${stepState.stepId} no longer exists.`);
    }

    stepState.decision = decisionEngine.decide(
      createStepDecisionRequest(
        startInput,
        planStep,
        stepState.policy,
        stepState.resolution,
        stepState.simulation?.evidenceRefs ?? [],
        [approvalRequestId]
      )
    );
    stepState.gate = evaluateExecutionGate({
      executionId: `${input.run.id}:execution`,
      capabilityId: stepState.capabilityId,
      providerId: stepState.providerId,
      decisionOutcome: stepState.decision
    });
  }

  if (input.run.steps.some((step) => !isAllowedGate(step.gate))) {
    return createStoppedPlanRun(startInput, input.run.steps, "blocked", {
      failureReason:
        "Decision Engine did not allow execution after approval reconsideration."
    });
  }

  return executePlanRun(startInput, input.run.steps, dependencies, input.resumedAt);
}

function createStepDecisionRequest(
  input: StartPlanRunInput,
  step: AtlasPlan["steps"][number],
  policy: PlanRunStepPolicy,
  resolution: CapabilityResolution,
  simulationEvidenceRefs: string[] = [],
  approvalEvidenceRefs: string[] = []
): DecisionRequest {
  return {
    id: `decision:${input.id}:${step.id}`,
    goalId: input.plan.goalId,
    action: step.purpose,
    actionType: "capability_execution",
    rationale: input.plan.rationale,
    reversibility: policy.reversibility,
    externalImpacts: [...policy.externalImpacts],
    risks: [
      ...input.plan.risks.map((risk) => ({
        kind: "brain_plan_risk",
        severity: "medium" as const,
        description: risk
      })),
      ...(policy.risks ?? []).map((risk) => ({ ...risk }))
    ],
    alternatives: [...(policy.alternatives ?? [])],
    evidenceRefs: [input.plan.id, step.id, resolution.selectedProviderId],
    requesterIdentityId: input.requesterIdentityId,
    authorityMode: input.authorityMode,
    approvalRequired: step.requiresApproval || resolution.approvalRequired,
    simulationRequired: resolution.simulationRequired,
    ...(simulationEvidenceRefs.length === 0
      ? {}
      : { simulationEvidenceRefs: [...simulationEvidenceRefs] }),
    ...(approvalEvidenceRefs.length === 0
      ? {}
      : { approvalEvidenceRefs: [...approvalEvidenceRefs] }),
    ...(policy.humanRequired === undefined
      ? {}
      : { humanRequired: policy.humanRequired })
  };
}

function createStoppedPlanRun(
  input: StartPlanRunInput,
  steps: PlanRunStepState[],
  status: Extract<
    PlanRunStatus,
    "waiting_for_approval" | "waiting_for_discussion" | "blocked" | "failed"
  >,
  extra: Pick<PlanRun, "failureReason"> | Record<string, never> = {}
): PlanRun {
  return {
    id: input.id,
    requestFingerprint: createPlanRunRequestFingerprint(input),
    planId: input.plan.id,
    goalId: input.plan.goalId,
    status,
    startedAt: input.startedAt,
    requesterIdentityId: input.requesterIdentityId,
    authorityMode: input.authorityMode,
    governanceContextId: input.governanceContextId,
    steps,
    ...extra
  };
}

function isAllowedGate(gate: ExecutionGateOutcome): boolean {
  return gate.status === "allowed" || gate.status === "allowed_with_constraints";
}

function cloneStepPolicy(policy: PlanRunStepPolicy): PlanRunStepPolicy {
  return {
    inputs: { ...policy.inputs },
    reversibility: policy.reversibility,
    externalImpacts: [...policy.externalImpacts],
    ...(policy.alternatives === undefined
      ? {}
      : { alternatives: policy.alternatives.map((item) => ({ ...item })) }),
    ...(policy.risks === undefined
      ? {}
      : { risks: policy.risks.map((risk) => ({ ...risk })) }),
    ...(policy.humanRequired === undefined
      ? {}
      : { humanRequired: policy.humanRequired })
  };
}

async function executePlanRun(
  input: StartPlanRunInput,
  steps: PlanRunStepState[],
  dependencies: PlanOrchestratorDependencies,
  executionStartedAt: string = input.startedAt
): Promise<PlanRun> {
  const workflow = compilePlanRunAtlasFlow(input.id, steps);
  const execution = await runSequentialWorkflow({
    session: createExecutionSession({
      id: `${input.id}:execution`,
      workflowId: workflow.id,
      startedAt: executionStartedAt
    }),
    workflow: {
      id: workflow.id,
      version: workflow.version,
      nodes: workflow.nodes,
      edges: workflow.edges.map((edge) => ({
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        ...(edge.condition === undefined ? {} : { condition: edge.condition })
      }))
    },
    handlers: {
      capability: dependencies.executeCapability
    }
  });

  return {
    id: input.id,
    requestFingerprint: createPlanRunRequestFingerprint(input),
    planId: input.plan.id,
    goalId: input.plan.goalId,
    status: execution.status === "completed" ? "completed" : "failed",
    startedAt: input.startedAt,
    requesterIdentityId: input.requesterIdentityId,
    authorityMode: input.authorityMode,
    governanceContextId: input.governanceContextId,
    steps,
    workflow,
    execution,
    ...(execution.status === "completed"
      ? {}
      : { failureReason: "AtlasFlow execution did not complete." })
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function compilePlanRunAtlasFlow(runId: string, steps: PlanRunStepState[]): AtlasFlow {
  const nodes: AtlasFlowNode[] = steps.map((step) => ({
    id: step.stepId,
    type: "capability",
    inputs: {
      providerId: step.providerId,
      capabilityId: step.capabilityId,
      inputs: { ...step.inputs }
    }
  }));
  const edges: AtlasFlowEdge[] = steps.slice(1).map((step, index) => ({
    id: `atlasflow:${runId}:edge:${index + 1}`,
    type: "sequence",
    fromNodeId: steps[index]?.stepId ?? "",
    toNodeId: step.stepId
  }));

  return createAtlasFlow({
    id: `atlasflow:${runId}`,
    version: "0.1",
    nodes,
    edges
  });
}
