export interface SemanticEntity {
  id: string;
  schemaVersion: "0.1";
  type: string;
  label: string;
  attributes: Record<string, unknown>;
  confidence: number;
  evidenceRefs: string[];
  observedAt: string;
}

export interface SemanticRelationship {
  id: string;
  schemaVersion: "0.1";
  fromEntityId: string;
  toEntityId: string;
  type: string;
  confidence: number;
  evidenceRefs: string[];
  observedAt: string;
}

export type SemanticEntityInput = Omit<SemanticEntity, "schemaVersion">;
export type SemanticRelationshipInput = Omit<SemanticRelationship, "schemaVersion">;

export function createSemanticEntity(input: SemanticEntityInput): SemanticEntity {
  return {
    id: input.id,
    schemaVersion: "0.1",
    type: input.type,
    label: input.label,
    attributes: input.attributes,
    confidence: input.confidence,
    evidenceRefs: input.evidenceRefs,
    observedAt: input.observedAt
  };
}

export function createSemanticRelationship(
  input: SemanticRelationshipInput
): SemanticRelationship {
  return {
    id: input.id,
    schemaVersion: "0.1",
    fromEntityId: input.fromEntityId,
    toEntityId: input.toEntityId,
    type: input.type,
    confidence: input.confidence,
    evidenceRefs: input.evidenceRefs,
    observedAt: input.observedAt
  };
}
