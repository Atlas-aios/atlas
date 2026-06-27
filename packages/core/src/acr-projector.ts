import type { ACREvent, ACRObject, AtlasCognitiveTransaction } from "./acr.js";

export interface ACRProjection {
  objects: Map<string, ACRObject>;
}

export function projectCommittedACTs(
  transactions: AtlasCognitiveTransaction[]
): ACRProjection {
  const objects = new Map<string, ACRObject>();

  for (const transaction of transactions) {
    if (transaction.status !== "committed" && transaction.status !== "published") {
      continue;
    }

    for (const event of transaction.events) {
      applyEvent(objects, event);
    }
  }

  return { objects };
}

function applyEvent(objects: Map<string, ACRObject>, event: ACREvent): void {
  if (event.type === "object.created") {
    const payload = event.payload as { object: ACRObject };
    objects.set(event.objectId, payload.object);
  }

  if (event.type === "object.validated") {
    const existing = objects.get(event.objectId);
    if (existing) {
      objects.set(event.objectId, {
        ...existing,
        version: event.objectVersion,
        lifecycle: "validated"
      });
    }
  }
}
