export type ExperienceArtifactType =
  | "heuristic"
  | "playbook"
  | "anti_pattern"
  | "decision_pattern"
  | "risk_pattern";

export interface ExperienceArtifact {
  id: string;
  type: ExperienceArtifactType;
  summary: string;
  evidenceMemoryEventIds: string[];
  applicability: string[];
  confidence: number;
}
