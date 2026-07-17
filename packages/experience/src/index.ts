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

export interface ExperienceLookupQuery {
  artifactTypes?: ExperienceArtifactType[];
  applicability: string[];
  minimumConfidence?: number;
}

export interface LookupExperienceArtifactsInput {
  artifacts: ExperienceArtifact[];
  query: ExperienceLookupQuery;
}

export type RecordExperienceArtifactInput = ExperienceArtifact;

export interface ExperienceStore {
  record(input: RecordExperienceArtifactInput): ExperienceArtifact;
  list(query?: ExperienceLookupQuery): ExperienceArtifact[];
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

export function lookupExperienceArtifacts(
  input: LookupExperienceArtifactsInput
): ExperienceArtifact[] {
  const minimumConfidence = input.query.minimumConfidence ?? 0;
  const artifactTypes = new Set(input.query.artifactTypes);

  return input.artifacts
    .filter((artifact) => {
      const typeMatches = artifactTypes.size === 0 || artifactTypes.has(artifact.type);
      const confidenceMatches = artifact.confidence >= minimumConfidence;
      const applicabilityMatches = input.query.applicability.every((scope) =>
        artifact.applicability.includes(scope)
      );

      return typeMatches && confidenceMatches && applicabilityMatches;
    })
    .sort(
      (left, right) =>
        right.confidence - left.confidence || left.id.localeCompare(right.id)
    );
}

export function createInMemoryExperienceStore(): ExperienceStore {
  const artifacts: ExperienceArtifact[] = [];

  return {
    record: (input) => {
      const artifact = cloneExperienceArtifact(input);
      artifacts.push(artifact);

      return cloneExperienceArtifact(artifact);
    },
    list: (query = { applicability: [] }) =>
      lookupExperienceArtifacts({
        artifacts: artifacts.map(cloneExperienceArtifact),
        query
      })
  };
}

export function recordExperienceArtifact(
  store: ExperienceStore,
  input: RecordExperienceArtifactInput
): ExperienceArtifact {
  return store.record(input);
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

function cloneExperienceArtifact(artifact: ExperienceArtifact): ExperienceArtifact {
  return {
    ...artifact,
    evidenceMemoryEventIds: [...artifact.evidenceMemoryEventIds],
    applicability: [...artifact.applicability]
  };
}
