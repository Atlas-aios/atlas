export interface OperationalBlocker {
  id: string;
  summary: string;
  severity: "low" | "medium" | "high" | "critical";
  ownerId?: string;
}

export type WorldStateGoalStatus =
  | "proposed"
  | "active"
  | "waiting"
  | "blocked"
  | "completed"
  | "cancelled";

export type WorldStateExecutionStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorldStateGoalInput {
  id: string;
  status: WorldStateGoalStatus;
}

export interface WorldStateExecutionInput {
  id: string;
  status: WorldStateExecutionStatus | string;
}

export interface CreateWorldStateSnapshotInput {
  id: string;
  capturedAt: string;
  goals: WorldStateGoalInput[];
  executions: WorldStateExecutionInput[];
  blockers: OperationalBlocker[];
}

export interface WorldStateSnapshot {
  id: string;
  capturedAt: string;
  activeGoalIds: string[];
  activeExecutionIds: string[];
  blockers: OperationalBlocker[];
}

export interface WorldStateStore {
  record(snapshot: WorldStateSnapshot): WorldStateSnapshot;
  latest(): WorldStateSnapshot | undefined;
  list(): WorldStateSnapshot[];
}

export function createWorldStateSnapshot(
  input: CreateWorldStateSnapshotInput
): WorldStateSnapshot {
  return cloneWorldStateSnapshot({
    id: input.id,
    capturedAt: input.capturedAt,
    activeGoalIds: input.goals
      .filter((goal) => isOperationalGoalStatus(goal.status))
      .map((goal) => goal.id),
    activeExecutionIds: input.executions
      .filter((execution) => isOperationalExecutionStatus(execution.status))
      .map((execution) => execution.id),
    blockers: input.blockers.map(cloneOperationalBlocker)
  });
}

export function createInMemoryWorldStateStore(): WorldStateStore {
  const snapshots: WorldStateSnapshot[] = [];

  return {
    record: (snapshot) => {
      const storedSnapshot = cloneWorldStateSnapshot(snapshot);
      snapshots.push(storedSnapshot);

      return cloneWorldStateSnapshot(storedSnapshot);
    },
    latest: () => {
      const latestSnapshot = snapshots.at(-1);

      return latestSnapshot === undefined
        ? undefined
        : cloneWorldStateSnapshot(latestSnapshot);
    },
    list: () => snapshots.map(cloneWorldStateSnapshot)
  };
}

export function recordWorldStateSnapshot(
  store: WorldStateStore,
  snapshot: WorldStateSnapshot
): WorldStateSnapshot {
  return store.record(snapshot);
}

function isOperationalGoalStatus(status: WorldStateGoalStatus): boolean {
  return status === "active" || status === "waiting" || status === "blocked";
}

function isOperationalExecutionStatus(status: string): boolean {
  return status === "pending" || status === "running" || status === "waiting";
}

function cloneWorldStateSnapshot(snapshot: WorldStateSnapshot): WorldStateSnapshot {
  return {
    ...snapshot,
    activeGoalIds: [...snapshot.activeGoalIds],
    activeExecutionIds: [...snapshot.activeExecutionIds],
    blockers: snapshot.blockers.map(cloneOperationalBlocker)
  };
}

function cloneOperationalBlocker(blocker: OperationalBlocker): OperationalBlocker {
  return { ...blocker };
}
