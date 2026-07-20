import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createFileRuntimePersistence } from "./index.js";
import { startAtlasRuntimeServer } from "./server.js";

export interface AtlasRuntimeE2EDemoResult {
  serverUrl: string;
  goalId: string;
  learnedCapabilityCount: number;
  workflowId: string;
  thoughtId: string;
  simulationId: string;
  simulationStatus: string;
  executionStatus: string;
  approvalStatus: string;
  browserObservationMatched: boolean;
  worldStateGoalCount: number;
}

const demoIdentityId = "identity:user:moksh";
const demoApiKey = "atlas-local-demo-key";

export async function runAtlasRuntimeE2EDemo(): Promise<AtlasRuntimeE2EDemoResult> {
  const workspace = mkdtempSync(join(tmpdir(), "atlas-e2e-demo-"));
  const statePath = join(workspace, "runtime-state.json");
  const server = await startAtlasRuntimeServer({
    port: 0,
    runtime: {
      auth: {
        apiKey: demoApiKey,
        requireIdentity: true
      },
      persistence: createFileRuntimePersistence(statePath)
    }
  });

  try {
    const headers = {
      authorization: `Bearer ${demoApiKey}`,
      "content-type": "application/json",
      "x-atlas-identity-id": demoIdentityId
    };
    const goalId = "goal:e2e:create-resource";

    await postJson(server.url, "/goals", headers, {
      id: goalId,
      title: "Learn and create a resource in an unknown business system",
      description:
        "Demonstrate the Atlas loop from goal creation through learning, decision, approval, execution, and observation.",
      ownerId: demoIdentityId,
      priority: 95,
      successCriteria: ["Create Resource is completed or safely blocked."],
      createdAt: "2026-07-17T09:00:00.000Z"
    });
    await postJson(server.url, `/goals/${encodeURIComponent(goalId)}/status`, headers, {
      eventId: `${goalId}:event:active`,
      toStatus: "active",
      occurredAt: "2026-07-17T09:01:00.000Z",
      reason: "Start the MVP execution loop."
    });

    const learning = await postJson<{
      learnedCapabilities: string[];
    }>(server.url, "/mvp/unknown-business/learn-and-execute", headers, {});

    await postJson(server.url, "/workflows", headers, {
      id: "workflow:e2e:create-resource",
      version: "0.1",
      nodes: [
        {
          id: "node:create-folio",
          type: "capability",
          inputs: {
            capabilityId: "capability:create-folio"
          }
        }
      ],
      edges: []
    });
    await postJson(server.url, "/thoughts", headers, {
      id: "thought:e2e:provider-choice",
      kind: "decision_rationale",
      goalId,
      summary:
        "Atlas learned the unknown interface, selected the REST provider for deterministic execution, and kept browser UI observation as fallback evidence.",
      evidenceRefs: ["capability:create-folio", "provider:openapi:create-folio"],
      createdAt: "2026-07-17T09:02:00.000Z"
    });

    const simulation = await postJson<{
      simulation: {
        id: string;
        status: string;
      };
    }>(server.url, "/simulations", headers, {
      id: "simulation:e2e:create-folio",
      goalId,
      capabilityId: "capability:create-folio",
      providerId: "provider:openapi:create-folio",
      inputs: {
        name: "E2E folio"
      },
      predictedWorldStateEffects: [
        {
          type: "add_active_execution",
          executionId: "execution:e2e:create-folio"
        }
      ],
      createdAt: "2026-07-17T09:03:00.000Z"
    });

    const dispatch = await postJson<{
      execution: {
        status: string;
      };
      approvalRequest?: {
        id: string;
      };
    }>(
      server.url,
      `/goals/${encodeURIComponent(goalId)}/capabilities/${encodeURIComponent(
        "capability:create-folio"
      )}/dispatch`,
      headers,
      {
        executionId: "execution:e2e:create-folio",
        inputs: {
          name: "E2E folio"
        },
        governanceContextId: "governance:e2e",
        startedAt: "2026-07-17T09:04:00.000Z"
      }
    );
    let approvalStatus = "not_required";

    if (dispatch.approvalRequest !== undefined) {
      const approval = await postJson<{
        approvalRequest: {
          status: string;
        };
      }>(
        server.url,
        `/approvals/${encodeURIComponent(dispatch.approvalRequest.id)}/approve`,
        headers,
        {
          decidedBy: demoIdentityId,
          decidedAt: "2026-07-17T09:05:00.000Z",
          reason: "Approved E2E demo provider execution."
        }
      );
      approvalStatus = approval.approvalRequest.status;
    }

    const observation = await postJson<{
      result: {
        output?: {
          matched?: boolean;
        };
      };
    }>(server.url, "/interface-drivers/browser-ui/execute", headers, {
      operationId: "observe-create-folio-form",
      action: "read",
      selector: '[data-atlas-capability="capability:create-folio"]',
      requiredPermissions: ["browser_ui:read"],
      grantedPermissions: ["browser_ui:read"]
    });
    const worldState = await getJson<{
      worldState: {
        activeGoalIds: string[];
      };
    }>(server.url, "/world-state?capturedAt=2026-07-17T09%3A07%3A00.000Z", headers);

    await postJson(
      server.url,
      `/goals/${encodeURIComponent(
        goalId
      )}/completion-criteria/${encodeURIComponent(`${goalId}:criterion:1`)}/satisfy`,
      headers,
      {
        eventId: `${goalId}:event:criterion-satisfied`,
        evidenceRef: "execution:e2e:create-folio",
        occurredAt: "2026-07-17T09:08:00.000Z"
      }
    );

    return {
      serverUrl: server.url,
      goalId,
      learnedCapabilityCount: learning.learnedCapabilities.length,
      workflowId: "workflow:e2e:create-resource",
      thoughtId: "thought:e2e:provider-choice",
      simulationId: simulation.simulation.id,
      simulationStatus: simulation.simulation.status,
      executionStatus: dispatch.execution.status,
      approvalStatus,
      browserObservationMatched: observation.result.output?.matched === true,
      worldStateGoalCount: worldState.worldState.activeGoalIds.length
    };
  } finally {
    await server.close();
    rmSync(workspace, { recursive: true, force: true });
  }
}

async function postJson<T = unknown>(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
  body: unknown
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`POST ${path} failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getJson<T>(
  baseUrl: string,
  path: string,
  headers: Record<string, string>
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { headers });

  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await runAtlasRuntimeE2EDemo(), null, 2));
}
