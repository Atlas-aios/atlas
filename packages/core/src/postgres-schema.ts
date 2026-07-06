export type PostgresTableAuthority = "canonical" | "projection";
export type PostgresWriteModel = "append-only" | "rebuildable-projection";

export interface PostgresSchemaTable {
  name:
    | "act_transactions"
    | "acr_events"
    | "acr_objects"
    | "acr_relationships"
    | "acr_evidence_refs"
    | "acr_search"
    | "atlas_event_envelopes";
  authority: PostgresTableAuthority;
  writeModel: PostgresWriteModel;
  purpose: string;
}

export interface PostgresSchemaBaseline {
  schemaName: "atlas_core";
  version: "001";
  sourceOfTruth: {
    canonicalStore: "aces";
    atomicWriteUnit: "act";
    publicationBoundary: "committed-act";
  };
  tables: PostgresSchemaTable[];
  invariants: string[];
}

export interface PostgresMigrationStrategy {
  migrationsDirectory: "infra/postgres";
  ordering: "version-prefix";
  checksumAlgorithm: "sha256";
  historyTable: "atlas_core.schema_migrations";
  historyWriteModel: "append-only";
  lock: {
    mechanism: "postgres-advisory-lock";
    key: "atlas-core-migrations";
  };
  appliedStates: ["applied", "failed"];
  invariants: string[];
}

export const POSTGRES_SCHEMA_BASELINE: PostgresSchemaBaseline = {
  schemaName: "atlas_core",
  version: "001",
  sourceOfTruth: {
    canonicalStore: "aces",
    atomicWriteUnit: "act",
    publicationBoundary: "committed-act"
  },
  tables: [
    {
      name: "act_transactions",
      authority: "canonical",
      writeModel: "append-only",
      purpose: "atomic cognitive transaction records"
    },
    {
      name: "acr_events",
      authority: "canonical",
      writeModel: "append-only",
      purpose: "ordered ACR events committed through ACT"
    },
    {
      name: "acr_objects",
      authority: "projection",
      writeModel: "rebuildable-projection",
      purpose: "current and historical ACR object versions"
    },
    {
      name: "acr_relationships",
      authority: "projection",
      writeModel: "rebuildable-projection",
      purpose: "permission-aware graph traversal"
    },
    {
      name: "acr_evidence_refs",
      authority: "projection",
      writeModel: "rebuildable-projection",
      purpose: "evidence reference lookup without storing raw artifacts"
    },
    {
      name: "acr_search",
      authority: "projection",
      writeModel: "rebuildable-projection",
      purpose: "keyword and vector-index coordination metadata"
    },
    {
      name: "atlas_event_envelopes",
      authority: "projection",
      writeModel: "rebuildable-projection",
      purpose: "ACB publication audit and topic routing read model"
    }
  ],
  invariants: [
    "ACT and ACR event rows are append-only.",
    "Every ACR event references exactly one ACT.",
    "Only committed ACTs are eligible for ACB publication.",
    "Every projection row references the ACT or ACR event that produced it.",
    "Projection tables are rebuildable and never authoritative.",
    "Raw evidence and large payloads are stored outside PostgreSQL by reference."
  ]
};

export const POSTGRES_MIGRATION_STRATEGY: PostgresMigrationStrategy = {
  migrationsDirectory: "infra/postgres",
  ordering: "version-prefix",
  checksumAlgorithm: "sha256",
  historyTable: "atlas_core.schema_migrations",
  historyWriteModel: "append-only",
  lock: {
    mechanism: "postgres-advisory-lock",
    key: "atlas-core-migrations"
  },
  appliedStates: ["applied", "failed"],
  invariants: [
    "Migration runners acquire an advisory lock before applying files.",
    "Migrations apply in lexicographic version-prefix order.",
    "Already-applied migration checksums must match the filesystem copy.",
    "Applied migration history is append-only and is never rewritten.",
    "A failed migration records failure details before the runner exits.",
    "Schema changes that rewrite canonical ACT or ACR events require a new ADR."
  ]
};
