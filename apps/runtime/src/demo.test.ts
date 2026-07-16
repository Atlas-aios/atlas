import { describe, expect, it } from "vitest";

import { runUnknownBusinessMvpDemo } from "./demo.js";

describe("Atlas runtime MVP demo", () => {
  it("runs the unknown business goal flow end to end", async () => {
    const result = await runUnknownBusinessMvpDemo();

    expect(result.goal).toMatchObject({
      id: "goal:runtime-create-resource",
      status: "completed"
    });
    expect(result.dispatch.execution.status).toBe("completed");
    expect(result.approvalRequest).toMatchObject({
      id: "approval:runtime:execution:runtime:create-folio",
      status: "approved"
    });
    expect(result.timeline.events.map((event) => event.type)).toEqual([
      "goal.created",
      "goal.status_changed",
      "goal.completion_criterion_satisfied",
      "goal.status_changed",
      "execution.session.started",
      "execution.step.started",
      "execution.step.completed",
      "execution.session.completed"
    ]);
  });
});
