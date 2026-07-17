import { describe, expect, it } from "vitest";

import type { CapabilityGraph } from "@atlas-aios/capability-graph";
import type { ExperienceArtifact } from "@atlas-aios/experience";
import type { ApprovalRequirement, PolicyDecision } from "@atlas-aios/governance";
import type { IdentityResolution, IdentitySubject } from "@atlas-aios/identity";
import type { MemoryEvent } from "@atlas-aios/memory";
import type { SelfModelSnapshot } from "@atlas-aios/self-model";
import type { SemanticEntity, SemanticRelationship } from "@atlas-aios/swm";
import type { WorldStateSnapshot } from "@atlas-aios/world-state";
import {
  THOUGHT_LIFECYCLE_MODEL,
  createApprovalNeededOutput,
  createClarificationNeededOutput,
  createThought,
  explainPlan,
  lookupCapabilityGraphPlanningContext,
  lookupExperiencePlanningContext,
  lookupGovernancePlanningContext,
  lookupIdentityPlanningContext,
  lookupMemoryPlanningContext,
  lookupSelfModelPlanningContext,
  lookupSwmPlanningContext,
  lookupWorldStatePlanningContext,
  lookupPlanningExperience,
  scheduleThought,
  selectPlanningModel
} from "./index.js";

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

describe("lookupExperiencePlanningContext", () => {
  it("returns applicable Experience artifacts as Brain context items", () => {
    const artifacts: ExperienceArtifact[] = [
      {
        id: "experience:anti-pattern:create-resource-weak-fields",
        type: "anti_pattern",
        summary:
          "Avoid live Create Resource execution when required field mappings are inferred only from UI labels.",
        evidenceMemoryEventIds: [
          "memory:event:failure:weak-fields",
          "memory:event:decision:simulate-first"
        ],
        applicability: ["capability:create-resource", "provider:browser-ui"],
        confidence: 0.88
      },
      {
        id: "experience:heuristic:delete-resource",
        type: "heuristic",
        summary: "Delete Resource should require explicit human approval.",
        evidenceMemoryEventIds: ["memory:event:delete-risk"],
        applicability: ["capability:delete-resource"],
        confidence: 0.91
      }
    ];

    expect(
      lookupExperiencePlanningContext({
        artifacts,
        artifactTypes: ["heuristic", "anti_pattern", "risk_pattern"],
        applicability: ["capability:create-resource"],
        minimumConfidence: 0.7,
        permissionScope: ["project:atlas"],
        limit: 5
      })
    ).toEqual({
      source: "experience",
      items: [
        {
          id: "experience-context:artifact:experience:anti-pattern:create-resource-weak-fields",
          source: "experience",
          summary:
            "anti_pattern Experience experience:anti-pattern:create-resource-weak-fields",
          content:
            "Avoid live Create Resource execution when required field mappings are inferred only from UI labels.",
          confidence: 0.88,
          relevance: 0.5,
          estimatedTokens: 23,
          permissionScope: ["project:atlas"],
          sourceRefs: [
            "experience:anti-pattern:create-resource-weak-fields",
            "memory:event:failure:weak-fields",
            "memory:event:decision:simulate-first"
          ]
        }
      ],
      droppedItemIds: ["experience:heuristic:delete-resource"]
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

describe("Thought lifecycle", () => {
  it("defines deterministic thought states and allowed transitions", () => {
    expect(THOUGHT_LIFECYCLE_MODEL).toEqual({
      initialStatus: "draft",
      terminalStatuses: ["resolved", "discarded"],
      allowedTransitions: {
        draft: ["ready", "discarded"],
        ready: ["scheduled", "blocked", "resolved", "discarded"],
        scheduled: ["blocked", "resolved", "discarded"],
        blocked: ["ready", "discarded"],
        resolved: [],
        discarded: []
      }
    });
  });

  it("creates a draft Thought with provenance and model lane metadata", () => {
    expect(
      createThought({
        id: "thought:plan-risk",
        goalId: "goal:unknown-system",
        kind: "hypothesis",
        summary: "Browser fallback may require human approval.",
        createdAt: "2026-07-06T08:30:00.000Z",
        sourceRefs: ["plan:create-resource", "risk:browser-fallback"],
        modelSelection: {
          selectedProfileId: "qwen-local-default",
          lane: "local-default",
          reason: "Selected local default lane.",
          guardrails: ["Use retrieval before generation."]
        }
      })
    ).toEqual({
      id: "thought:plan-risk",
      goalId: "goal:unknown-system",
      kind: "hypothesis",
      status: "draft",
      summary: "Browser fallback may require human approval.",
      createdAt: "2026-07-06T08:30:00.000Z",
      sourceRefs: ["plan:create-resource", "risk:browser-fallback"],
      modelLane: "local-default",
      modelProfileId: "qwen-local-default"
    });
  });
});

describe("Brain structured outputs", () => {
  it("creates a clarification-needed output that blocks planning until answered", () => {
    expect(
      createClarificationNeededOutput({
        id: "brain-output:clarify-target",
        goalId: "goal:unknown-system",
        question: "Which resource type should Atlas create first?",
        reason: "The available evidence mentions invoices and projects.",
        requiredFor: "provider selection",
        choices: ["invoice", "project"],
        sourceRefs: ["acr:evidence:unknown-openapi"],
        modelSelection: {
          selectedProfileId: "qwen-local-default",
          lane: "local-default",
          reason: "Selected local default lane.",
          guardrails: ["Use retrieval before generation."]
        }
      })
    ).toEqual({
      id: "brain-output:clarify-target",
      kind: "clarification_needed",
      goalId: "goal:unknown-system",
      question: "Which resource type should Atlas create first?",
      reason: "The available evidence mentions invoices and projects.",
      requiredFor: "provider selection",
      choices: ["invoice", "project"],
      blocking: true,
      sourceRefs: ["acr:evidence:unknown-openapi"],
      modelLane: "local-default",
      modelProfileId: "qwen-local-default"
    });
  });

  it("creates an approval-needed output for gated plan steps", () => {
    expect(
      createApprovalNeededOutput({
        id: "brain-output:approval-create",
        goalId: "goal:unknown-system",
        planId: "plan:create-resource",
        approvalStepIds: ["step:create"],
        reason: "Creating a resource changes external system state.",
        risks: ["Wrong field mapping could create bad data."],
        constraints: ["Run simulation first.", "Use idempotency key."],
        modelSelection: {
          selectedProfileId: "nvidia-nemotron-super-remote",
          lane: "remote-deep-reasoning",
          reason: "Selected optional NVIDIA Nemotron lane.",
          guardrails: ["Do not send private memory to hosted endpoints."]
        }
      })
    ).toEqual({
      id: "brain-output:approval-create",
      kind: "approval_needed",
      goalId: "goal:unknown-system",
      planId: "plan:create-resource",
      approvalStepIds: ["step:create"],
      reason: "Creating a resource changes external system state.",
      risks: ["Wrong field mapping could create bad data."],
      constraints: ["Run simulation first.", "Use idempotency key."],
      blocking: true,
      modelLane: "remote-deep-reasoning",
      modelProfileId: "nvidia-nemotron-super-remote"
    });
  });
});

describe("scheduleThought", () => {
  const readyThought = {
    id: "thought:plan-risk",
    goalId: "goal:unknown-system",
    kind: "hypothesis" as const,
    status: "ready" as const,
    summary: "Browser fallback may require human approval.",
    createdAt: "2026-07-06T08:30:00.000Z",
    sourceRefs: ["plan:create-resource"],
    modelLane: "local-default" as const,
    modelProfileId: "qwen-local-default"
  };

  it("schedules a ready Thought and emits a scheduling event", () => {
    expect(
      scheduleThought({
        thought: readyThought,
        eventId: "event:thought-scheduled",
        occurredAt: "2026-07-06T08:31:00.000Z",
        blockerRefs: []
      })
    ).toEqual({
      ok: true,
      thought: {
        ...readyThought,
        status: "scheduled"
      },
      event: {
        id: "event:thought-scheduled",
        type: "thought.scheduled",
        thoughtId: "thought:plan-risk",
        goalId: "goal:unknown-system",
        fromStatus: "ready",
        toStatus: "scheduled",
        occurredAt: "2026-07-06T08:31:00.000Z",
        blockerRefs: []
      }
    });
  });

  it("blocks a ready Thought when scheduler blockers are present", () => {
    expect(
      scheduleThought({
        thought: readyThought,
        eventId: "event:thought-blocked",
        occurredAt: "2026-07-06T08:32:00.000Z",
        blockerRefs: ["clarification:target-resource"]
      })
    ).toEqual({
      ok: true,
      thought: {
        ...readyThought,
        status: "blocked"
      },
      event: {
        id: "event:thought-blocked",
        type: "thought.blocked",
        thoughtId: "thought:plan-risk",
        goalId: "goal:unknown-system",
        fromStatus: "ready",
        toStatus: "blocked",
        occurredAt: "2026-07-06T08:32:00.000Z",
        blockerRefs: ["clarification:target-resource"]
      }
    });
  });

  it("rejects scheduling from terminal Thought states", () => {
    expect(
      scheduleThought({
        thought: {
          ...readyThought,
          status: "resolved"
        },
        eventId: "event:invalid",
        occurredAt: "2026-07-06T08:33:00.000Z",
        blockerRefs: []
      })
    ).toEqual({
      ok: false,
      error: {
        code: "thought.transition.invalid",
        message:
          "Cannot transition thought thought:plan-risk from resolved to scheduled."
      }
    });
  });
});

describe("lookupSwmPlanningContext", () => {
  it("returns permissioned SWM entities and relationships as Brain context items", () => {
    const entities: SemanticEntity[] = [
      {
        id: "swm:entity:resource",
        schemaVersion: "0.1",
        type: "business_resource",
        label: "Resource",
        attributes: { externalName: "Resource" },
        confidence: 0.91,
        evidenceRefs: ["evidence:docs:resource"],
        observedAt: "2026-07-06T09:00:00.000Z"
      },
      {
        id: "swm:entity:private-vendor",
        schemaVersion: "0.1",
        type: "vendor",
        label: "Private Vendor",
        attributes: { permissionScope: ["project:private"] },
        confidence: 0.95,
        evidenceRefs: ["evidence:private"],
        observedAt: "2026-07-06T09:01:00.000Z"
      }
    ];
    const relationships: SemanticRelationship[] = [
      {
        id: "swm:relationship:resource-owned-by-project",
        schemaVersion: "0.1",
        fromEntityId: "swm:entity:resource",
        toEntityId: "swm:entity:project",
        type: "owned_by",
        confidence: 0.82,
        evidenceRefs: ["evidence:openapi:resource-schema"],
        observedAt: "2026-07-06T09:02:00.000Z"
      }
    ];

    expect(
      lookupSwmPlanningContext({
        entities,
        relationships,
        entityIds: ["swm:entity:resource", "swm:entity:private-vendor"],
        relationshipTypes: ["owned_by"],
        permissionScope: ["project:atlas"],
        minimumConfidence: 0.8
      })
    ).toEqual({
      source: "swm",
      items: [
        {
          id: "swm-context:entity:swm:entity:resource",
          source: "swm",
          summary: "business_resource Resource",
          content:
            "Entity swm:entity:resource has type business_resource and label Resource.",
          confidence: 0.91,
          relevance: 1,
          estimatedTokens: 24,
          permissionScope: ["project:atlas"],
          sourceRefs: ["swm:entity:resource", "evidence:docs:resource"]
        },
        {
          id: "swm-context:relationship:swm:relationship:resource-owned-by-project",
          source: "swm",
          summary:
            "owned_by relationship from swm:entity:resource to swm:entity:project",
          content:
            "Relationship swm:relationship:resource-owned-by-project links swm:entity:resource to swm:entity:project as owned_by.",
          confidence: 0.82,
          relevance: 0.9,
          estimatedTokens: 32,
          permissionScope: ["project:atlas"],
          sourceRefs: [
            "swm:relationship:resource-owned-by-project",
            "evidence:openapi:resource-schema"
          ]
        }
      ],
      droppedItemIds: ["swm:entity:private-vendor"]
    });
  });
});

describe("lookupWorldStatePlanningContext", () => {
  it("returns active state and relevant blockers as Brain context items", () => {
    const snapshot: WorldStateSnapshot = {
      id: "world:snapshot:now",
      capturedAt: "2026-07-06T09:10:00.000Z",
      activeGoalIds: ["goal:unknown-system", "goal:other"],
      activeExecutionIds: ["execution:create-resource"],
      blockers: [
        {
          id: "blocker:approval",
          summary: "Create Resource requires approval before external write.",
          severity: "high",
          ownerId: "identity:user"
        },
        {
          id: "blocker:minor-note",
          summary: "Optional docs cleanup is pending.",
          severity: "low"
        }
      ]
    };

    expect(
      lookupWorldStatePlanningContext({
        snapshot,
        goalIds: ["goal:unknown-system"],
        minimumBlockerSeverity: "medium",
        permissionScope: ["project:atlas"]
      })
    ).toEqual({
      source: "world-state",
      items: [
        {
          id: "world-state-context:snapshot:world:snapshot:now",
          source: "world-state",
          summary: "World State snapshot world:snapshot:now",
          content:
            "Snapshot world:snapshot:now has 2 active goals and 1 active executions.",
          confidence: 1,
          relevance: 1,
          estimatedTokens: 28,
          permissionScope: ["project:atlas"],
          sourceRefs: ["world:snapshot:now"]
        },
        {
          id: "world-state-context:blocker:blocker:approval",
          source: "world-state",
          summary:
            "high blocker: Create Resource requires approval before external write.",
          content:
            "Blocker blocker:approval has severity high and owner identity:user.",
          confidence: 1,
          relevance: 0.95,
          estimatedTokens: 24,
          permissionScope: ["project:atlas"],
          sourceRefs: ["world:snapshot:now", "blocker:approval"]
        }
      ],
      droppedItemIds: ["blocker:minor-note"]
    });
  });
});

describe("lookupMemoryPlanningContext", () => {
  it("returns relevant Memory events as compact Brain context items", () => {
    const events: MemoryEvent[] = [
      {
        id: "memory:event:decision:create-resource",
        kind: "decision",
        occurredAt: "2026-07-06T09:20:00.000Z",
        summary: "Decision Engine approved Create Resource after simulation.",
        sourceIds: ["goal:unknown-system", "capability:create-resource"]
      },
      {
        id: "memory:event:meeting:unrelated",
        kind: "meeting",
        occurredAt: "2026-07-06T09:21:00.000Z",
        summary: "Discussed a separate documentation cleanup.",
        sourceIds: ["goal:docs-cleanup"]
      }
    ];

    expect(
      lookupMemoryPlanningContext({
        events,
        eventKinds: ["decision", "failure"],
        sourceIds: ["goal:unknown-system", "capability:create-resource"],
        permissionScope: ["project:atlas"],
        limit: 5
      })
    ).toEqual({
      source: "memory",
      items: [
        {
          id: "memory-context:event:memory:event:decision:create-resource",
          source: "memory",
          summary: "decision memory from 2026-07-06T09:20:00.000Z",
          content: "Decision Engine approved Create Resource after simulation.",
          confidence: 1,
          relevance: 1,
          estimatedTokens: 12,
          permissionScope: ["project:atlas"],
          sourceRefs: [
            "memory:event:decision:create-resource",
            "goal:unknown-system",
            "capability:create-resource"
          ]
        }
      ],
      droppedItemIds: ["memory:event:meeting:unrelated"]
    });
  });
});

describe("lookupSelfModelPlanningContext", () => {
  it("returns capability confidence, limitations, and authority as Brain context", () => {
    const snapshot: SelfModelSnapshot = {
      id: "self-model:snapshot:now",
      schemaVersion: "0.1",
      generatedAt: "2026-07-06T09:30:00.000Z",
      availableCapabilityIds: [
        "capability:create-resource",
        "capability:delete-resource"
      ],
      grantedAuthority: ["simulate", "read_docs", "execute_reversible"],
      resourceLimits: {},
      capabilityConfidence: [
        {
          capabilityId: "capability:create-resource",
          providerId: "provider:generated-openapi",
          confidence: 0.78,
          knownLimitations: ["Field mapping has not been production-validated."],
          knownFailureModes: [],
          evidenceRefs: ["benchmark:create-resource"],
          updatedAt: "2026-07-06T09:30:00.000Z"
        },
        {
          capabilityId: "capability:delete-resource",
          providerId: "provider:generated-openapi",
          confidence: 0.42,
          knownLimitations: ["Destructive actions require human approval."],
          knownFailureModes: [],
          evidenceRefs: ["governance:destructive-action-policy"],
          updatedAt: "2026-07-06T09:30:00.000Z"
        }
      ],
      interfaceMaturity: [],
      subsystemMaturity: [],
      knownLimitations: [],
      knownFailureModes: []
    };

    expect(
      lookupSelfModelPlanningContext({
        snapshot,
        capabilityIds: ["capability:create-resource", "capability:delete-resource"],
        minimumConfidence: 0.6,
        permissionScope: ["project:atlas"]
      })
    ).toEqual({
      source: "self-model",
      items: [
        {
          id: "self-model-context:authority:self-model:snapshot:now",
          source: "self-model",
          summary: "Self Model authority snapshot self-model:snapshot:now",
          content: "Granted authority: simulate, read_docs, execute_reversible.",
          confidence: 1,
          relevance: 0.9,
          estimatedTokens: 12,
          permissionScope: ["project:atlas"],
          sourceRefs: ["self-model:snapshot:now"]
        },
        {
          id: "self-model-context:capability:capability:create-resource:provider:generated-openapi",
          source: "self-model",
          summary:
            "Self confidence 0.78 for capability:create-resource via provider:generated-openapi",
          content:
            "Known limitations: Field mapping has not been production-validated.",
          confidence: 0.78,
          relevance: 1,
          estimatedTokens: 12,
          permissionScope: ["project:atlas"],
          sourceRefs: [
            "self-model:snapshot:now",
            "capability:create-resource",
            "provider:generated-openapi"
          ]
        }
      ],
      droppedItemIds: ["capability:delete-resource:provider:generated-openapi"]
    });
  });
});

describe("lookupIdentityPlanningContext", () => {
  it("returns confidence-filtered identity subjects and external resolutions", () => {
    const subjects: IdentitySubject[] = [
      {
        id: "identity:user:moksh",
        schemaVersion: "0.1",
        kind: "human",
        displayName: "Moksh",
        confidence: 0.99,
        aliases: ["Apophis WillTakeOver"],
        evidenceRefs: ["workspace:notion:user"]
      },
      {
        id: "identity:provider:uncertain",
        schemaVersion: "0.1",
        kind: "provider",
        displayName: "Uncertain Provider",
        confidence: 0.41,
        aliases: [],
        evidenceRefs: ["evidence:weak"]
      }
    ];
    const resolutions: IdentityResolution[] = [
      {
        id: "identity-resolution:github:moksh",
        schemaVersion: "0.1",
        subjectId: "identity:user:moksh",
        externalSystem: "github",
        externalId: "Atlas-aios",
        confidence: 0.91,
        resolvedAt: "2026-07-06T09:40:00.000Z",
        evidenceRefs: ["github:org:Atlas-aios"]
      }
    ];

    expect(
      lookupIdentityPlanningContext({
        subjects,
        resolutions,
        subjectIds: ["identity:user:moksh", "identity:provider:uncertain"],
        externalSystems: ["github"],
        minimumConfidence: 0.8,
        permissionScope: ["project:atlas"]
      })
    ).toEqual({
      source: "identity",
      items: [
        {
          id: "identity-context:subject:identity:user:moksh",
          source: "identity",
          summary: "human identity Moksh",
          content:
            "Identity identity:user:moksh is a human named Moksh with aliases Apophis WillTakeOver.",
          confidence: 0.99,
          relevance: 1,
          estimatedTokens: 17,
          permissionScope: ["project:atlas"],
          sourceRefs: ["identity:user:moksh", "workspace:notion:user"]
        },
        {
          id: "identity-context:resolution:identity-resolution:github:moksh",
          source: "identity",
          summary: "github identity resolution for identity:user:moksh",
          content:
            "Subject identity:user:moksh resolves to github external id Atlas-aios.",
          confidence: 0.91,
          relevance: 0.95,
          estimatedTokens: 12,
          permissionScope: ["project:atlas"],
          sourceRefs: [
            "identity-resolution:github:moksh",
            "identity:user:moksh",
            "github:org:Atlas-aios"
          ]
        }
      ],
      droppedItemIds: ["identity:provider:uncertain"]
    });
  });
});

describe("lookupCapabilityGraphPlanningContext", () => {
  it("returns requested capabilities and dependency edges as Brain context", () => {
    const graph: CapabilityGraph = {
      id: "capability-graph:unknown-system",
      schemaVersion: "0.1",
      status: "draft",
      generatedAt: "2026-07-06T10:00:00.000Z",
      nodes: [
        {
          id: "capability:create-resource",
          schemaVersion: "0.1",
          name: "Create Resource",
          level: "L2",
          confidence: 0.84,
          sourceRefs: ["evidence:openapi:create-resource"]
        },
        {
          id: "capability:authenticate",
          schemaVersion: "0.1",
          name: "Authenticate",
          level: "L1",
          confidence: 0.92,
          sourceRefs: ["evidence:openapi:auth"]
        },
        {
          id: "capability:delete-resource",
          schemaVersion: "0.1",
          name: "Delete Resource",
          level: "L2",
          confidence: 0.45,
          sourceRefs: ["evidence:weak-delete"]
        }
      ],
      edges: [
        {
          fromCapabilityId: "capability:create-resource",
          toCapabilityId: "capability:authenticate",
          relationship: "requires"
        },
        {
          fromCapabilityId: "capability:delete-resource",
          toCapabilityId: "capability:authenticate",
          relationship: "requires"
        }
      ]
    };

    expect(
      lookupCapabilityGraphPlanningContext({
        graph,
        capabilityIds: ["capability:create-resource", "capability:delete-resource"],
        minimumConfidence: 0.7,
        includeDependencyEdges: true,
        permissionScope: ["project:atlas"]
      })
    ).toEqual({
      source: "capability-graph",
      items: [
        {
          id: "capability-graph-context:node:capability:create-resource",
          source: "capability-graph",
          summary: "L2 capability Create Resource",
          content:
            "Capability capability:create-resource is named Create Resource, has level L2, graph status draft, and confidence 0.84.",
          confidence: 0.84,
          relevance: 1,
          estimatedTokens: 23,
          permissionScope: ["project:atlas"],
          sourceRefs: [
            "capability-graph:unknown-system",
            "capability:create-resource",
            "evidence:openapi:create-resource"
          ]
        },
        {
          id: "capability-graph-context:edge:capability:create-resource:requires:capability:authenticate",
          source: "capability-graph",
          summary:
            "requires edge from capability:create-resource to capability:authenticate",
          content:
            "Capability capability:create-resource requires capability:authenticate.",
          confidence: 0.84,
          relevance: 0.9,
          estimatedTokens: 12,
          permissionScope: ["project:atlas"],
          sourceRefs: [
            "capability-graph:unknown-system",
            "capability:create-resource",
            "capability:authenticate"
          ]
        }
      ],
      droppedItemIds: ["capability:delete-resource"]
    });
  });
});

describe("lookupGovernancePlanningContext", () => {
  it("returns planning-relevant policy decisions and approval requirements", () => {
    const policyDecisions: PolicyDecision[] = [
      {
        decision: "requires_approval",
        action: "external.write",
        policyIds: ["policy:external-write"],
        reason: "External writes require approval before execution."
      },
      {
        decision: "allow",
        action: "docs.read",
        policyIds: ["policy:read-public-docs"],
        reason: "Reading public documentation is allowed."
      },
      {
        decision: "deny",
        action: "production.delete",
        policyIds: ["policy:no-production-delete"],
        reason: "Production delete is blocked for this goal."
      }
    ];
    const approvalRequirements: ApprovalRequirement[] = [
      {
        id: "approval:req:external-write",
        action: "external.write",
        requiredApproverRole: "project_owner",
        reason: "The action changes external system state."
      },
      {
        id: "approval:req:billing",
        action: "billing.spend",
        requiredApproverRole: "owner",
        reason: "The action spends money."
      }
    ];

    expect(
      lookupGovernancePlanningContext({
        policyDecisions,
        approvalRequirements,
        actionIds: ["external.write", "production.delete"],
        includeAllowDecisions: false,
        permissionScope: ["project:atlas"],
        limit: 5
      })
    ).toEqual({
      source: "governance",
      items: [
        {
          id: "governance-context:policy:external.write:policy:external-write",
          source: "governance",
          summary: "requires_approval governance decision",
          content:
            "Governance decision requires_approval applies from policies policy:external-write: External writes require approval before execution.",
          confidence: 1,
          relevance: 1,
          estimatedTokens: 12,
          permissionScope: ["project:atlas"],
          sourceRefs: ["policy:external-write"]
        },
        {
          id: "governance-context:policy:production.delete:policy:no-production-delete",
          source: "governance",
          summary: "deny governance decision",
          content:
            "Governance decision deny applies from policies policy:no-production-delete: Production delete is blocked for this goal.",
          confidence: 1,
          relevance: 1,
          estimatedTokens: 12,
          permissionScope: ["project:atlas"],
          sourceRefs: ["policy:no-production-delete"]
        },
        {
          id: "governance-context:approval:approval:req:external-write",
          source: "governance",
          summary: "Approval required for external.write",
          content:
            "Action external.write requires approval from project_owner: The action changes external system state.",
          confidence: 1,
          relevance: 1,
          estimatedTokens: 18,
          permissionScope: ["project:atlas"],
          sourceRefs: ["approval:req:external-write"]
        }
      ],
      droppedItemIds: [
        "governance-context:policy:docs.read:policy:read-public-docs",
        "approval:req:billing"
      ]
    });
  });
});
