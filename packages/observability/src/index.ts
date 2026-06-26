export interface ObservabilityEvent {
  traceId: string;
  spanId: string;
  subsystem: string;
  name: string;
  attributes: Record<string, string | number | boolean>;
  timestamp: string;
}
