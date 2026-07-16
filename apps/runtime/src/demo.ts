import { pathToFileURL } from "node:url";

import { createAtlasRuntime } from "./index.js";
import type {
  DispatchGoalScopedRuntimeCapabilityResponse,
  RuntimeApprovalRequest,
  RuntimeGoalListItem,
  RuntimeGoalTimelineResponse,
  UnknownBusinessMvpResponse
} from "./index.js";

export interface UnknownBusinessMvpDemoResult {
  learning: UnknownBusinessMvpResponse;
  goal: RuntimeGoalListItem;
  dispatch: DispatchGoalScopedRuntimeCapabilityResponse;
  approvalRequest: RuntimeApprovalRequest;
  timeline: RuntimeGoalTimelineResponse;
}

export async function runUnknownBusinessMvpDemo(): Promise<UnknownBusinessMvpDemoResult> {
  const runtime = createAtlasRuntime();

  await postJson(runtime, "/goals", {
    id: "goal:runtime-create-resource",
    title: "Create Resource in unknown business system",
    description: "Learn the interface and execute the resource workflow.",
    ownerId: "identity:user:moksh",
    priority: 95,
    successCriteria: ["Create Resource is completed or safely blocked."],
    createdAt: "2026-07-16T12:00:00.000Z"
  });

  const learning = await postJson<UnknownBusinessMvpResponse>(
    runtime,
    "/mvp/unknown-business/learn-and-execute",
    {}
  );

  await postJson(runtime, "/goals/goal:runtime-create-resource/status", {
    eventId: "goal:runtime-create-resource:event:activated",
    toStatus: "active",
    occurredAt: "2026-07-16T12:05:00.000Z",
    reason: "Begin learning and execution."
  });

  const dispatch = await postJson<DispatchGoalScopedRuntimeCapabilityResponse>(
    runtime,
    "/goals/goal:runtime-create-resource/capabilities/capability:create-folio/dispatch",
    {
      executionId: "execution:runtime:create-folio",
      inputs: {
        name: "Atlas MVP folio"
      },
      governanceContextId: "governance:runtime:mvp",
      startedAt: "2026-07-16T12:30:00.000Z"
    }
  );

  if (dispatch.approvalRequest === undefined) {
    throw new Error("MVP demo expected dispatch to create an approval request.");
  }

  const approvalDecision = await postJson<{ approvalRequest: RuntimeApprovalRequest }>(
    runtime,
    "/approval-requests/approval:runtime:execution:runtime:create-folio/approve",
    {
      decidedBy: "identity:user:moksh",
      decidedAt: "2026-07-16T12:35:00.000Z",
      reason: "Approved for MVP fixture execution."
    }
  );

  await postJson(
    runtime,
    "/goals/goal:runtime-create-resource/completion-criteria/goal:runtime-create-resource:criterion:1/satisfy",
    {
      eventId: "goal:runtime-create-resource:event:criterion-1-satisfied",
      evidenceRef: "execution:runtime:create-folio",
      occurredAt: "2026-07-16T12:40:00.000Z"
    }
  );

  const goalDetail = await getJson<{ goal: RuntimeGoalListItem }>(
    runtime,
    "/goals/goal:runtime-create-resource"
  );
  const timeline = await getJson<RuntimeGoalTimelineResponse>(
    runtime,
    "/goals/goal:runtime-create-resource/timeline"
  );

  return {
    learning,
    goal: goalDetail.goal,
    dispatch,
    approvalRequest: approvalDecision.approvalRequest,
    timeline
  };
}

export async function printUnknownBusinessMvpDemo(): Promise<void> {
  const result = await runUnknownBusinessMvpDemo();

  console.log(JSON.stringify(result, null, 2));
}

async function getJson<TBody>(
  runtime: { handle(request: Request): Promise<Response> },
  path: string
): Promise<TBody> {
  const response = await runtime.handle(
    new Request(`http://atlas.local${path}`, { method: "GET" })
  );

  return readJson<TBody>(response);
}

async function postJson<TBody>(
  runtime: { handle(request: Request): Promise<Response> },
  path: string,
  body: Record<string, unknown>
): Promise<TBody> {
  const response = await runtime.handle(
    new Request(`http://atlas.local${path}`, {
      method: "POST",
      body: JSON.stringify(body)
    })
  );

  return readJson<TBody>(response);
}

async function readJson<TBody>(response: Response): Promise<TBody> {
  const body = (await response.json()) as TBody;

  if (!response.ok) {
    throw new Error(
      `Runtime request failed with ${response.status}: ${JSON.stringify(body)}`
    );
  }

  return body;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  printUnknownBusinessMvpDemo().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
