# Brain Model Runtime Design

**Status:** Approved from the existing model-routing architecture and the user's prior local-first/Nemotron decisions

## Goal

Connect Atlas's Brain to a real model provider so a stored goal can become a validated `AtlasPlan` through the runtime API.

## Scope

This slice adds one endpoint, `POST /brain/plan`. It looks up an existing goal, assembles a bounded planning request, applies the deterministic model-routing gates, calls the selected configured provider, validates the returned JSON, and returns the plan with routing metadata.

It does not implement local model serving, graph/vector retrieval, AtlasFlow compilation, or automatic plan execution. Selecting an unconfigured provider returns an explicit availability error; Atlas never fabricates a plan.

## Ownership

- `@atlas-aios/core` continues to own model profiles, deterministic routing, and the NVIDIA NIM HTTP client.
- `@atlas-aios/brain` owns the provider-neutral invocation contract, bounded planning prompt, strict plan parser, and plan generation service.
- `@atlas-aios/runtime` owns goal lookup, server-side remote-model policy, secrets, provider wiring, HTTP responses, and audit-visible routing metadata.

## Request Flow

```text
POST /brain/plan
-> authenticate request
-> load goal
-> classify task, difficulty, and privacy
-> combine request classification with server policy
-> select model profile deterministically
-> require a configured provider for that profile
-> send bounded goal context
-> parse strict JSON
-> validate every plan field and step
-> return AtlasPlan plus routing metadata
```

## Provider Policy

The API caller can classify the work but cannot enable remote models. Remote eligibility comes only from runtime configuration:

- `ATLAS_ALLOW_REMOTE_MODELS=true`
- `ATLAS_ALLOW_FREE_HOSTED_MODEL_ENDPOINTS=true`
- `NVIDIA_API_KEY` is present

Nemotron remains eligible only for high or critical architecture, governance review, hard debugging, or research synthesis requests with public or internal data. Private and confidential requests remain local.

## Failure Behavior

- Unknown goal: `404 goal_not_found`
- Selected provider is not configured: `503 model_provider_unavailable`
- Provider request fails: `502 model_provider_failed`
- Provider returns malformed or unsafe plan JSON: `502 invalid_model_output`
- Invalid request classification: `400 invalid_brain_plan_request`

Provider errors must not silently fall back across privacy or governance boundaries. A later resilience slice may add policy-controlled fallback.

## Testing

Brain tests inject a real in-process provider function and verify routing, prompt bounds, valid parsing, missing-provider errors, and malformed-output errors. Runtime tests verify goal lookup, server-owned remote policy, successful planning through injection, and honest `503` behavior when the selected local provider is absent. No test calls an external endpoint.
