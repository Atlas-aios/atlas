export type CognitiveLoopPhase =
  | "observe"
  | "update_world_state"
  | "update_memory"
  | "distill_experience"
  | "plan"
  | "simulate"
  | "execute"
  | "evaluate"
  | "learn";

export interface CognitiveLoopCycle {
  id: string;
  goalId?: string;
  phase: CognitiveLoopPhase;
  startedAt: string;
  completedAt?: string;
}
