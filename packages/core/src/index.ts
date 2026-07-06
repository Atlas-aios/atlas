export type ISODateTime = string;
export type AtlasId = string;

export * from "./acr-boundaries.js";
export * from "./acr-bus.js";
export * from "./acr-event-log.js";
export * from "./acr.js";
export * from "./acr-projector.js";
export * from "./acr-source-of-truth.js";
export * from "./context.js";
export * from "./events.js";
export * from "./model-profiles.js";
export * from "./pillars.js";
export * from "./postgres-schema.js";

export interface AtlasReference {
  id: AtlasId;
  kind: string;
  name?: string;
}

export interface AtlasError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type AtlasResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: AtlasError;
    };

export interface AtlasEvent<
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  id: AtlasId;
  type: string;
  occurredAt: ISODateTime;
  source: string;
  payload: TPayload;
}

export function ok<T>(value: T): AtlasResult<T> {
  return { ok: true, value };
}

export function fail(
  code: string,
  message: string,
  details?: Record<string, unknown>
): AtlasResult<never> {
  return details === undefined
    ? { ok: false, error: { code, message } }
    : { ok: false, error: { code, message, details } };
}
