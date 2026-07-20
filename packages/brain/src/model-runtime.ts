import {
  callNvidiaNimChatCompletion,
  routeModelRequest,
  type NvidiaNimFetcher,
  type ModelRoutingDecision,
  type ModelRoutingRequest
} from "@atlas-aios/core";

import type { AtlasPlan, PlanStep } from "./index.js";

const MAX_OBJECTIVE_CHARACTERS = 2_000;
const MAX_CONTEXT_CHARACTERS = 12_000;
const MAX_GOAL_ID_CHARACTERS = 512;
const MAX_USER_PROMPT_CHARACTERS = 16_000;
const MAX_PLAN_STEPS = 50;

export interface BrainPlanningModelInvocation {
  modelProfileId: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface BrainPlanningModelResponse {
  content: string;
  requestId?: string;
}

export interface BrainPlanningModelProvider {
  invoke(input: BrainPlanningModelInvocation): Promise<BrainPlanningModelResponse>;
}

export interface GenerateModelBackedPlanInput {
  planId: string;
  goalId: string;
  objective: string;
  context: string[];
  routing: ModelRoutingRequest;
  providers: Readonly<Record<string, BrainPlanningModelProvider | undefined>>;
}

export interface ModelBackedPlanResult {
  plan: AtlasPlan;
  modelSelection: ModelRoutingDecision;
  providerRequestId?: string;
}

export interface CreateNvidiaNimPlanningProviderInput {
  apiKey: string;
  fetcher: NvidiaNimFetcher;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  reasoningBudget?: number;
}

export class BrainModelUnavailableError extends Error {
  readonly code = "model_provider_unavailable";

  constructor(readonly modelProfileId: string) {
    super(`Brain model provider is not configured: ${modelProfileId}.`);
    this.name = "BrainModelUnavailableError";
  }
}

export class InvalidBrainModelOutputError extends Error {
  readonly code = "invalid_model_output";

  constructor(message: string) {
    super(message);
    this.name = "InvalidBrainModelOutputError";
  }
}

export async function generateModelBackedPlan(
  input: GenerateModelBackedPlanInput
): Promise<ModelBackedPlanResult> {
  const modelSelection = routeModelRequest(input.routing);
  const provider = input.providers[modelSelection.selectedProfileId];

  if (provider === undefined) {
    throw new BrainModelUnavailableError(modelSelection.selectedProfileId);
  }

  const response = await provider.invoke({
    modelProfileId: modelSelection.selectedProfileId,
    systemPrompt: createPlanningSystemPrompt(),
    userPrompt: createPlanningUserPrompt(input)
  });
  const plan = parseModelPlan(response.content, input.planId, input.goalId);

  return {
    plan,
    modelSelection,
    ...(response.requestId === undefined
      ? {}
      : { providerRequestId: response.requestId })
  };
}

export function createNvidiaNimPlanningProvider(
  input: CreateNvidiaNimPlanningProviderInput
): BrainPlanningModelProvider {
  return {
    invoke: async (invocation) => {
      const result = await callNvidiaNimChatCompletion({
        apiKey: input.apiKey,
        fetcher: input.fetcher,
        messages: [
          { role: "system", content: invocation.systemPrompt },
          { role: "user", content: invocation.userPrompt }
        ],
        ...(input.model === undefined ? {} : { model: input.model }),
        ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
        ...(input.maxTokens === undefined ? {} : { maxTokens: input.maxTokens }),
        ...(input.reasoningBudget === undefined
          ? {}
          : { reasoningBudget: input.reasoningBudget })
      });

      return {
        content: result.content,
        ...(result.id === undefined ? {} : { requestId: result.id })
      };
    }
  };
}

function createPlanningSystemPrompt(): string {
  return [
    "You are the planning Brain for Atlas AIOS.",
    "Return exactly one JSON object and no markdown or commentary.",
    "The object must contain rationale (string), risks (string array), and steps (array).",
    "Each step must contain capabilityId (string), purpose (string), and requiresApproval (boolean).",
    "Use capability-first language. Do not invent provider availability or claim execution occurred."
  ].join(" ");
}

function createPlanningUserPrompt(input: GenerateModelBackedPlanInput): string {
  const payload = {
    goalId: input.goalId.slice(0, MAX_GOAL_ID_CHARACTERS),
    objective: input.objective.slice(0, MAX_OBJECTIVE_CHARACTERS),
    context: [] as string[]
  };
  let remainingContextCharacters = MAX_CONTEXT_CHARACTERS;

  for (const item of input.context) {
    if (remainingContextCharacters <= 0) {
      break;
    }

    const maximumItemCharacters = Math.min(item.length, remainingContextCharacters);
    const acceptedItemCharacters = findLargestPromptSafePrefix(
      payload,
      item,
      maximumItemCharacters
    );

    if (acceptedItemCharacters > 0) {
      payload.context.push(item.slice(0, acceptedItemCharacters));
      remainingContextCharacters -= acceptedItemCharacters;
    }

    if (acceptedItemCharacters < maximumItemCharacters) {
      break;
    }
  }

  return JSON.stringify(payload);
}

function findLargestPromptSafePrefix(
  payload: { goalId: string; objective: string; context: string[] },
  item: string,
  maximumItemCharacters: number
): number {
  let low = 0;
  let high = maximumItemCharacters;

  while (low < high) {
    const candidate = Math.ceil((low + high) / 2);
    const serialized = JSON.stringify({
      ...payload,
      context: [...payload.context, item.slice(0, candidate)]
    });

    if (serialized.length <= MAX_USER_PROMPT_CHARACTERS) {
      low = candidate;
    } else {
      high = candidate - 1;
    }
  }

  return low;
}

function parseModelPlan(content: string, planId: string, goalId: string): AtlasPlan {
  let value: unknown;

  try {
    value = JSON.parse(content);
  } catch {
    throw new InvalidBrainModelOutputError(
      "Brain model output must be a single valid JSON object."
    );
  }

  if (!isRecord(value)) {
    throw new InvalidBrainModelOutputError("Brain plan must be a JSON object.");
  }

  const rationale = requireNonEmptyString(value.rationale, "rationale");
  const risks = requireStringArray(value.risks, "risks");

  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    throw new InvalidBrainModelOutputError(
      "Brain plan steps must be a non-empty array."
    );
  }

  if (value.steps.length > MAX_PLAN_STEPS) {
    throw new InvalidBrainModelOutputError(
      `Brain plan cannot contain more than ${MAX_PLAN_STEPS} steps.`
    );
  }

  const steps = value.steps.map((step, index) =>
    parseModelPlanStep(step, planId, index)
  );

  return { id: planId, goalId, rationale, risks, steps };
}

function parseModelPlanStep(value: unknown, planId: string, index: number): PlanStep {
  if (!isRecord(value)) {
    throw new InvalidBrainModelOutputError(
      `Brain plan step ${index + 1} must be a JSON object.`
    );
  }

  if (typeof value.requiresApproval !== "boolean") {
    throw new InvalidBrainModelOutputError(
      `Brain plan step ${index + 1} requiresApproval must be a boolean.`
    );
  }

  return {
    id: `${planId}:step:${index + 1}`,
    capabilityId: requireNonEmptyString(
      value.capabilityId,
      `steps[${index}].capabilityId`
    ),
    purpose: requireNonEmptyString(value.purpose, `steps[${index}].purpose`),
    requiresApproval: value.requiresApproval
  };
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidBrainModelOutputError(
      `Brain plan field ${field} must be a non-empty string.`
    );
  }

  return value;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.trim().length === 0)
  ) {
    throw new InvalidBrainModelOutputError(
      `Brain plan field ${field} must be an array of non-empty strings.`
    );
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
