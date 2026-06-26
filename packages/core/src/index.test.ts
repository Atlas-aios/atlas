import { describe, expect, it } from "vitest";
import { fail, ok } from "./index.js";

describe("result helpers", () => {
  it("wraps successful values", () => {
    expect(ok({ id: "goal_1" })).toEqual({
      ok: true,
      value: { id: "goal_1" }
    });
  });

  it("wraps failures with stable code and message fields", () => {
    expect(fail("governance.blocked", "Approval is required")).toEqual({
      ok: false,
      error: {
        code: "governance.blocked",
        message: "Approval is required"
      }
    });
  });
});
