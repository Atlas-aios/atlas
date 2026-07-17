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

export interface SemanticEntityFilter {
  types?: string[];
  evidenceRefs?: string[];
}

export interface SemanticRelationshipFilter {
  types?: string[];
  entityId?: string;
  evidenceRefs?: string[];
}

export interface SemanticTraversalRequest {
  entityId: string;
  direction: "incoming" | "outgoing" | "both";
  relationshipTypes?: string[];
}

export interface SemanticWorldModelStore {
  recordEntity(entity: SemanticEntity): SemanticEntity;
  recordRelationship(relationship: SemanticRelationship): SemanticRelationship;
  listEntities(filter?: SemanticEntityFilter): SemanticEntity[];
  listRelationships(filter?: SemanticRelationshipFilter): SemanticRelationship[];
  traverse(request: SemanticTraversalRequest): SemanticRelationship[];
}

export function createSemanticEntity(input: SemanticEntityInput): SemanticEntity {
  return {
    id: input.id,
    schemaVersion: "0.1",
    type: input.type,
    label: input.label,
    attributes: cloneAttributes(input.attributes),
    confidence: input.confidence,
    evidenceRefs: [...input.evidenceRefs],
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
    evidenceRefs: [...input.evidenceRefs],
    observedAt: input.observedAt
  };
}

export function createInMemorySemanticWorldModelStore(): SemanticWorldModelStore {
  const entities = new Map<string, SemanticEntity>();
  const relationships = new Map<string, SemanticRelationship>();

  return {
    recordEntity: (entity) => {
      const storedEntity = cloneSemanticEntity(entity);
      entities.set(storedEntity.id, storedEntity);

      return cloneSemanticEntity(storedEntity);
    },
    recordRelationship: (relationship) => {
      const storedRelationship = cloneSemanticRelationship(relationship);
      relationships.set(storedRelationship.id, storedRelationship);

      return cloneSemanticRelationship(storedRelationship);
    },
    listEntities: (filter = {}) =>
      [...entities.values()]
        .filter((entity) => matchesEntityFilter(entity, filter))
        .map(cloneSemanticEntity),
    listRelationships: (filter = {}) =>
      [...relationships.values()]
        .filter((relationship) => matchesRelationshipFilter(relationship, filter))
        .map(cloneSemanticRelationship),
    traverse: (request) =>
      [...relationships.values()]
        .filter((relationship) => matchesTraversalRequest(relationship, request))
        .map(cloneSemanticRelationship)
  };
}

export function recordSemanticEntity(
  store: SemanticWorldModelStore,
  entity: SemanticEntity
): SemanticEntity {
  return store.recordEntity(entity);
}

export function recordSemanticRelationship(
  store: SemanticWorldModelStore,
  relationship: SemanticRelationship
): SemanticRelationship {
  return store.recordRelationship(relationship);
}

function matchesEntityFilter(
  entity: SemanticEntity,
  filter: SemanticEntityFilter
): boolean {
  return (
    matchesAny(entity.type, filter.types) &&
    overlaps(entity.evidenceRefs, filter.evidenceRefs)
  );
}

function matchesRelationshipFilter(
  relationship: SemanticRelationship,
  filter: SemanticRelationshipFilter
): boolean {
  return (
    matchesAny(relationship.type, filter.types) &&
    matchesConnectedEntity(relationship, filter.entityId) &&
    overlaps(relationship.evidenceRefs, filter.evidenceRefs)
  );
}

function matchesTraversalRequest(
  relationship: SemanticRelationship,
  request: SemanticTraversalRequest
): boolean {
  return (
    matchesAny(relationship.type, request.relationshipTypes) &&
    (request.direction === "both"
      ? matchesConnectedEntity(relationship, request.entityId)
      : request.direction === "incoming"
        ? relationship.toEntityId === request.entityId
        : relationship.fromEntityId === request.entityId)
  );
}

function matchesConnectedEntity(
  relationship: SemanticRelationship,
  entityId: string | undefined
): boolean {
  return (
    entityId === undefined ||
    relationship.fromEntityId === entityId ||
    relationship.toEntityId === entityId
  );
}

function matchesAny(value: string, values: string[] | undefined): boolean {
  return values === undefined || values.includes(value);
}

function overlaps(values: string[], filterValues: string[] | undefined): boolean {
  return (
    filterValues === undefined ||
    filterValues.some((filterValue) => values.includes(filterValue))
  );
}

function cloneSemanticEntity(entity: SemanticEntity): SemanticEntity {
  return {
    ...entity,
    attributes: cloneAttributes(entity.attributes),
    evidenceRefs: [...entity.evidenceRefs]
  };
}

function cloneSemanticRelationship(
  relationship: SemanticRelationship
): SemanticRelationship {
  return {
    ...relationship,
    evidenceRefs: [...relationship.evidenceRefs]
  };
}

function cloneAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(attributes) as Record<string, unknown>;
}
