import { describe, expect, it } from "vitest";
import {
  buildNvidiaNimChatCompletionRequest,
  callNvidiaNimChatCompletion
} from "./index.js";

describe("NVIDIA NIM chat completion client", () => {
  it("builds an OpenAI-compatible Nemotron chat completion request", () => {
    expect(
      buildNvidiaNimChatCompletionRequest({
        apiKey: "test-key",
        model: "nvidia/nemotron-3-super-120b-a12b",
        messages: [{ role: "user", content: "Review this Atlas plan." }],
        maxTokens: 2048,
        reasoningBudget: 1024,
        enableThinking: true
      })
    ).toEqual({
      url: "https://integrate.api.nvidia.com/v1/chat/completions",
      init: {
        method: "POST",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-super-120b-a12b",
          messages: [{ role: "user", content: "Review this Atlas plan." }],
          max_tokens: 2048,
          stream: false,
          extra_body: {
            chat_template_kwargs: { enable_thinking: true },
            reasoning_budget: 1024
          }
        })
      }
    });
  });

  it("uses an injected fetcher and extracts content plus reasoning", async () => {
    const response = await callNvidiaNimChatCompletion({
      apiKey: "test-key",
      messages: [{ role: "user", content: "Think carefully." }],
      fetcher: async (url, init) => ({
        ok: true,
        status: 200,
        json: async () => ({
          id: "chatcmpl-test",
          choices: [
            {
              message: {
                content: "Use the remote lane.",
                reasoning_content: "The task is hard and internal."
              }
            }
          ]
        }),
        request: { url, init }
      })
    });

    expect(response).toEqual({
      id: "chatcmpl-test",
      content: "Use the remote lane.",
      reasoning: "The task is hard and internal."
    });
  });
});
