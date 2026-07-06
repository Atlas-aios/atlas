INSERT INTO atlas_core.act_transactions (
  act_id,
  schema_version,
  status,
  goal_id,
  trace_id,
  causality_id,
  actor_ref,
  reason,
  metadata,
  created_at,
  validated_at,
  committed_at
) VALUES (
  'act_seed_unknown_business_system',
  '1.0',
  'committed',
  'goal:learn-unknown-business-system',
  'trace:seed-unknown-business-system',
  'seed:unknown-business-system',
  'system:atlas-seed',
  'Seed synthetic unknown business system context for Create Resource learning.',
  '{"fixture":"unknown-business-system","mvpCapability":"Create Resource"}'::jsonb,
  '2026-07-06T00:00:00Z',
  '2026-07-06T00:00:00Z',
  '2026-07-06T00:00:00Z'
) ON CONFLICT (act_id) DO NOTHING;

INSERT INTO atlas_core.acr_events (
  event_id,
  act_id,
  sequence_in_act,
  event_type,
  object_id,
  object_type,
  subject_ref,
  data_ref,
  payload,
  evidence_refs,
  occurred_at
) VALUES
  (
    'evt_seed_system_created',
    'act_seed_unknown_business_system',
    0,
    'object.created',
    'synthetic-system:unknown-business-system',
    'synthetic_system',
    'synthetic-system:unknown-business-system',
    NULL,
    '{"name":"Unknown Business System","description":"A deliberately generic system Atlas has not been handwritten to know."}'::jsonb,
    '[]'::jsonb,
    '2026-07-06T00:00:00Z'
  ),
  (
    'evt_seed_capability_created',
    'act_seed_unknown_business_system',
    1,
    'object.created',
    'capability:create-resource',
    'capability',
    'capability:create-resource',
    NULL,
    '{"name":"Create Resource","description":"Create a generic business resource after learning the system interface."}'::jsonb,
    '["evidence:unknown-rest-api","evidence:unknown-openapi","evidence:unknown-browser-ui"]'::jsonb,
    '2026-07-06T00:00:01Z'
  ),
  (
    'evt_seed_interface_evidence_attached',
    'act_seed_unknown_business_system',
    2,
    'evidence.attached',
    'capability:create-resource',
    'capability',
    'capability:create-resource',
    'object-store://fixtures/unknown-business-system',
    '{"interfaces":["REST API","OpenAPI documentation","Browser UI"]}'::jsonb,
    '["evidence:unknown-rest-api","evidence:unknown-openapi","evidence:unknown-browser-ui"]'::jsonb,
    '2026-07-06T00:00:02Z'
  )
ON CONFLICT (event_id) DO NOTHING;

INSERT INTO atlas_core.acr_objects (
  object_id,
  object_type,
  version,
  status,
  act_id,
  source_event_id,
  current_state,
  valid_from,
  valid_to
) VALUES
  (
    'synthetic-system:unknown-business-system',
    'synthetic_system',
    0,
    'draft',
    'act_seed_unknown_business_system',
    'evt_seed_system_created',
    '{"name":"Unknown Business System","knownInterfaces":["REST API","OpenAPI documentation","Browser UI"],"appSpecificCodeAllowed":false}'::jsonb,
    '2026-07-06T00:00:00Z',
    NULL
  ),
  (
    'capability:create-resource',
    'capability',
    0,
    'draft',
    'act_seed_unknown_business_system',
    'evt_seed_capability_created',
    '{"name":"Create Resource","requiredLearning":["discover schema","map required fields","simulate create","benchmark result"],"providerSelection":"capability-kernel"}'::jsonb,
    '2026-07-06T00:00:01Z',
    NULL
  )
ON CONFLICT (object_id, version) DO NOTHING;

INSERT INTO atlas_core.acr_relationships (
  relationship_id,
  source_object_id,
  relationship_type,
  target_object_id,
  confidence,
  permission_scope,
  act_id,
  source_event_id,
  metadata,
  valid_from,
  valid_to
) VALUES
  (
    'rel_unknown_system_supports_create_resource',
    'synthetic-system:unknown-business-system',
    'supports_capability',
    'capability:create-resource',
    0.7000,
    ARRAY['project:atlas'],
    'act_seed_unknown_business_system',
    'evt_seed_capability_created',
    '{"basis":"seed fixture for MVP learning"}'::jsonb,
    '2026-07-06T00:00:01Z',
    NULL
  )
ON CONFLICT (relationship_id) DO NOTHING;

INSERT INTO atlas_core.acr_evidence_refs (
  evidence_ref_id,
  object_id,
  relationship_id,
  evidence_kind,
  uri,
  content_hash,
  confidence,
  permission_scope,
  act_id,
  source_event_id,
  metadata,
  captured_at
) VALUES
  (
    'evidence:unknown-rest-api',
    'capability:create-resource',
    NULL,
    'rest-api',
    'object-store://fixtures/unknown-business-system/rest',
    NULL,
    0.6500,
    ARRAY['project:atlas'],
    'act_seed_unknown_business_system',
    'evt_seed_interface_evidence_attached',
    '{"learningUse":"discover endpoints and payload shape"}'::jsonb,
    '2026-07-06T00:00:02Z'
  ),
  (
    'evidence:unknown-openapi',
    'capability:create-resource',
    NULL,
    'openapi-documentation',
    'object-store://fixtures/unknown-business-system/openapi',
    NULL,
    0.6500,
    ARRAY['project:atlas'],
    'act_seed_unknown_business_system',
    'evt_seed_interface_evidence_attached',
    '{"learningUse":"derive candidate provider manifest"}'::jsonb,
    '2026-07-06T00:00:02Z'
  ),
  (
    'evidence:unknown-browser-ui',
    'capability:create-resource',
    NULL,
    'browser-ui',
    'object-store://fixtures/unknown-business-system/browser-ui',
    NULL,
    0.6000,
    ARRAY['project:atlas'],
    'act_seed_unknown_business_system',
    'evt_seed_interface_evidence_attached',
    '{"learningUse":"fallback interface driver grounding"}'::jsonb,
    '2026-07-06T00:00:02Z'
  )
ON CONFLICT (evidence_ref_id) DO NOTHING;

INSERT INTO atlas_core.acr_search (
  search_ref_id,
  object_id,
  object_type,
  summary,
  keywords,
  embedding_ref,
  permission_scope,
  act_id,
  source_event_id,
  updated_at
) VALUES
  (
    'search:unknown-business-system',
    'synthetic-system:unknown-business-system',
    'synthetic_system',
    'Unknown generic business system for Atlas capability learning tests.',
    ARRAY['unknown-system','business-system','learning-fixture'],
    NULL,
    ARRAY['project:atlas'],
    'act_seed_unknown_business_system',
    'evt_seed_system_created',
    '2026-07-06T00:00:00Z'
  ),
  (
    'search:create-resource',
    'capability:create-resource',
    'capability',
    'Create Resource capability that Atlas must learn through interfaces.',
    ARRAY['create-resource','capability','interface-learning'],
    NULL,
    ARRAY['project:atlas'],
    'act_seed_unknown_business_system',
    'evt_seed_capability_created',
    '2026-07-06T00:00:01Z'
  )
ON CONFLICT (search_ref_id) DO NOTHING;

INSERT INTO atlas_core.atlas_event_envelopes (
  envelope_id,
  event_type,
  topic,
  schema_version,
  source_pillar,
  correlation_id,
  trace_id,
  causality_id,
  subject_ref,
  data_ref,
  act_id,
  source_event_id,
  payload,
  occurred_at,
  published_at
) VALUES
  (
    'env_seed_system_created',
    'object.created',
    'acb.synthetic_system.object.created',
    '1.0',
    'memory',
    'goal:learn-unknown-business-system',
    'trace:seed-unknown-business-system',
    'seed:unknown-business-system',
    'synthetic-system:unknown-business-system',
    NULL,
    'act_seed_unknown_business_system',
    'evt_seed_system_created',
    '{"seed":true}'::jsonb,
    '2026-07-06T00:00:00Z',
    '2026-07-06T00:00:00Z'
  ),
  (
    'env_seed_capability_created',
    'object.created',
    'acb.capability.object.created',
    '1.0',
    'capability-graph',
    'goal:learn-unknown-business-system',
    'trace:seed-unknown-business-system',
    'seed:unknown-business-system',
    'capability:create-resource',
    NULL,
    'act_seed_unknown_business_system',
    'evt_seed_capability_created',
    '{"seed":true}'::jsonb,
    '2026-07-06T00:00:01Z',
    '2026-07-06T00:00:01Z'
  )
ON CONFLICT (envelope_id) DO NOTHING;
