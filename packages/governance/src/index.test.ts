import { describe, expect, it } from "vitest";

import {
  createDefaultGovernancePolicies,
  createInMemoryGovernancePolicyStore,
  detectSensitiveActionImpacts,
  evaluateGovernancePolicy,
  recordGovernancePolicy
} from "./index.js";

describe("detectSensitiveActionImpacts", () => {
  it("detects high-impact work from action text without assuming approval", () => {
    expect(
      detectSensitiveActionImpacts(
        "Deploy a destructive production migration that charges the customer and sends a public email"
      )
    ).toEqual([
      "money",
      "production_system",
      "public_communication",
      "destructive_action"
    ]);
  });

  it("keeps low-risk local planning actions empty", () => {
    expect(
      detectSensitiveActionImpacts("Draft an internal implementation plan")
    ).toEqual([]);
  });
});

describe("evaluateGovernancePolicy", () => {
  it("requires approval for sensitive external impacts", () => {
    const decision = evaluateGovernancePolicy({
      policies: createDefaultGovernancePolicies(),
      action: {
        id: "governance-action:deploy-production",
        action: "Deploy production workflow",
        requesterIdentityId: "identity:user:moksh",
        externalImpacts: ["production_system"],
        evidenceRefs: ["decision:runtime:deploy"]
      }
    });

    expect(decision).toEqual({
      decision: "requires_approval",
      policyIds: ["policy:approval:production-system"],
      action: "Deploy production workflow",
      reason: "Production-impacting actions require explicit approval.",
      detectedImpacts: ["production_system"],
      approvalRequirements: [
        {
          id: "approval-requirement:governance-action:deploy-production:policy:approval:production-system",
          action: "Deploy production workflow",
          requiredApproverRole: "owner",
          reason: "Production-impacting actions require explicit approval.",
          policyId: "policy:approval:production-system"
        }
      ]
    });
  });

  it("allows reversible actions with no sensitive impact", () => {
    const decision = evaluateGovernancePolicy({
      policies: createDefaultGovernancePolicies(),
      action: {
        id: "governance-action:draft-plan",
        action: "Draft internal implementation plan",
        requesterIdentityId: "identity:user:moksh",
        externalImpacts: [],
        evidenceRefs: ["goal:runtime-plan"]
      }
    });

    expect(decision).toEqual({
      decision: "allow",
      policyIds: [],
      action: "Draft internal implementation plan",
      reason: "No enabled governance policy requires approval or denial.",
      detectedImpacts: [],
      approvalRequirements: []
    });
  });

  it("uses explicit deny policies before approval policies", () => {
    const decision = evaluateGovernancePolicy({
      policies: [
        ...createDefaultGovernancePolicies(),
        {
          id: "policy:deny:legal-without-human",
          name: "Deny legal commitments without human signature",
          description: "Legal commitments cannot be executed autonomously.",
          impactKinds: ["legal_commitment"],
          decision: "deny",
          requiredApproverRole: "owner",
          reason: "Legal commitments must be handled by a human.",
          enabled: true
        }
      ],
      action: {
        id: "governance-action:sign-contract",
        action: "Sign a vendor contract",
        requesterIdentityId: "identity:user:moksh",
        externalImpacts: ["legal_commitment"],
        evidenceRefs: ["contract:draft"]
      }
    });

    expect(decision).toMatchObject({
      decision: "deny",
      policyIds: ["policy:deny:legal-without-human"],
      reason: "Legal commitments must be handled by a human.",
      approvalRequirements: []
    });
  });
});

describe("governance policy store", () => {
  it("records and lists immutable policies", () => {
    const store = createInMemoryGovernancePolicyStore();

    const policy = recordGovernancePolicy(store, {
      id: "policy:approval:desktop-control",
      name: "Desktop control approval",
      description: "Real desktop control requires explicit approval.",
      impactKinds: ["real_desktop_control"],
      decision: "requires_approval",
      requiredApproverRole: "owner",
      reason: "Desktop control can affect local files and apps.",
      enabled: true
    });

    policy.impactKinds.push("mutated" as never);

    expect(store.list()).toEqual([
      {
        id: "policy:approval:desktop-control",
        name: "Desktop control approval",
        description: "Real desktop control requires explicit approval.",
        impactKinds: ["real_desktop_control"],
        decision: "requires_approval",
        requiredApproverRole: "owner",
        reason: "Desktop control can affect local files and apps.",
        enabled: true
      }
    ]);
  });
});
