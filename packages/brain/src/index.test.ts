import { describe, expect, it } from "vitest";

import type { ExperienceArtifact } from "@atlas-aios/experience";
import { explainPlan, lookupPlanningExperience, selectPlanningModel } from "./index.js";

describe("lookupPlanningExperience", () => {
  it("returns planning-relevant Experience for requested capabilities", () => {
    const artifacts: ExperienceArtifact[] = [
      {
        id: "experience:heuristic:create-resource",
        type: "heuristic",
        summary: "Use idempotency keys for resource creation.",
        evidenceMemoryEventIds: ["memory:event:1", "memory:event:2"],
        applicability: ["capability:create-resource"],
        confidence: 0.9
      },
      {
        id: "experience:decision-pattern:delete-resource",
        type: "decision_pattern",
        summary: "Delete resource needs extra review.",
        evidenceMemoryEventIds: ["memory:event:3", "memory:event:4"],
        applicability: ["capability:delete-resource"],
        confidence: 0.8
      }
    ];

    const result = lookupPlanningExperience({
      artifacts,
      goalId: "goal:unknown-system",
      capabilityIds: ["capability:create-resource"],
      minimumConfidence: 0.7
    });

    expect(result).toEqual({
      goalId: "goal:unknown-system",
      guidance: [
        {
          capabilityId: "capability:create-resource",
          artifacts: [artifacts[0]]
        }
      ]
    });
  });
});

describe("selectPlanningModel", () => {
  it("selects the remote deep reasoning lane for difficult internal architecture planning", () => {
    expect(
      selectPlanningModel({
        taskClass: "architecture",
        difficulty: "high",
        privacyClass: "internal",
        allowRemoteModels: true,
        allowFreeHostedEndpoints: true
      })
    ).toMatchObject({
      selectedProfileId: "nvidia-nemotron-super-remote",
      lane: "remote-deep-reasoning"
    });
  });

  it("keeps private planning on the local lane even when the task is critical", () => {
    expect(
      selectPlanningModel({
        taskClass: "governance-review",
        difficulty: "critical",
        privacyClass: "private",
        allowRemoteModels: true,
        allowFreeHostedEndpoints: true
      })
    ).toMatchObject({
      selectedProfileId: "qwen-local-default",
      lane: "local-default"
    });
  });
});

describe("explainPlan", () => {
  it("summarizes rationale, risks, approvals, and selected model lane", () => {
    expect(
      explainPlan({
        plan: {
          id: "plan:create-resource",
          goalId: "goal:unknown-system",
          rationale:
            "Learn the available interfaces before selecting a provider for resource creation.",
          risks: [
            "The OpenAPI description may be incomplete.",
            "Browser fallback may require human approval."
          ],
          steps: [
            {
              id: "step:discover",
              capabilityId: "capability:discover-interface",
              purpose: "Inspect available interface evidence.",
              requiresApproval: false
            },
            {
              id: "step:create",
              capabilityId: "capability:create-resource",
              purpose: "Create the target resource through the safest provider.",
              requiresApproval: true
            }
          ]
        },
        modelSelection: {
          selectedProfileId: "nvidia-nemotron-super-remote",
          lane: "remote-deep-reasoning",
          reason:
            "Selected optional NVIDIA Nemotron lane for a high-difficulty request.",
          guardrails: ["Do not send private memory to hosted endpoints."]
        }
      })
    ).toEqual({
      planId: "plan:create-resource",
      goalId: "goal:unknown-system",
      summary:
        "Plan plan:create-resource for goal goal:unknown-system has 2 steps and 1 approval gate.",
      rationale:
        "Learn the available interfaces before selecting a provider for resource creation.",
      riskSummary: [
        "The OpenAPI description may be incomplete.",
        "Browser fallback may require human approval."
      ],
      approvalStepIds: ["step:create"],
      modelLane: "remote-deep-reasoning",
      modelProfileId: "nvidia-nemotron-super-remote",
      guardrails: ["Do not send private memory to hosted endpoints."]
    });
  });
});
