import type { ACREventType, AtlasCognitiveTransaction } from "./acr.js";

export interface ACBMessage {
  messageId: string;
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
