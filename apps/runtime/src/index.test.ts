import { describe, expect, it } from "vitest";

import { createAtlasRuntime } from "./index.js";

describe("Atlas runtime API", () => {
  it("reports local runtime health", async () => {
    const runtime = createAtlasRuntime();

    const response = await runtime.handle(
      new Request("http://atlas.local/health", { method: "GET" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "atlas-runtime",
      status: "ok"
    });
  });

  it("runs the unknown business system learn-and-execute MVP flow", async () => {
    const runtime = createAtlasRuntime();

    const response = await runtime.handle(
      new Request("http://atlas.local/mvp/unknown-business/learn-and-execute", {
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scenario: "Create Resource",
      learnedCapabilities: [
        "capability:create-folio",
        "capability:allocate-settlement",
        "capability:dispatch-work-packet"
      ],
      providerCandidates: [
        "provider:openapi:create-folio",
        "provider:openapi:allocate-settlement",
        "provider:openapi:dispatch-work-packet"
      ],
      browserCapabilities: [
        "capability:create-folio",
        "capability:allocate-settlement",
        "capability:dispatch-work-packet"
      ],
      benchmark: {
        id: "benchmark:unknown-business:create-resource",
        passed: true,
        evidence: [
          "fixture:rest:POST /folios",
          "fixture:rest:POST /settlements/allocate",
          "fixture:rest:POST /work-packets/dispatch"
        ]
      }
    });
  });
});
