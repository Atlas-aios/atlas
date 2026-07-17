export type IdentityKind = "human" | "system" | "organization" | "provider";

export interface IdentitySubject {
  id: string;
  schemaVersion: "0.1";
  kind: IdentityKind;
  displayName: string;
  confidence: number;
  aliases: string[];
  evidenceRefs: string[];
}

export interface IdentityResolution {
  id: string;
  schemaVersion: "0.1";
  subjectId: string;
  externalSystem: string;
  externalId: string;
  confidence: number;
  resolvedAt: string;
  evidenceRefs: string[];
}

export type IdentityLink = Omit<
  IdentityResolution,
  "id" | "schemaVersion" | "resolvedAt" | "evidenceRefs"
>;

export type IdentitySubjectInput = Omit<IdentitySubject, "schemaVersion">;
export type IdentityResolutionInput = Omit<IdentityResolution, "schemaVersion">;

export interface IdentitySubjectFilter {
  kinds?: IdentityKind[];
}

export interface IdentityResolutionFilter {
  subjectId?: string;
  externalSystem?: string;
}

export interface IdentityLookupQuery {
  alias?: string;
  externalSystem?: string;
  externalId?: string;
}

export interface IdentityStore {
  recordSubject(subject: IdentitySubject): IdentitySubject;
  recordResolution(resolution: IdentityResolution): IdentityResolution;
  listSubjects(filter?: IdentitySubjectFilter): IdentitySubject[];
  listResolutions(filter?: IdentityResolutionFilter): IdentityResolution[];
  findSubject(query: IdentityLookupQuery): IdentitySubject | undefined;
}

export function createIdentitySubject(input: IdentitySubjectInput): IdentitySubject {
  return {
    id: input.id,
    schemaVersion: "0.1",
    kind: input.kind,
    displayName: input.displayName,
    confidence: input.confidence,
    aliases: [...input.aliases],
    evidenceRefs: [...input.evidenceRefs]
  };
}

export function createIdentityResolution(
  input: IdentityResolutionInput
): IdentityResolution {
  return {
    id: input.id,
    schemaVersion: "0.1",
    subjectId: input.subjectId,
    externalSystem: input.externalSystem,
    externalId: input.externalId,
    confidence: input.confidence,
    resolvedAt: input.resolvedAt,
    evidenceRefs: [...input.evidenceRefs]
  };
}

export function createInMemoryIdentityStore(): IdentityStore {
  const subjects = new Map<string, IdentitySubject>();
  const resolutions = new Map<string, IdentityResolution>();

  return {
    recordSubject: (subject) => {
      const storedSubject = cloneIdentitySubject(subject);
      subjects.set(storedSubject.id, storedSubject);

      return cloneIdentitySubject(storedSubject);
    },
    recordResolution: (resolution) => {
      const storedResolution = cloneIdentityResolution(resolution);
      resolutions.set(storedResolution.id, storedResolution);

      return cloneIdentityResolution(storedResolution);
    },
    listSubjects: (filter = {}) =>
      [...subjects.values()]
        .filter((subject) => matchesSubjectFilter(subject, filter))
        .map(cloneIdentitySubject),
    listResolutions: (filter = {}) =>
      [...resolutions.values()]
        .filter((resolution) => matchesResolutionFilter(resolution, filter))
        .map(cloneIdentityResolution),
    findSubject: (query) => {
      const subjectByAlias =
        query.alias === undefined
          ? undefined
          : [...subjects.values()].find((subject) =>
              subject.aliases.some(
                (alias) =>
                  normalizeIdentityText(alias) === normalizeIdentityText(query.alias!)
              )
            );

      if (subjectByAlias !== undefined) {
        return cloneIdentitySubject(subjectByAlias);
      }

      if (query.externalSystem === undefined || query.externalId === undefined) {
        return undefined;
      }

      const resolution = [...resolutions.values()].find(
        (item) =>
          item.externalSystem === query.externalSystem &&
          item.externalId === query.externalId
      );
      const subject =
        resolution === undefined ? undefined : subjects.get(resolution.subjectId);

      return subject === undefined ? undefined : cloneIdentitySubject(subject);
    }
  };
}

export function recordIdentitySubject(
  store: IdentityStore,
  subject: IdentitySubject
): IdentitySubject {
  return store.recordSubject(subject);
}

export function recordIdentityResolution(
  store: IdentityStore,
  resolution: IdentityResolution
): IdentityResolution {
  return store.recordResolution(resolution);
}

function matchesSubjectFilter(
  subject: IdentitySubject,
  filter: IdentitySubjectFilter
): boolean {
  return filter.kinds === undefined || filter.kinds.includes(subject.kind);
}

function matchesResolutionFilter(
  resolution: IdentityResolution,
  filter: IdentityResolutionFilter
): boolean {
  return (
    (filter.subjectId === undefined || resolution.subjectId === filter.subjectId) &&
    (filter.externalSystem === undefined ||
      resolution.externalSystem === filter.externalSystem)
  );
}

function normalizeIdentityText(value: string): string {
  return value.trim().toLowerCase();
}

function cloneIdentitySubject(subject: IdentitySubject): IdentitySubject {
  return {
    ...subject,
    aliases: [...subject.aliases],
    evidenceRefs: [...subject.evidenceRefs]
  };
}

function cloneIdentityResolution(resolution: IdentityResolution): IdentityResolution {
  return {
    ...resolution,
    evidenceRefs: [...resolution.evidenceRefs]
  };
}
