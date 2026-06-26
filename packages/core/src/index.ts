export type ISODateTime = string;
export type AtlasId = string;

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
