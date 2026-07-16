export type GoalStatus =
  | "proposed"
  | "active"
  | "waiting"
  | "blocked"
  | "completed"
  | "cancelled";

export type GoalDependencyStatus = "pending" | "satisfied" | "blocked";
export type GoalDependencyRelationship = "requires" | "blocks" | "related";

export interface GoalDependency {
  id: string;
  goalId: string;
  dependsOnGoalId: string;
  relationship: GoalDependencyRelationship;
  status: GoalDependencyStatus;
  reason: string;
}

export interface GoalWaitingState {
  id: string;
  goalId: string;
  reason: string;
  waitingOn: string;
  createdAt: string;
  expiresAt?: string;
}

export interface GoalCompletionCriterion {
  id: string;
  description: string;
  satisfied: boolean;
  evidenceRefs: string[];
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  ownerId: string;
  priority: number;
  parentGoalId?: string;
  successCriteria: string[];
  completionCriteria: GoalCompletionCriterion[];
  dependencyIds: string[];
  childGoalIds: string[];
  waitingStates: GoalWaitingState[];
  createdAt: string;
  updatedAt: string;
}

export type GoalLifecycleEventType =
  | "goal.created"
  | "goal.status_changed"
  | "goal.decomposed"
  | "goal.dependency_added"
  | "goal.waiting_state_added"
  | "goal.completion_criterion_satisfied";

export interface GoalLifecycleEvent {
  id: string;
  type: GoalLifecycleEventType;
  goalId: string;
  occurredAt: string;
  fromStatus?: GoalStatus;
  toStatus?: GoalStatus;
  sourceRefs: string[];
  summary: string;
}

export interface CreateGoalInput {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  priority: number;
  successCriteria: string[];
  createdAt: string;
  parentGoalId?: string;
  sourceRefs?: string[];
}

export interface CreateGoalResult {
  goal: Goal;
  event: GoalLifecycleEvent;
}

export interface GoalOwnershipDecision {
  goalId: string;
  shouldOwn: boolean;
  reason: string;
  approvalRequired: boolean;
}

export interface TransitionGoalInput {
  goal: Goal;
  eventId: string;
  toStatus: GoalStatus;
  occurredAt: string;
  reason: string;
  sourceRefs?: string[];
}

export type TransitionGoalResult =
  | {
      ok: true;
      goal: Goal;
      event: GoalLifecycleEvent;
    }
  | {
      ok: false;
      error: {
        code: "goal.transition.invalid";
        message: string;
      };
    };

export interface AddGoalDependencyInput {
  goal: Goal;
  dependency: GoalDependency;
  eventId: string;
  occurredAt: string;
}

export interface DecomposeGoalChildInput {
  id: string;
  title: string;
  description?: string;
  priority?: number;
  successCriteria: string[];
}

export interface DecomposeGoalInput {
  goal: Goal;
  childGoals: DecomposeGoalChildInput[];
  eventId: string;
  occurredAt: string;
  sourceRefs?: string[];
}

export interface DecomposeGoalResult {
  parentGoal: Goal;
  childGoals: Goal[];
  event: GoalLifecycleEvent;
}

export interface AddGoalWaitingStateInput {
  goal: Goal;
  waitingState: GoalWaitingState;
  eventId: string;
  occurredAt: string;
}

export interface SatisfyGoalCompletionCriterionInput {
  goal: Goal;
  criterionId: string;
  evidenceRef: string;
  eventId: string;
  occurredAt: string;
}

export type SatisfyGoalCompletionCriterionResult =
  | {
      ok: true;
      goal: Goal;
      event: GoalLifecycleEvent;
    }
  | {
      ok: false;
      error: {
        code: "goal.completion_criterion.not_found";
        message: string;
      };
    };

export const GOAL_STATUS_TRANSITIONS: Record<GoalStatus, GoalStatus[]> = {
  proposed: ["active", "waiting", "blocked", "cancelled"],
  active: ["waiting", "blocked", "completed", "cancelled"],
  waiting: ["active", "blocked", "cancelled"],
  blocked: ["active", "waiting", "cancelled"],
  completed: [],
  cancelled: []
};

export function createGoal(input: CreateGoalInput): CreateGoalResult {
  const goal: Goal = {
    id: input.id,
    title: input.title,
    description: input.description ?? "",
    status: "proposed",
    ownerId: input.ownerId,
    priority: input.priority,
    ...(input.parentGoalId === undefined ? {} : { parentGoalId: input.parentGoalId }),
    successCriteria: input.successCriteria,
    completionCriteria: input.successCriteria.map((description, index) => ({
      id: `${input.id}:criterion:${index + 1}`,
      description,
      satisfied: false,
      evidenceRefs: []
    })),
    dependencyIds: [],
    childGoalIds: [],
    waitingStates: [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  };

  return {
    goal,
    event: {
      id: `${input.id}:event:created`,
      type: "goal.created",
      goalId: input.id,
      occurredAt: input.createdAt,
      toStatus: "proposed",
      sourceRefs: input.sourceRefs ?? [],
      summary: `Goal ${input.id} was created with ${input.successCriteria.length} completion criteria.`
    }
  };
}

export function transitionGoal(input: TransitionGoalInput): TransitionGoalResult {
  const allowed = GOAL_STATUS_TRANSITIONS[input.goal.status].includes(input.toStatus);
  if (!allowed) {
    return {
      ok: false,
      error: {
        code: "goal.transition.invalid",
        message: `Cannot transition goal ${input.goal.id} from ${input.goal.status} to ${input.toStatus}.`
      }
    };
  }

  const goal: Goal = {
    ...input.goal,
    status: input.toStatus,
    updatedAt: input.occurredAt
  };

  return {
    ok: true,
    goal,
    event: {
      id: input.eventId,
      type: "goal.status_changed",
      goalId: input.goal.id,
      occurredAt: input.occurredAt,
      fromStatus: input.goal.status,
      toStatus: input.toStatus,
      sourceRefs: input.sourceRefs ?? [],
      summary: input.reason
    }
  };
}

export function decomposeGoal(input: DecomposeGoalInput): DecomposeGoalResult {
  const childGoals = input.childGoals.map(
    (child) =>
      createGoal({
        id: child.id,
        title: child.title,
        ...(child.description === undefined ? {} : { description: child.description }),
        ownerId: input.goal.ownerId,
        priority: child.priority ?? input.goal.priority,
        successCriteria: child.successCriteria,
        createdAt: input.occurredAt,
        parentGoalId: input.goal.id,
        sourceRefs: [input.goal.id, ...(input.sourceRefs ?? [])]
      }).goal
  );
  const childGoalIds = childGoals.map((goal) => goal.id);

  return {
    parentGoal: {
      ...input.goal,
      childGoalIds: [...input.goal.childGoalIds, ...childGoalIds],
      updatedAt: input.occurredAt
    },
    childGoals,
    event: {
      id: input.eventId,
      type: "goal.decomposed",
      goalId: input.goal.id,
      occurredAt: input.occurredAt,
      sourceRefs: [...(input.sourceRefs ?? []), ...childGoalIds],
      summary: `Goal ${input.goal.id} was decomposed into ${childGoals.length} child goals.`
    }
  };
}

export function addGoalDependency(input: AddGoalDependencyInput): {
  goal: Goal;
  event: GoalLifecycleEvent;
} {
  return {
    goal: {
      ...input.goal,
      dependencyIds: [...input.goal.dependencyIds, input.dependency.id],
      updatedAt: input.occurredAt
    },
    event: {
      id: input.eventId,
      type: "goal.dependency_added",
      goalId: input.goal.id,
      occurredAt: input.occurredAt,
      sourceRefs: [input.dependency.id, input.dependency.dependsOnGoalId],
      summary: input.dependency.reason
    }
  };
}

export function addGoalWaitingState(input: AddGoalWaitingStateInput): {
  goal: Goal;
  event: GoalLifecycleEvent;
} {
  const waitingStates = [...input.goal.waitingStates, input.waitingState];
  return {
    goal: {
      ...input.goal,
      waitingStates,
      status: "waiting",
      updatedAt: input.occurredAt
    },
    event: {
      id: input.eventId,
      type: "goal.waiting_state_added",
      goalId: input.goal.id,
      occurredAt: input.occurredAt,
      fromStatus: input.goal.status,
      toStatus: "waiting",
      sourceRefs: [input.waitingState.id],
      summary: input.waitingState.reason
    }
  };
}

export function satisfyGoalCompletionCriterion(
  input: SatisfyGoalCompletionCriterionInput
): SatisfyGoalCompletionCriterionResult {
  const criterion = input.goal.completionCriteria.find(
    (item) => item.id === input.criterionId
  );
  if (criterion === undefined) {
    return {
      ok: false,
      error: {
        code: "goal.completion_criterion.not_found",
        message: `Goal ${input.goal.id} does not contain completion criterion ${input.criterionId}.`
      }
    };
  }

  const completionCriteria = input.goal.completionCriteria.map((item) =>
    item.id === input.criterionId
      ? {
          ...item,
          satisfied: true,
          evidenceRefs: [...item.evidenceRefs, input.evidenceRef]
        }
      : item
  );

  return {
    ok: true,
    goal: {
      ...input.goal,
      completionCriteria,
      updatedAt: input.occurredAt
    },
    event: {
      id: input.eventId,
      type: "goal.completion_criterion_satisfied",
      goalId: input.goal.id,
      occurredAt: input.occurredAt,
      sourceRefs: [input.criterionId, input.evidenceRef],
      summary: `Completion criterion ${input.criterionId} was satisfied.`
    }
  };
}
