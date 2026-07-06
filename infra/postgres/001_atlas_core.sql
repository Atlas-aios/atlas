CREATE SCHEMA IF NOT EXISTS atlas_core;

CREATE TABLE IF NOT EXISTS atlas_core.act_transactions (
  act_id text PRIMARY KEY,
  schema_version text NOT NULL DEFAULT '1.0',
  status text NOT NULL CHECK (
    status IN ('draft', 'validated', 'committed', 'rejected', 'rolled_back')
  ),
  goal_id text,
  trace_id text,
  causality_id text,
  actor_ref text NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  validated_at timestamptz,
  committed_at timestamptz,
  rolled_back_at timestamptz,
  CHECK (committed_at IS NULL OR status IN ('committed', 'rolled_back')),
  CHECK (rolled_back_at IS NULL OR status = 'rolled_back')
);

CREATE TABLE IF NOT EXISTS atlas_core.acr_events (
  event_id text PRIMARY KEY,
  act_id text NOT NULL REFERENCES atlas_core.act_transactions(act_id),
  sequence_in_act integer NOT NULL CHECK (sequence_in_act >= 0),
  event_type text NOT NULL,
  object_id text,
  object_type text,
  subject_ref text,
  data_ref text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurred_at timestamptz NOT NULL,
  UNIQUE (act_id, sequence_in_act)
);

CREATE TABLE IF NOT EXISTS atlas_core.acr_objects (
  object_id text NOT NULL,
  object_type text NOT NULL,
  version integer NOT NULL CHECK (version >= 0),
  status text NOT NULL,
  act_id text NOT NULL REFERENCES atlas_core.act_transactions(act_id),
  source_event_id text NOT NULL REFERENCES atlas_core.acr_events(event_id),
  current_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  PRIMARY KEY (object_id, version),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS atlas_core.acr_relationships (
  relationship_id text PRIMARY KEY,
  source_object_id text NOT NULL,
  relationship_type text NOT NULL,
  target_object_id text NOT NULL,
  confidence numeric(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  permission_scope text[] NOT NULL DEFAULT ARRAY[]::text[],
  act_id text NOT NULL REFERENCES atlas_core.act_transactions(act_id),
  source_event_id text NOT NULL REFERENCES atlas_core.acr_events(event_id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS atlas_core.acr_evidence_refs (
  evidence_ref_id text PRIMARY KEY,
  object_id text,
  relationship_id text,
  evidence_kind text NOT NULL,
  uri text NOT NULL,
  content_hash text,
  confidence numeric(5, 4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  permission_scope text[] NOT NULL DEFAULT ARRAY[]::text[],
  act_id text NOT NULL REFERENCES atlas_core.act_transactions(act_id),
  source_event_id text NOT NULL REFERENCES atlas_core.acr_events(event_id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL,
  CHECK (object_id IS NOT NULL OR relationship_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS atlas_core.acr_search (
  search_ref_id text PRIMARY KEY,
  object_id text NOT NULL,
  object_type text NOT NULL,
  summary text NOT NULL,
  keywords text[] NOT NULL DEFAULT ARRAY[]::text[],
  embedding_ref text,
  permission_scope text[] NOT NULL DEFAULT ARRAY[]::text[],
  act_id text NOT NULL REFERENCES atlas_core.act_transactions(act_id),
  source_event_id text NOT NULL REFERENCES atlas_core.acr_events(event_id),
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS atlas_core.atlas_event_envelopes (
  envelope_id text PRIMARY KEY,
  event_type text NOT NULL,
  topic text NOT NULL,
  schema_version text NOT NULL DEFAULT '1.0',
  source_pillar text NOT NULL,
  correlation_id text NOT NULL,
  trace_id text,
  causality_id text,
  subject_ref text,
  data_ref text,
  act_id text NOT NULL REFERENCES atlas_core.act_transactions(act_id),
  source_event_id text REFERENCES atlas_core.acr_events(event_id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz,
  UNIQUE (topic, envelope_id)
);

CREATE INDEX IF NOT EXISTS idx_act_transactions_status
  ON atlas_core.act_transactions (status);

CREATE INDEX IF NOT EXISTS idx_act_transactions_trace
  ON atlas_core.act_transactions (trace_id)
  WHERE trace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_acr_events_act
  ON atlas_core.acr_events (act_id, sequence_in_act);

CREATE INDEX IF NOT EXISTS idx_acr_events_object
  ON atlas_core.acr_events (object_id, occurred_at)
  WHERE object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_acr_objects_current
  ON atlas_core.acr_objects (object_id, valid_to)
  WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_acr_objects_type
  ON atlas_core.acr_objects (object_type, status);

CREATE INDEX IF NOT EXISTS idx_acr_relationships_source
  ON atlas_core.acr_relationships (source_object_id, relationship_type)
  WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_acr_relationships_target
  ON atlas_core.acr_relationships (target_object_id)
  WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_acr_evidence_refs_object
  ON atlas_core.acr_evidence_refs (object_id)
  WHERE object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_acr_search_object
  ON atlas_core.acr_search (object_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_atlas_event_envelopes_topic
  ON atlas_core.atlas_event_envelopes (topic, occurred_at);

CREATE INDEX IF NOT EXISTS idx_atlas_event_envelopes_correlation
  ON atlas_core.atlas_event_envelopes (correlation_id, occurred_at);
