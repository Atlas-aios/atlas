import { describe, expect, it } from "vitest";
import { createDefaultDecisionEngine } from "./index.js";

const engine = createDefaultDecisionEngine();

describe("default decision engine", () => {
  it("approves low-risk reversible local actions", () => {
    const outcome = engine.decide({
      id: "decision_req_cache",
      goalId: "goal_cleanup",
      action: "Delete generated cache files",
      actionType: "local_file_change",
      rationale: "Cache files are generated and safe to recreate.",
      reversibility: "reversible",
      externalImpacts: [],
      risks: [],
      alternatives: [],
      evidenceRefs: ["trace:cache_scan"],
      requesterIdentityId: "identity:user",
      authorityMode: "broad"
    });

    expect(outcome.type).toBe("approve");
    expect(outcome.constraints).toEqual([]);
    expect(outcome.auditSeverity).toBe("low");
  });

  it("approves communication drafts with constraints", () => {
    const outcome = engine.decide({
      id: "decision_req_vendor_email",
      goalId: "goal_vendor_followup",
      action: "Draft a vendor email",
      actionType: "communication",
      rationale: "The vendor needs follow-up context.",
      reversibility: "partially_reversible",
      externalImpacts: ["public_communication"],
      risks: [],
      alternatives: [],
      evidenceRefs: ["memory:vendor_thread"],
      requesterIdentityId: "identity:user",
      authorityMode: "broad"
    });

    expect(outcome).toMatchObject({
      type: "approve_with_constraints",
      auditSeverity: "medium",
      constraints: [
        "Draft the communication first.",
        "Do not send externally until the final message is reviewed or explicitly authorized.",
        "Do not include confidential data unless the requester explicitly allows it."
      ]
    });
  });

  it("discusses destructive irreversible actions and suggests a safer alternative", () => {
    const outcome = engine.decide({
      id: "decision_req_delete_branch",
      goalId: "goal_repo_cleanup",
      action: "Delete an unmerged repository branch",
      actionType: "repository_change",
      rationale: "The branch appears stale.",
      reversibility: "irreversible",
      externalImpacts: ["destructive_action"],
      risks: [
        {
          kind: "data_loss",
          severity: "high",
          description: "The branch may contain unmerged work."
        }
      ],
      alternatives: [
        {
          action: "Archive the branch after confirming merge status",
          reason: "Preserves history while reducing clutter.",
          safetyGain: "high"
        }
      ],
      evidenceRefs: ["git:branch_scan"],
      requesterIdentityId: "identity:user",
      authorityMode: "broad"
    });

    expect(outcome.type).toBe("discuss");
    expect(outcome.suggestedAlternative?.action).toBe(
      "Archive the branch after confirming merge status"
    );
    expect(outcome.discussionPoints).toContain(
      "This action is irreversible or destructive."
    );
  });

  it("requires simulation before production-impacting actions", () => {
    const outcome = engine.decide({
      id: "decision_req_prod_change",
      goalId: "goal_deploy",
      action: "Modify production infrastructure",
      actionType: "infrastructure_change",
      rationale: "Production capacity needs to be updated.",
      reversibility: "partially_reversible",
      externalImpacts: ["production_system"],
      risks: [
        {
          kind: "service_disruption",
          severity: "critical",
          description: "A bad change may affect production availability."
        }
      ],
      alternatives: [],
      evidenceRefs: ["deployment:plan"],
      requesterIdentityId: "identity:user",
      authorityMode: "broad"
    });

    expect(outcome).toMatchObject({
      type: "simulate_first",
      auditSeverity: "high",
      simulationRequirement:
        "Simulate the action, produce expected effects, rollback path, and verification checks before execution."
    });
  });

  it("rejects illegal or explicitly forbidden actions", () => {
    const outcome = engine.decide({
      id: "decision_req_forbidden",
      goalId: "goal_unknown",
      action: "Bypass access controls",
      actionType: "security_bypass",
      rationale: "The system is blocked.",
      reversibility: "irreversible",
      externalImpacts: ["legal_commitment"],
      risks: [
        {
          kind: "policy_violation",
          severity: "critical",
          description: "The action bypasses access controls.",
          requiresRejection: true
        }
      ],
      alternatives: [],
      evidenceRefs: ["policy:access_control"],
      requesterIdentityId: "identity:user",
      authorityMode: "broad"
    });

    expect(outcome.type).toBe("reject");
    expect(outcome.auditSeverity).toBe("critical");
  });

  it("rejects blocking Memory rejection risks with the Memory reason", () => {
    const outcome = engine.decide({
      id: "decision_req_memory_reconsideration",
      goalId: "goal_unknown_system",
      action: "Create a billing resource",
      actionType: "capability_execution",
      rationale:
        "The user asked Atlas to create the resource. Memory rejected the prior decision.",
      reversibility: "reversible",
      externalImpacts: [],
      risks: [
        {
          kind: "memory_rejection",
          severity: "high",
          description:
            "A previous execution created duplicate billing resources for this provider.",
          requiresRejection: true
        }
      ],
      alternatives: [],
      evidenceRefs: [
        "knowledge:openapi:create-resource",
        "memory:event:failure:duplicate-billing-resource"
      ],
      requesterIdentityId: "identity:user",
      authorityMode: "broad"
    });

    expect(outcome.type).toBe("reject");
    expect(outcome.rationale).toBe(
      "Memory rejected this action: A previous execution created duplicate billing resources for this provider."
    );
    expect(outcome.evidenceRefs).toContain(
      "memory:event:failure:duplicate-billing-resource"
    );
  });

  it("delegates human-only actions", () => {
    const outcome = engine.decide({
      id: "decision_req_human",
      goalId: "goal_contract",
      action: "Sign a legal contract",
      actionType: "legal_commitment",
      rationale: "The contract needs signature.",
      reversibility: "irreversible",
      externalImpacts: ["legal_commitment"],
      risks: [],
      alternatives: [],
      evidenceRefs: ["document:contract"],
      requesterIdentityId: "identity:user",
      authorityMode: "broad",
      humanRequired: true
    });

    expect(outcome.type).toBe("delegate_to_human");
    expect(outcome.approvalRequired).toBe(true);
  });
});
