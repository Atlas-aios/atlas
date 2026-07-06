export type ModelProviderId = "local-qwen" | "nvidia-nim";
export type ModelLaneId = "local-default" | "remote-deep-reasoning";
export type ModelTaskClass =
  | "routine"
  | "planning"
  | "architecture"
  | "governance-review"
  | "hard-debugging"
  | "research-synthesis";
export type ModelDifficulty = "low" | "medium" | "high" | "critical";
export type ModelPrivacyClass = "public" | "internal" | "private" | "confidential";

export interface ModelProfile {
  id: string;
  provider: ModelProviderId;
  model: string;
  lane: ModelLaneId;
  endpoint?: string;
  default: boolean;
  purpose: string;
  allowedTaskClasses: ModelTaskClass[];
  allowedPrivacyClasses: ModelPrivacyClass[];
  requiresExplicitRemoteDataPermission: boolean;
}

export interface ModelRoutingRequest {
  taskClass: ModelTaskClass;
  difficulty: ModelDifficulty;
  privacyClass: ModelPrivacyClass;
  allowRemoteModels: boolean;
  allowFreeHostedEndpoints: boolean;
}

export interface ModelRoutingDecision {
  selectedProfileId: string;
  lane: ModelLaneId;
  reason: string;
  guardrails: string[];
}

export const MODEL_PROFILES: ModelProfile[] = [
  {
    id: "qwen-local-default",
    provider: "local-qwen",
    model: "qwen3-local-router",
    lane: "local-default",
    default: true,
    purpose: "Default private local reasoning, routing, and planning lane.",
    allowedTaskClasses: [
      "routine",
      "planning",
      "architecture",
      "governance-review",
      "hard-debugging",
      "research-synthesis"
    ],
    allowedPrivacyClasses: ["public", "internal", "private", "confidential"],
    requiresExplicitRemoteDataPermission: false
  },
  {
    id: "nvidia-nemotron-super-remote",
    provider: "nvidia-nim",
    model: "nvidia/nemotron-3-super-120b-a12b",
    lane: "remote-deep-reasoning",
    endpoint: "https://integrate.api.nvidia.com/v1",
    default: false,
    purpose:
      "Optional free hosted NVIDIA NIM deep reasoning lane for large or difficult requests.",
    allowedTaskClasses: [
      "architecture",
      "governance-review",
      "hard-debugging",
      "research-synthesis"
    ],
    allowedPrivacyClasses: ["public", "internal"],
    requiresExplicitRemoteDataPermission: true
  }
];

export function routeModelRequest(
  request: ModelRoutingRequest,
  profiles: ModelProfile[] = MODEL_PROFILES
): ModelRoutingDecision {
  const localDefault = profiles.find((profile) => profile.default);
  if (localDefault === undefined) {
    throw new Error("A default local model profile is required.");
  }

  const remoteDeepReasoning = profiles.find(
    (profile) => profile.lane === "remote-deep-reasoning"
  );
  const remoteEligible =
    remoteDeepReasoning !== undefined &&
    request.allowRemoteModels &&
    request.allowFreeHostedEndpoints &&
    (request.difficulty === "high" || request.difficulty === "critical") &&
    remoteDeepReasoning.allowedTaskClasses.includes(request.taskClass) &&
    remoteDeepReasoning.allowedPrivacyClasses.includes(request.privacyClass);

  if (remoteEligible) {
    return {
      selectedProfileId: remoteDeepReasoning.id,
      lane: "remote-deep-reasoning",
      reason:
        "Selected optional NVIDIA Nemotron lane for a high-difficulty request that passed remote, free-endpoint, task, and privacy gates.",
      guardrails: [
        "Do not send private or confidential memory to hosted endpoints.",
        "Send bounded context packets, not raw memory dumps.",
        "Fallback to the local model if the endpoint is unavailable or quota-limited."
      ]
    };
  }

  return {
    selectedProfileId: localDefault.id,
    lane: "local-default",
    reason:
      "Selected local default lane because the request did not pass every remote deep reasoning gate.",
    guardrails: [
      "Use retrieval before generation.",
      "Prefer deterministic validation for structured outputs.",
      "Escalate only when difficulty, privacy, and remote permission gates allow it."
    ]
  };
}
