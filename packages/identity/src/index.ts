export type IdentityKind = "human" | "system" | "organization" | "provider";

export interface IdentitySubject {
  id: string;
  kind: IdentityKind;
  displayName: string;
  confidence: number;
}

export interface IdentityLink {
  subjectId: string;
  externalSystem: string;
  externalId: string;
  confidence: number;
}
