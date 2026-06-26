export interface SemanticEntity {
  id: string;
  type: string;
  label: string;
  attributes: Record<string, unknown>;
  confidence: number;
}

export interface SemanticRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  confidence: number;
}
