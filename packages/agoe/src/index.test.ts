import { describe, expect, it } from "vitest";

import {
  GOAL_STATUS_TRANSITIONS,
  addGoalDependency,
  addGoalWaitingState,
  createGoal,
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
});
