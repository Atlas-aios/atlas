export type MemoryEventKind =
  | "conversation"
  | "execution"
  | "approval"
  | "rejection"
  | "correction"
  | "meeting"
  | "failure";

export interface MemoryEvent {
  id: string;
  kind: MemoryEventKind;
  occurredAt: string;
  summary: string;
  sourceIds: string[];
}
