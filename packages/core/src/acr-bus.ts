import type { ACREvent, ACREventType, AtlasCognitiveTransaction } from "./acr.js";

export interface ACBMessage {
  messageId: string;
  topic: string;
  type: ACREventType;
  timestamp: string;
  source: string;
  actId: string;
  objectId: string;
  objectVersion: number;
  traceId: string;
  causalityId?: string;
  dataRef: string;
}

export function createACBMessagesForACT(
  transaction: AtlasCognitiveTransaction
): ACBMessage[] {
  if (transaction.status !== "committed") {
    return [];
  }

  return transaction.events.map((event) => ({
    messageId: `acb:${event.id}`,
    topic: getACBTopicForEvent(event),
    type: event.type,
    timestamp: event.occurredAt,
    source: event.actorId,
    actId: transaction.id,
    objectId: event.objectId,
    objectVersion: event.objectVersion,
    traceId: event.traceId,
    ...(event.causalityId === undefined ? {} : { causalityId: event.causalityId }),
    dataRef: event.id
  }));
}

export function getACBTopicForEvent(event: ACREvent): string {
  if (event.type.startsWith("object.")) {
    return `acb.${objectTopicSegment(event)}.${event.type}`;
  }

  return `acb.${event.type}`;
}

function objectTopicSegment(event: ACREvent): string {
  const payload = event.payload;

  if (
    isRecord(payload) &&
    isRecord(payload.object) &&
    typeof payload.object.type === "string"
  ) {
    return payload.object.type;
  }

  return objectTypeFromId(event.objectId);
}

function objectTypeFromId(objectId: string): string {
  const parts = objectId.split(":");
  return parts.length >= 2 && parts[1] !== undefined ? parts[1] : "object";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
