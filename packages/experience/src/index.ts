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

export type DecisionObservationOutcomeType =
  | "approve"
  | "approve_with_constraints"
  | "discuss"
  | "suggest_alternative"
  | "simulate_first"
  | "reject"
  | "delegate_to_human";

export interface DecisionMemoryObservation {
  memoryEventId: string;
  actionType: string;
  outcomeType: DecisionObservationOutcomeType;
  rationale: string;
  riskKinds: string[];
  applicability: string[];
  occurredAt: string;
}

export interface DistillDecisionPatternsInput {
  observations: DecisionMemoryObservation[];
  minimumEvidenceCount?: number;
}

export function distillDecisionPatternsFromMemory(
  input: DistillDecisionPatternsInput
): ExperienceArtifact[] {
  const minimumEvidenceCount = input.minimumEvidenceCount ?? 2;
  const groups = new Map<string, DecisionMemoryObservation[]>();

  for (const observation of input.observations) {
    const key = createDecisionPatternKey(observation);
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  return [...groups.values()]
    .filter((group) => group.length >= minimumEvidenceCount)
    .map(createDecisionPatternArtifact);
}

function createDecisionPatternArtifact(
  observations: DecisionMemoryObservation[]
): ExperienceArtifact {
  const firstObservation = observations[0];

  if (firstObservation === undefined) {
    throw new Error("Cannot create an Experience artifact without evidence.");
  }

  const applicability = sortedUnique(firstObservation.applicability);
  const riskKinds = sortedUnique(firstObservation.riskKinds);

  return {
    id: [
      "experience",
      "decision-pattern",
      slug(firstObservation.actionType),
      slug(firstObservation.outcomeType),
      slug(riskKinds.join("-")),
      slug(applicability.join("-"))
    ].join(":"),
    type: "decision_pattern",
    summary: `For ${firstObservation.actionType} with risks ${riskKinds.join(
      ", "
    )}, prior evidence repeatedly led to ${firstObservation.outcomeType}.`,
    evidenceMemoryEventIds: sortedUnique(
      observations.map((observation) => observation.memoryEventId)
    ),
    applicability,
    confidence: confidenceFromEvidenceCount(observations.length)
  };
}

function createDecisionPatternKey(observation: DecisionMemoryObservation): string {
  return [
    observation.actionType,
    observation.outcomeType,
    sortedUnique(observation.riskKinds).join("|"),
    sortedUnique(observation.applicability).join("|")
  ].join("::");
}

function confidenceFromEvidenceCount(evidenceCount: number): number {
  return Math.min(0.95, 0.5 + evidenceCount * 0.1);
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}
