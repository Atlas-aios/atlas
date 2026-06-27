import type {
  ACREvidenceRef,
  ACREvent,
  ACRObject,
  ACRRelationship,
  AtlasCognitiveTransaction
} from "./acr.js";

export interface ACRProjectedRelationship extends ACRRelationship {
  sourceId: string;
}

export interface ACRProjectedEvidenceRef extends ACREvidenceRef {
  objectId: string;
}

export interface ACRProjection {
  objects: Map<string, ACRObject>;
  relationships: ACRProjectedRelationship[];
  evidenceRefs: ACRProjectedEvidenceRef[];
}

export function projectCommittedACTs(
  transactions: AtlasCognitiveTransaction[]
): ACRProjection {
  const objects = new Map<string, ACRObject>();
  const relationships: ACRProjectedRelationship[] = [];
  const evidenceRefs: ACRProjectedEvidenceRef[] = [];

  for (const transaction of transactions) {
    if (transaction.status !== "committed" && transaction.status !== "published") {
      continue;
    }

    for (const event of transaction.events) {
      applyEvent({ objects, relationships, evidenceRefs }, event);
    }
  }

  return { objects, relationships, evidenceRefs };
}

function applyEvent(projection: ACRProjection, event: ACREvent): void {
  if (event.type === "object.created") {
    const payload = event.payload as { object: ACRObject };
    projection.objects.set(event.objectId, payload.object);
  }

  if (event.type === "object.validated") {
    const existing = projection.objects.get(event.objectId);
    if (existing) {
      projection.objects.set(event.objectId, {
        ...existing,
        version: event.objectVersion,
        lifecycle: "validated"
      });
    }
  }

  if (event.type === "relationship.added") {
    const payload = event.payload as { relationship: ACRRelationship };
    projection.relationships.push({
      sourceId: event.objectId,
      ...payload.relationship
    });
  }

  if (event.type === "evidence.attached") {
    const payload = event.payload as { evidence: ACREvidenceRef };
    projection.evidenceRefs.push({
      objectId: event.objectId,
      ...payload.evidence
    });
  }
}
