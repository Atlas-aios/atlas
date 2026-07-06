# Model Routing

Atlas uses model lanes instead of one global model.

## Default Lane

The default lane is local-first:

```text
qwen-local-default
```

Use this for routine planning, private memory, confidential context, extraction, routing, and normal Brain/Kernel work.

## Optional Remote Deep Reasoning Lane

Atlas can optionally use NVIDIA's hosted NIM endpoint for difficult requests:

```text
nvidia/nemotron-3-super-120b-a12b
https://integrate.api.nvidia.com/v1
```

This lane is only eligible when all gates pass:

- the request difficulty is `high` or `critical`;
- the task class is architecture, governance review, hard debugging, or research synthesis;
- the privacy class is `public` or `internal`;
- remote models are explicitly allowed;
- free hosted endpoints are explicitly allowed.

The remote lane is not the default and must not receive raw private memory, confidential context, secrets, production credentials, or unbounded history dumps.

## Routing Rule

```text
request
-> deterministic privacy and task gates
-> local default unless every remote gate passes
-> bounded context packet
-> selected model provider
-> deterministic validation of structured output
```

The model router is a governance surface. Future changes that broaden remote eligibility must be reviewed as policy changes.

## NVIDIA NIM Client

`@atlas-aios/core` includes a small NVIDIA NIM chat-completion client contract:

- `buildNvidiaNimChatCompletionRequest` builds the OpenAI-compatible HTTP request.
- `callNvidiaNimChatCompletion` executes through an injected fetcher.

The injected fetcher keeps tests offline and allows runtime services to enforce their own retry, timeout, quota, audit, and secret-loading policies. Runtime services must source `NVIDIA_API_KEY` from the configured secret provider, never from code.
