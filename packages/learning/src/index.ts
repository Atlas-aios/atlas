export type LearningReportKind = "critic" | "defender" | "judge" | "reward";

export interface LearningReport {
  id: string;
  kind: LearningReportKind;
  subjectId: string;
  findings: string[];
  recommendedChanges: string[];
  requiresGovernanceReview: boolean;
}
