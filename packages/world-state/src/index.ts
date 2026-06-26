export interface OperationalBlocker {
  id: string;
  summary: string;
  severity: "low" | "medium" | "high" | "critical";
  ownerId?: string;
}

export interface WorldStateSnapshot {
  id: string;
  capturedAt: string;
  activeGoalIds: string[];
  activeExecutionIds: string[];
  blockers: OperationalBlocker[];
}
