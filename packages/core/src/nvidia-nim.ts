export type NvidiaNimRole = "system" | "user" | "assistant";

export interface NvidiaNimMessage {
  role: NvidiaNimRole;
  content: string;
}

export interface BuildNvidiaNimChatCompletionRequestInput {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  messages: NvidiaNimMessage[];
  maxTokens?: number;
  reasoningBudget?: number;
  enableThinking?: boolean;
}

export interface NvidiaNimHttpRequest {
  url: string;
  init: {
    method: "POST";
    headers: {
      Authorization: string;
      "Content-Type": "application/json";
    };
    body: string;
  };
}

export interface NvidiaNimChatCompletionResult {
  id?: string;
  content: string;
  reasoning?: string;
}

export interface NvidiaNimFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type NvidiaNimFetcher = (
  url: string,
  init: NvidiaNimHttpRequest["init"]
) => Promise<NvidiaNimFetchResponse>;

export interface CallNvidiaNimChatCompletionInput extends BuildNvidiaNimChatCompletionRequestInput {
  fetcher: NvidiaNimFetcher;
}

interface NvidiaNimChatCompletionResponse {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
}

const DEFAULT_NVIDIA_NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NEMOTRON_MODEL = "nvidia/nemotron-3-super-120b-a12b";

export function buildNvidiaNimChatCompletionRequest(
  input: BuildNvidiaNimChatCompletionRequestInput
): NvidiaNimHttpRequest {
  const baseUrl = input.baseUrl ?? DEFAULT_NVIDIA_NIM_BASE_URL;
  const model = input.model ?? DEFAULT_NEMOTRON_MODEL;

  return {
    url: `${baseUrl}/chat/completions`,
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        max_tokens: input.maxTokens ?? 4096,
        stream: false,
        extra_body: {
          chat_template_kwargs: {
            enable_thinking: input.enableThinking ?? true
          },
          reasoning_budget: input.reasoningBudget ?? 4096
        }
      })
    }
  };
}

export async function callNvidiaNimChatCompletion(
  input: CallNvidiaNimChatCompletionInput
): Promise<NvidiaNimChatCompletionResult> {
  const request = buildNvidiaNimChatCompletionRequest(input);
  const response = await input.fetcher(request.url, request.init);

  if (!response.ok) {
    throw new Error(`NVIDIA NIM request failed with status ${response.status}.`);
  }

  const body = (await response.json()) as NvidiaNimChatCompletionResponse;
  const message = body.choices?.[0]?.message;
  const content = message?.content;

  if (content === undefined) {
    throw new Error("NVIDIA NIM response did not include assistant content.");
  }

  return {
    ...(body.id === undefined ? {} : { id: body.id }),
    content,
    ...(message?.reasoning_content === undefined
      ? {}
      : { reasoning: message.reasoning_content })
  };
}
