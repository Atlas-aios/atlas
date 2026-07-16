import { describe, expect, it } from "vitest";

import {
  GOAL_STATUS_TRANSITIONS,
  addGoalDependency,
  addGoalWaitingState,
  createGoal,
  decomposeGoal,
  monitorGoals,
  satisfyGoalCompletionCriterion,
  transitionGoal
} from "./index.js";

describe("Goal lifecycle", () => {
  it("creates a proposed Goal with priority, owner, criteria, and event metadata", () => {
    expect(
      createGoal({
        id: "goal:unknown-system-create-resource",
        title: "Create a resource in an unknown system",
        description: "Learn the interface and execute safely.",
        ownerId: "identity:user:moksh",
        priority: 90,
        successCriteria: [
          "Interface evidence is collected.",
          "Create Resource is executed or blocked with a clear reason."
        ],
        createdAt: "2026-07-16T10:00:00.000Z",
        sourceRefs: ["request:user:1"]
      })
    ).toEqual({
      goal: {
        id: "goal:unknown-system-create-resource",
        title: "Create a resource in an unknown system",
        description: "Learn the interface and execute safely.",
        status: "proposed",
        ownerId: "identity:user:moksh",
        priority: 90,
        successCriteria: [
          "Interface evidence is collected.",
          "Create Resource is executed or blocked with a clear reason."
        ],
        completionCriteria: [
          {
            id: "goal:unknown-system-create-resource:criterion:1",
            description: "Interface evidence is collected.",
            satisfied: false,
            evidenceRefs: []
          },
          {
            id: "goal:unknown-system-create-resource:criterion:2",
            description: "Create Resource is executed or blocked with a clear reason.",
            satisfied: false,
            evidenceRefs: []
          }
        ],
        dependencyIds: [],
        childGoalIds: [],
        waitingStates: [],
        createdAt: "2026-07-16T10:00:00.000Z",
        updatedAt: "2026-07-16T10:00:00.000Z"
      },
      event: {
        id: "goal:unknown-system-create-resource:event:created",
        type: "goal.created",
        goalId: "goal:unknown-system-create-resource",
        occurredAt: "2026-07-16T10:00:00.000Z",
        toStatus: "proposed",
        sourceRefs: ["request:user:1"],
        summary:
          "Goal goal:unknown-system-create-resource was created with 2 completion criteria."
      }
    });
  });

  it("allows deterministic lifecycle transitions and rejects terminal transitions", () => {
    const { goal } = createGoal({
      id: "goal:create-resource",
      title: "Create Resource",
      ownerId: "identity:user:moksh",
      priority: 80,
      successCriteria: ["Resource creation is planned."],
      createdAt: "2026-07-16T10:05:00.000Z"
    });

    const activated = transitionGoal({
      goal,
      eventId: "event:goal-active",
      toStatus: "active",
      occurredAt: "2026-07-16T10:06:00.000Z",
      reason: "Atlas accepted ownership."
    });

    expect(activated).toMatchObject({
      ok: true,
      goal: {
        status: "active",
        updatedAt: "2026-07-16T10:06:00.000Z"
      },
      event: {
        type: "goal.status_changed",
        fromStatus: "proposed",
        toStatus: "active"
      }
    });

    expect(GOAL_STATUS_TRANSITIONS.completed).toEqual([]);
    expect(
      transitionGoal({
        goal: {
          ...goal,
          status: "completed"
        },
        eventId: "event:invalid",
        toStatus: "active",
        occurredAt: "2026-07-16T10:07:00.000Z",
        reason: "Reopen completed work."
      })
    ).toEqual({
      ok: false,
      error: {
        code: "goal.transition.invalid",
        message: "Cannot transition goal goal:create-resource from completed to active."
      }
    });
  });

  it("adds dependencies, waiting states, and completion evidence", () => {
    const { goal } = createGoal({
      id: "goal:create-resource",
      title: "Create Resource",
      ownerId: "identity:user:moksh",
      priority: 80,
      successCriteria: ["Approval is collected."],
      createdAt: "2026-07-16T10:10:00.000Z"
    });
    const withDependency = addGoalDependency({
      goal,
      dependency: {
        id: "goal-dependency:approval",
        goalId: "goal:create-resource",
        dependsOnGoalId: "goal:approve-external-write",
        relationship: "requires",
        status: "pending",
        reason: "External write approval must happen first."
      },
      eventId: "event:dependency-added",
      occurredAt: "2026-07-16T10:11:00.000Z"
    });
    const waiting = addGoalWaitingState({
      goal: withDependency.goal,
      waitingState: {
        id: "waiting:approval",
        goalId: "goal:create-resource",
        reason: "Waiting for project owner approval.",
        waitingOn: "identity:user:moksh",
        createdAt: "2026-07-16T10:12:00.000Z"
      },
      eventId: "event:waiting-added",
      occurredAt: "2026-07-16T10:12:00.000Z"
    });

    expect(waiting.goal).toMatchObject({
      status: "waiting",
      dependencyIds: ["goal-dependency:approval"],
      waitingStates: [
        {
          id: "waiting:approval",
          waitingOn: "identity:user:moksh"
        }
      ]
    });

    expect(
      satisfyGoalCompletionCriterion({
        goal: waiting.goal,
        criterionId: "goal:create-resource:criterion:1",
        evidenceRef: "approval:event:approved",
        eventId: "event:criterion-satisfied",
        occurredAt: "2026-07-16T10:13:00.000Z"
      })
    ).toMatchObject({
      ok: true,
      goal: {
        completionCriteria: [
          {
            id: "goal:create-resource:criterion:1",
            satisfied: true,
            evidenceRefs: ["approval:event:approved"]
          }
        ]
      },
      event: {
        type: "goal.completion_criterion_satisfied",
        sourceRefs: ["goal:create-resource:criterion:1", "approval:event:approved"]
      }
    });
  });

  it("decomposes a parent Goal into ordered child Goals with provenance", () => {
    const { goal } = createGoal({
      id: "goal:learn-unknown-system",
      title: "Learn unknown system and create resource",
      ownerId: "identity:user:moksh",
      priority: 95,
      successCriteria: ["Atlas creates the requested resource safely."],
      createdAt: "2026-07-16T10:20:00.000Z"
    });

    expect(
      decomposeGoal({
        goal,
        eventId: "event:goal-decomposed",
        occurredAt: "2026-07-16T10:21:00.000Z",
        childGoals: [
          {
            id: "goal:collect-interface-evidence",
            title: "Collect interface evidence",
            successCriteria: ["Docs, API, and UI evidence are collected."]
          },
          {
            id: "goal:execute-create-resource",
            title: "Execute Create Resource",
            successCriteria: ["Create Resource is executed or safely blocked."]
          }
        ],
        sourceRefs: ["plan:initial"]
      })
    ).toEqual({
      parentGoal: {
        ...goal,
        childGoalIds: [
          "goal:collect-interface-evidence",
          "goal:execute-create-resource"
        ],
        updatedAt: "2026-07-16T10:21:00.000Z"
      },
      childGoals: [
        {
          id: "goal:collect-interface-evidence",
          title: "Collect interface evidence",
          description: "",
          status: "proposed",
          ownerId: "identity:user:moksh",
          priority: 95,
          parentGoalId: "goal:learn-unknown-system",
          successCriteria: ["Docs, API, and UI evidence are collected."],
          completionCriteria: [
            {
              id: "goal:collect-interface-evidence:criterion:1",
              description: "Docs, API, and UI evidence are collected.",
              satisfied: false,
              evidenceRefs: []
            }
          ],
          dependencyIds: [],
          childGoalIds: [],
          waitingStates: [],
          createdAt: "2026-07-16T10:21:00.000Z",
          updatedAt: "2026-07-16T10:21:00.000Z"
        },
        {
          id: "goal:execute-create-resource",
          title: "Execute Create Resource",
          description: "",
          status: "proposed",
          ownerId: "identity:user:moksh",
          priority: 95,
          parentGoalId: "goal:learn-unknown-system",
          successCriteria: ["Create Resource is executed or safely blocked."],
          completionCriteria: [
            {
              id: "goal:execute-create-resource:criterion:1",
              description: "Create Resource is executed or safely blocked.",
              satisfied: false,
              evidenceRefs: []
            }
          ],
          dependencyIds: [],
          childGoalIds: [],
          waitingStates: [],
          createdAt: "2026-07-16T10:21:00.000Z",
          updatedAt: "2026-07-16T10:21:00.000Z"
        }
      ],
      event: {
        id: "event:goal-decomposed",
        type: "goal.decomposed",
        goalId: "goal:learn-unknown-system",
        occurredAt: "2026-07-16T10:21:00.000Z",
        sourceRefs: [
          "plan:initial",
          "goal:collect-interface-evidence",
          "goal:execute-create-resource"
        ],
        summary: "Goal goal:learn-unknown-system was decomposed into 2 child goals."
      }
    });
  });

  it("monitors active Goals and completes them when all criteria are satisfied", () => {
    const { goal } = createGoal({
      id: "goal:complete-resource",
      title: "Complete Resource",
      ownerId: "identity:user:moksh",
      priority: 70,
      successCriteria: ["Execution evidence is recorded."],
      createdAt: "2026-07-16T10:30:00.000Z"
    });
    const active = transitionGoal({
      goal,
      eventId: "event:goal-active",
      toStatus: "active",
      occurredAt: "2026-07-16T10:31:00.000Z",
      reason: "Goal execution started."
    });
    if (!active.ok) {
      throw new Error("Expected active transition to succeed.");
    }
    const satisfied = satisfyGoalCompletionCriterion({
      goal: active.goal,
      criterionId: "goal:complete-resource:criterion:1",
      evidenceRef: "execution:completed",
      eventId: "event:criterion-satisfied",
      occurredAt: "2026-07-16T10:32:00.000Z"
    });
    if (!satisfied.ok) {
      throw new Error("Expected criterion satisfaction to succeed.");
    }

    expect(
      monitorGoals({
        goals: [satisfied.goal],
        checkedAt: "2026-07-16T10:33:00.000Z",
        eventIdPrefix: "event:monitor"
      })
    ).toEqual({
      updates: [
        {
          goal: {
            ...satisfied.goal,
            status: "completed",
            updatedAt: "2026-07-16T10:33:00.000Z"
          },
          event: {
            id: "event:monitor:goal:complete-resource:completed",
            type: "goal.status_changed",
            goalId: "goal:complete-resource",
            occurredAt: "2026-07-16T10:33:00.000Z",
            fromStatus: "active",
            toStatus: "completed",
            sourceRefs: ["goal:complete-resource:criterion:1"],
            summary: "All completion criteria are satisfied."
          }
        }
      ]
    });
  });
});
