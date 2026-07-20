import { describe, expect, it } from "vitest";

import {
  createRuntimeBrainConfigFromEnvironment,
  startAtlasRuntimeServer
} from "./server.js";

describe("Atlas runtime server", () => {
  it("serves the runtime API over local HTTP", async () => {
    const server = await startAtlasRuntimeServer({ port: 0 });

    try {
      const response = await fetch(`${server.url}/health`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        service: "atlas-runtime",
        status: "ok"
      });
    } finally {
      await server.close();
    }
  });

  it("wires the NVIDIA planning provider only when server policy and credentials allow it", async () => {
    const requests: Array<{ url: string; authorization: string }> = [];
    const brain = createRuntimeBrainConfigFromEnvironment(
      {
        ATLAS_ALLOW_REMOTE_MODELS: "true",
        ATLAS_ALLOW_FREE_HOSTED_MODEL_ENDPOINTS: "true",
        NVIDIA_API_KEY: "test-nvidia-key"
      },
      async (url, init) => {
        requests.push({
          url,
          authorization: init.headers.Authorization
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "nim-request:server-test",
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    rationale: "Use the governed remote reasoning lane.",
                    risks: [],
                    steps: [
                      {
                        capabilityId: "capability:inspect",
                        purpose: "Inspect available evidence.",
                        requiresApproval: false
                      }
                    ]
                  })
                }
              }
            ]
          })
        };
      }
    );

    const response = await brain.providers["nvidia-nemotron-super-remote"]?.invoke({
      modelProfileId: "nvidia-nemotron-super-remote",
      systemPrompt: "system",
      userPrompt: "user"
    });

    expect(brain.allowRemoteModels).toBe(true);
    expect(brain.allowFreeHostedEndpoints).toBe(true);
    expect(response).toEqual({
      requestId: "nim-request:server-test",
      content: expect.stringContaining("governed remote reasoning lane")
    });
    expect(requests).toEqual([
      {
        url: "https://integrate.api.nvidia.com/v1/chat/completions",
        authorization: "Bearer test-nvidia-key"
      }
    ]);
  });

  it("does not wire NVIDIA when either remote policy gate is closed", () => {
    const brain = createRuntimeBrainConfigFromEnvironment({
      ATLAS_ALLOW_REMOTE_MODELS: "true",
      ATLAS_ALLOW_FREE_HOSTED_MODEL_ENDPOINTS: "false",
      NVIDIA_API_KEY: "test-nvidia-key"
    });

    expect(brain.providers["nvidia-nemotron-super-remote"]).toBeUndefined();
  });

  it("wires a configured local OpenAI-compatible planning provider", async () => {
    const requests: Array<{
      url: string;
      authorization?: string;
      model: string;
    }> = [];
    const brain = createRuntimeBrainConfigFromEnvironment(
      {
        ATLAS_LOCAL_MODEL_ID: "qwen3:8b",
        ATLAS_LOCAL_MODEL_BASE_URL: "http://127.0.0.1:1234/v1/",
        ATLAS_LOCAL_MODEL_API_KEY: "local-secret"
      },
      undefined,
      async (url, init) => {
        requests.push({
          url,
          ...(init.headers.Authorization === undefined
            ? {}
            : { authorization: init.headers.Authorization }),
          model: (JSON.parse(init.body) as { model: string }).model
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "local-request:server-test",
            choices: [{ message: { content: "{}" } }]
          })
        };
      }
    );

    await expect(
      brain.providers["qwen-local-default"]?.invoke({
        modelProfileId: "qwen-local-default",
        systemPrompt: "system",
        userPrompt: "user"
      })
    ).resolves.toEqual({
      requestId: "local-request:server-test",
      content: "{}"
    });
    expect(requests).toEqual([
      {
        url: "http://127.0.0.1:1234/v1/chat/completions",
        authorization: "Bearer local-secret",
        model: "qwen3:8b"
      }
    ]);
  });
});
