import { describe, expect, it } from "vitest";

import {
  createInMemoryWorldStateStore,
  createWorldStateSnapshot,
  recordWorldStateSnapshot
} from "./index.js";

describe("createWorldStateSnapshot", () => {
  it("captures active goals, active executions, and blockers", () => {
    const snapshot = createWorldStateSnapshot({
      id: "world-state:runtime:2026-07-16T12:45:00.000Z",
      capturedAt: "2026-07-16T12:45:00.000Z",
      goals: [
        { id: "goal:active", status: "active" },
        { id: "goal:waiting", status: "waiting" },
        { id: "goal:blocked", status: "blocked" },
        { id: "goal:completed", status: "completed" }
      ],
      executions: [
        { id: "execution:running", status: "running" },
        { id: "execution:waiting", status: "waiting" },
        { id: "execution:completed", status: "completed" }
      ],
      blockers: [
        {
          id: "blocker:approval:execution:running",
          summary: "Execution is waiting for approval.",
          severity: "high",
          ownerId: "identity:user:moksh"
        }
      ]
    });

    expect(snapshot).toEqual({
      id: "world-state:runtime:2026-07-16T12:45:00.000Z",
      capturedAt: "2026-07-16T12:45:00.000Z",
      activeGoalIds: ["goal:active", "goal:waiting", "goal:blocked"],
      activeExecutionIds: ["execution:running", "execution:waiting"],
      blockers: [
        {
          id: "blocker:approval:execution:running",
          summary: "Execution is waiting for approval.",
          severity: "high",
          ownerId: "identity:user:moksh"
        }
      ]
    });
  });
});

describe("world state store", () => {
  it("records snapshots and returns the latest snapshot", () => {
    const store = createInMemoryWorldStateStore();

    recordWorldStateSnapshot(
      store,
      createWorldStateSnapshot({
        id: "world-state:runtime:old",
        capturedAt: "2026-07-16T12:00:00.000Z",
        goals: [{ id: "goal:old", status: "completed" }],
        executions: [],
        blockers: []
      })
    );
    const latest = recordWorldStateSnapshot(
      store,
      createWorldStateSnapshot({
        id: "world-state:runtime:new",
        capturedAt: "2026-07-16T12:30:00.000Z",
        goals: [{ id: "goal:new", status: "active" }],
        executions: [],
        blockers: []
      })
    );

    expect(store.latest()).toEqual(latest);
    expect(store.list().map((snapshot) => snapshot.id)).toEqual([
      "world-state:runtime:old",
      "world-state:runtime:new"
    ]);
  });

  it("returns copies so callers cannot mutate stored World State snapshots", () => {
    const store = createInMemoryWorldStateStore();
    recordWorldStateSnapshot(
      store,
      createWorldStateSnapshot({
        id: "world-state:runtime:mutable",
        capturedAt: "2026-07-16T12:00:00.000Z",
        goals: [{ id: "goal:active", status: "active" }],
        executions: [],
        blockers: [
          {
            id: "blocker:approval:1",
            summary: "Approval is pending.",
            severity: "medium"
          }
        ]
      })
    );

    const listed = store.list();
    const listedSnapshot = listed[0];
    expect(listedSnapshot).toBeDefined();
    listedSnapshot?.activeGoalIds.push("mutated:goal");
    if (listedSnapshot?.blockers[0] !== undefined) {
      listedSnapshot.blockers[0].summary = "mutated";
    }

    expect(store.latest()).toEqual({
      id: "world-state:runtime:mutable",
      capturedAt: "2026-07-16T12:00:00.000Z",
      activeGoalIds: ["goal:active"],
      activeExecutionIds: [],
      blockers: [
        {
          id: "blocker:approval:1",
          summary: "Approval is pending.",
          severity: "medium"
        }
      ]
    });
  });
});
