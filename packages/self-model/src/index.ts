export type InterfaceMaturityState =
  | "unknown"
  | "observed"
  | "simulated"
  | "validated"
  | "production";

export type SubsystemMaturityState =
  | "planned"
  | "implemented"
  | "tested"
  | "validated"
  | "production";

export type ExecutionOutcomeStatus = "completed" | "failed";

export interface CapabilityConfidence {
  capabilityId: string;
  providerId: string;
  confidence: number;
  knownLimitations: string[];
  knownFailureModes: string[];
  evidenceRefs: string[];
  updatedAt: string;
}

export interface InterfaceMaturity {
  interfaceId: string;
  maturity: InterfaceMaturityState;
  confidence: number;
  evidenceRefs: string[];
  updatedAt: string;
}

export interface SubsystemMaturity {
  subsystemId: string;
  maturity: SubsystemMaturityState;
  confidence: number;
  evidenceRefs: string[];
  updatedAt: string;
}

export interface ResourceLimits {
  maxEstimatedCostPerExecution?: number;
  maxEstimatedLatencyMs?: number;
}

export interface SelfModelSnapshot {
  id: string;
  schemaVersion: "0.1";
  generatedAt: string;
  availableCapabilityIds: string[];
  grantedAuthority: string[];
  resourceLimits: ResourceLimits;
  capabilityConfidence: CapabilityConfidence[];
  interfaceMaturity: InterfaceMaturity[];
  subsystemMaturity: SubsystemMaturity[];
  knownLimitations: string[];
  knownFailureModes: string[];
}

export type SelfModelSnapshotInput = Omit<SelfModelSnapshot, "schemaVersion">;

export interface ExecutionOutcomeObservation {
  capabilityId: string;
  providerId: string;
  status: ExecutionOutcomeStatus;
  occurredAt: string;
  evidenceRefs: string[];
  limitation?: string;
  failureMode?: string;
}

export interface SelfModelStore {
  recordSnapshot(snapshot: SelfModelSnapshot): SelfModelSnapshot;
  getCurrentSnapshot(): SelfModelSnapshot | undefined;
  updateFromExecutionOutcome(
    observation: ExecutionOutcomeObservation
  ): SelfModelSnapshot;
}

export function createSelfModelSnapshot(
  input: SelfModelSnapshotInput
): SelfModelSnapshot {
  return {
    id: input.id,
    schemaVersion: "0.1",
    generatedAt: input.generatedAt,
    availableCapabilityIds: [...input.availableCapabilityIds],
    grantedAuthority: [...input.grantedAuthority],
    resourceLimits: { ...input.resourceLimits },
    capabilityConfidence: input.capabilityConfidence.map(cloneCapabilityConfidence),
    interfaceMaturity: input.interfaceMaturity.map(cloneInterfaceMaturity),
    subsystemMaturity: input.subsystemMaturity.map(cloneSubsystemMaturity),
    knownLimitations: [...input.knownLimitations],
    knownFailureModes: [...input.knownFailureModes]
  };
}

export function createInMemorySelfModelStore(
  initialSnapshot?: SelfModelSnapshot
): SelfModelStore {
  let currentSnapshot =
    initialSnapshot === undefined ? undefined : cloneSelfModelSnapshot(initialSnapshot);

  return {
    recordSnapshot: (snapshot) => {
      currentSnapshot = cloneSelfModelSnapshot(snapshot);

      return cloneSelfModelSnapshot(currentSnapshot);
    },
    getCurrentSnapshot: () =>
      currentSnapshot === undefined
        ? undefined
        : cloneSelfModelSnapshot(currentSnapshot),
    updateFromExecutionOutcome: (observation) => {
      const baseSnapshot =
        currentSnapshot ??
        createSelfModelSnapshot({
          id: `self-model:snapshot:${observation.occurredAt}`,
          generatedAt: observation.occurredAt,
          availableCapabilityIds: [],
          grantedAuthority: [],
          resourceLimits: {},
          capabilityConfidence: [],
          interfaceMaturity: [],
          subsystemMaturity: [],
          knownLimitations: [],
          knownFailureModes: []
        });

      const updatedSnapshot = applyExecutionOutcome(baseSnapshot, observation);
      currentSnapshot = updatedSnapshot;

      return cloneSelfModelSnapshot(updatedSnapshot);
    }
  };
}

export function updateSelfModelFromExecutionOutcome(
  store: SelfModelStore,
  observation: ExecutionOutcomeObservation
): SelfModelSnapshot {
  return store.updateFromExecutionOutcome(observation);
}

function applyExecutionOutcome(
  snapshot: SelfModelSnapshot,
  observation: ExecutionOutcomeObservation
): SelfModelSnapshot {
  const capabilityConfidence = updateCapabilityConfidence(
    snapshot.capabilityConfidence,
    observation
  );
  const knownLimitations =
    observation.limitation === undefined
      ? snapshot.knownLimitations
      : sortedUnique([...snapshot.knownLimitations, observation.limitation]);
  const knownFailureModes =
    observation.failureMode === undefined
      ? snapshot.knownFailureModes
      : sortedUnique([...snapshot.knownFailureModes, observation.failureMode]);

  return createSelfModelSnapshot({
    ...snapshot,
    generatedAt: observation.occurredAt,
    availableCapabilityIds: sortedUnique([
      ...snapshot.availableCapabilityIds,
      observation.capabilityId
    ]),
    capabilityConfidence,
    knownLimitations,
    knownFailureModes
  });
}

function updateCapabilityConfidence(
  confidenceRecords: CapabilityConfidence[],
  observation: ExecutionOutcomeObservation
): CapabilityConfidence[] {
  const existingRecord = confidenceRecords.find(
    (record) =>
      record.capabilityId === observation.capabilityId &&
      record.providerId === observation.providerId
  );
  const remainingRecords = confidenceRecords.filter(
    (record) => record !== existingRecord
  );
  const baselineConfidence = existingRecord?.confidence ?? 0.5;
  const confidenceDelta = observation.status === "completed" ? 0.1 : -0.15;
  const nextRecord: CapabilityConfidence = {
    capabilityId: observation.capabilityId,
    providerId: observation.providerId,
    confidence: clampConfidence(baselineConfidence + confidenceDelta),
    knownLimitations: sortedUnique([
      ...(existingRecord?.knownLimitations ?? []),
      ...(observation.limitation === undefined ? [] : [observation.limitation])
    ]),
    knownFailureModes: sortedUnique([
      ...(existingRecord?.knownFailureModes ?? []),
      ...(observation.failureMode === undefined ? [] : [observation.failureMode])
    ]),
    evidenceRefs: sortedUnique([
      ...(existingRecord?.evidenceRefs ?? []),
      ...observation.evidenceRefs
    ]),
    updatedAt: observation.occurredAt
  };

  return [...remainingRecords.map(cloneCapabilityConfidence), nextRecord].sort(
    (left, right) =>
      left.capabilityId.localeCompare(right.capabilityId) ||
      left.providerId.localeCompare(right.providerId)
  );
}

function clampConfidence(confidence: number): number {
  return Math.min(0.95, Math.max(0.05, Number(confidence.toFixed(2))));
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function cloneSelfModelSnapshot(snapshot: SelfModelSnapshot): SelfModelSnapshot {
  return createSelfModelSnapshot(snapshot);
}

function cloneCapabilityConfidence(record: CapabilityConfidence): CapabilityConfidence {
  return {
    ...record,
    knownLimitations: [...record.knownLimitations],
    knownFailureModes: [...record.knownFailureModes],
    evidenceRefs: [...record.evidenceRefs]
  };
}

function cloneInterfaceMaturity(record: InterfaceMaturity): InterfaceMaturity {
  return {
    ...record,
    evidenceRefs: [...record.evidenceRefs]
  };
}

function cloneSubsystemMaturity(record: SubsystemMaturity): SubsystemMaturity {
  return {
    ...record,
    evidenceRefs: [...record.evidenceRefs]
  };
}
