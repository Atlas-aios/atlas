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

export function createIdentitySubject(input: IdentitySubjectInput): IdentitySubject {
  return {
    id: input.id,
    schemaVersion: "0.1",
    kind: input.kind,
    displayName: input.displayName,
    confidence: input.confidence,
    aliases: input.aliases,
    evidenceRefs: input.evidenceRefs
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
    evidenceRefs: input.evidenceRefs
  };
}
