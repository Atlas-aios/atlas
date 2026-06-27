import type { AtlasId, ISODateTime } from "./index.js";
import type { PillarId } from "./pillars.js";

export type AtlasEventSchemaVersion = "1.0";

export interface AtlasEventEnvelope<
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  id: AtlasId;
  type: string;
  schemaVersion: AtlasEventSchemaVersion;
  sourcePillar: PillarId;
  occurredAt: ISODateTime;
  correlationId: AtlasId;
  payload: TPayload;
}

export interface AtlasEventEnvelopeInput<
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  id: AtlasId;
  type: string;
  sourcePillar: PillarId;
  occurredAt: ISODateTime;
  correlationId: AtlasId;
  payload: TPayload;
}

export function createAtlasEventEnvelope<TPayload extends Record<string, unknown>>(
  input: AtlasEventEnvelopeInput<TPayload>
): AtlasEventEnvelope<TPayload> {
  return {
    id: input.id,
    type: input.type,
    schemaVersion: "1.0",
    sourcePillar: input.sourcePillar,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: input.payload
  };
}
