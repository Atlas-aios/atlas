export type ACRCanonicalStore = "aces";
export type ACRAtomicWriteUnit = "act";
export type ACRPublicationBoundary = "committed-act";

export interface ACRProjectionStore {
  name: "acr_objects" | "acr_relationships" | "acr_evidence_refs" | "acr_search";
  purpose: string;
  rebuildableFromCanonicalStore: boolean;
  authoritative: boolean;
}

export interface ACRSourceOfTruthModel {
  canonicalStore: ACRCanonicalStore;
  atomicWriteUnit: ACRAtomicWriteUnit;
  appendOnly: boolean;
  sourceEventGroupingKey: "actId";
  publicationBoundary: ACRPublicationBoundary;
  projections: ACRProjectionStore[];
  invariants: string[];
}

export const ACR_SOURCE_OF_TRUTH_MODEL: ACRSourceOfTruthModel = {
  canonicalStore: "aces",
  atomicWriteUnit: "act",
  appendOnly: true,
  sourceEventGroupingKey: "actId",
  publicationBoundary: "committed-act",
  projections: [
    {
      name: "acr_objects",
      purpose: "current and historical object-version queries",
      rebuildableFromCanonicalStore: true,
      authoritative: false
    },
    {
      name: "acr_relationships",
      purpose: "graph traversal queries",
      rebuildableFromCanonicalStore: true,
      authoritative: false
    },
    {
      name: "acr_evidence_refs",
      purpose: "structured evidence reference queries",
      rebuildableFromCanonicalStore: true,
      authoritative: false
    },
    {
      name: "acr_search",
      purpose: "semantic and keyword retrieval",
      rebuildableFromCanonicalStore: true,
      authoritative: false
    }
  ],
  invariants: [
    "No ACR event commits without an ACT id.",
    "Only committed ACTs update projections.",
    "Only committed ACTs publish to ACB.",
    "Projection stores are never the source of truth.",
    "Raw evidence is stored by reference and retained outside compact projections."
  ]
};
