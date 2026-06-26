export type GoalStatus =
  | "proposed"
  | "active"
  | "waiting"
  | "blocked"
  | "completed"
  | "cancelled";

export interface Goal {
  id: string;
  title: string;
  status: GoalStatus;
  ownerId: string;
  priority: number;
  successCriteria: string[];
}

export interface GoalOwnershipDecision {
  goalId: string;
  shouldOwn: boolean;
  reason: string;
  approvalRequired: boolean;
}
