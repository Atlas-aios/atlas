import { describe, expect, it } from "vitest";

import {
  BrainModelUnavailableError,
  InvalidBrainModelOutputError,
  createOpenAiCompatiblePlanningProvider,
  generateModelBackedPlan
} from "./model-runtime.js";

describe("model-backed Brain planning", () => {
  it("calls a local OpenAI-compatible endpoint and extracts assistant content", async () => {
    const requests: Array<{
      url: string;
      authorization?: string;
      body: unknown;
    }> = [];
    const provider = createOpenAiCompatiblePlanningProvider({
      baseUrl: "http://127.0.0.1:11434/v1/",
      model: "qwen3:8b",
      apiKey: "local-test-key",
      maxTokens: 2048,
      fetcher: async (url, init) => {
        requests.push({
          url,
          ...(init.headers.Authorization === undefined
            ? {}
            : { authorization: init.headers.Authorization }),
          body: JSON.parse(init.body)
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "local-chat:1",
            choices: [
              {
                message: {
                  content: '{"rationale":"Local plan","risks":[],"steps":[]}'
                }
              }
            ]
          })
        };
      }
    });

    await expect(
      provider.invoke({
        modelProfileId: "qwen-local-default",
        systemPrompt: "Return JSON.",
        userPrompt: "Plan this goal."
      })
    ).resolves.toEqual({
      requestId: "local-chat:1",
      content: '{"rationale":"Local plan","risks":[],"steps":[]}'
    });
    expect(requests).toEqual([
      {
        url: "http://127.0.0.1:11434/v1/chat/completions",
        authorization: "Bearer local-test-key",
        body: {
          model: "qwen3:8b",
          messages: [
            { role: "system", content: "Return JSON." },
            { role: "user", content: "Plan this goal." }
          ],
          max_tokens: 2048,
          stream: false,
          temperature: 0.2
        }
      }
    ]);
  });

  it("routes a bounded request through the selected provider and validates the plan", async () => {
    const invocations: Array<{
      modelProfileId: string;
      systemPrompt: string;
      userPrompt: string;
    }> = [];

    const result = await generateModelBackedPlan({
      planId: "plan:goal-1:1",
      goalId: "goal:1",
      objective: "Design a safe architecture for the unknown interface.",
      context: [
        "The interface exposes a resource creation capability.",
        "Production changes require approval."
      ],
      routing: {
        taskClass: "architecture",
        difficulty: "high",
        privacyClass: "internal",
        allowRemoteModels: true,
        allowFreeHostedEndpoints: true
      },
      providers: {
        "nvidia-nemotron-super-remote": {
          invoke: async (input) => {
            invocations.push(input);
            return {
              requestId: "nim-request:1",
              content: JSON.stringify({
                id: "untrusted-model-plan-id",
                goalId: "untrusted-model-goal-id",
                rationale: "Discover the interface before changing external state.",
                risks: ["The discovered schema may be incomplete."],
                steps: [
                  {
                    id: "untrusted-model-step-id",
                    capabilityId: "capability:discover-interface",
                    purpose: "Inspect the available interface evidence.",
                    requiresApproval: false
                  },
                  {
                    capabilityId: "capability:create-resource",
                    purpose: "Create the resource after deterministic validation.",
                    requiresApproval: true
                  }
                ]
              })
            };
          }
        }
      }
    });

    expect(result).toEqual({
      plan: {
        id: "plan:goal-1:1",
        goalId: "goal:1",
        rationale: "Discover the interface before changing external state.",
        risks: ["The discovered schema may be incomplete."],
        steps: [
          {
            id: "plan:goal-1:1:step:1",
            capabilityId: "capability:discover-interface",
            purpose: "Inspect the available interface evidence.",
            requiresApproval: false
          },
          {
            id: "plan:goal-1:1:step:2",
            capabilityId: "capability:create-resource",
            purpose: "Create the resource after deterministic validation.",
            requiresApproval: true
          }
        ]
      },
      modelSelection: expect.objectContaining({
        selectedProfileId: "nvidia-nemotron-super-remote",
        lane: "remote-deep-reasoning"
      }),
      providerRequestId: "nim-request:1"
    });
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.modelProfileId).toBe("nvidia-nemotron-super-remote");
    expect(invocations[0]?.systemPrompt).toContain("Return exactly one JSON object");
    expect(invocations[0]?.userPrompt).toContain("goal:1");
    expect(invocations[0]?.userPrompt.length).toBeLessThanOrEqual(16_000);
  });

  it("bounds the serialized prompt even when context characters require JSON escaping", async () => {
    let userPrompt = "";

    await generateModelBackedPlan({
      planId: "plan:bounded",
      goalId: "goal:bounded",
      objective: "Bound the prompt.",
      context: ['"'.repeat(20_000), "unused context"],
      routing: {
        taskClass: "planning",
        difficulty: "medium",
        privacyClass: "private",
        allowRemoteModels: false,
        allowFreeHostedEndpoints: false
      },
      providers: {
        "qwen-local-default": {
          invoke: async (input) => {
            userPrompt = input.userPrompt;
            return {
              content: JSON.stringify({
                rationale: "Use bounded evidence.",
                risks: [],
                steps: [
                  {
                    capabilityId: "capability:inspect",
                    purpose: "Inspect bounded context.",
                    requiresApproval: false
                  }
                ]
              })
            };
          }
        }
      }
    });

    expect(userPrompt.length).toBeLessThanOrEqual(16_000);
  });

  it("fails explicitly when the selected provider is not configured", async () => {
    await expect(
      generateModelBackedPlan({
        planId: "plan:missing-provider",
        goalId: "goal:missing-provider",
        objective: "Plan locally.",
        context: [],
        routing: {
          taskClass: "planning",
          difficulty: "medium",
          privacyClass: "private",
          allowRemoteModels: false,
          allowFreeHostedEndpoints: false
        },
        providers: {}
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<BrainModelUnavailableError>>({
        code: "model_provider_unavailable",
        modelProfileId: "qwen-local-default"
      })
    );
  });

  it("rejects model output that is not a strict plan JSON object", async () => {
    await expect(
      generateModelBackedPlan({
        planId: "plan:invalid",
        goalId: "goal:invalid",
        objective: "Return a plan.",
        context: [],
        routing: {
          taskClass: "planning",
          difficulty: "medium",
          privacyClass: "private",
          allowRemoteModels: false,
          allowFreeHostedEndpoints: false
        },
        providers: {
          "qwen-local-default": {
            invoke: async () => ({ content: "```json\n{}\n```" })
          }
        }
      })
    ).rejects.toBeInstanceOf(InvalidBrainModelOutputError);
  });
});
