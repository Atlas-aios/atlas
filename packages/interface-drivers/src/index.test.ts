import { describe, expect, it } from "vitest";

import { createRestInterfaceDriver } from "./index.js";

describe("REST Interface Driver", () => {
  it("executes REST requests through an injected transport", async () => {
    const calls: unknown[] = [];
    const driver = createRestInterfaceDriver({
      transport: async (request) => {
        calls.push(request);
        return {
          status: 201,
          headers: { "content-type": "application/json" },
          body: { id: "resource:invoice" }
        };
      }
    });

    const result = await driver.execute({
      operationId: "create-resource",
      method: "POST",
      url: "https://unknown.example/resources",
      headers: { authorization: "Bearer test" },
      body: { name: "invoice" },
      requiredPermissions: ["network:unknown-system"],
      grantedPermissions: ["network:unknown-system"]
    });

    expect(calls).toHaveLength(1);
    expect(result).toEqual({
      status: "completed",
      response: {
        status: 201,
        headers: { "content-type": "application/json" },
        body: { id: "resource:invoice" }
      },
      events: [
        {
          type: "interface-driver.request.started",
          driverId: "driver:rest",
          operationId: "create-resource"
        },
        {
          type: "interface-driver.request.completed",
          driverId: "driver:rest",
          operationId: "create-resource"
        }
      ]
    });
  });

  it("simulates REST requests without calling the transport", async () => {
    let callCount = 0;
    const driver = createRestInterfaceDriver({
      transport: async () => {
        callCount += 1;
        return { status: 200, headers: {}, body: {} };
      }
    });

    const result = await driver.execute({
      operationId: "create-resource",
      method: "POST",
      url: "https://unknown.example/resources",
      body: { name: "invoice" },
      requiredPermissions: ["network:unknown-system"],
      grantedPermissions: ["network:unknown-system"],
      simulation: true
    });

    expect(callCount).toBe(0);
    expect(result).toMatchObject({
      status: "simulated",
      requestPreview: {
        method: "POST",
        url: "https://unknown.example/resources",
        body: { name: "invoice" }
      },
      events: [
        {
          type: "interface-driver.request.started"
        },
        {
          type: "interface-driver.request.simulated"
        }
      ]
    });
  });

  it("blocks REST execution when permissions are missing", async () => {
    let callCount = 0;
    const driver = createRestInterfaceDriver({
      transport: async () => {
        callCount += 1;
        return { status: 200, headers: {}, body: {} };
      }
    });

    const result = await driver.execute({
      operationId: "create-resource",
      method: "POST",
      url: "https://unknown.example/resources",
      body: { name: "invoice" },
      requiredPermissions: ["network:unknown-system"],
      grantedPermissions: []
    });

    expect(callCount).toBe(0);
    expect(result).toMatchObject({
      status: "blocked",
      error: "Missing driver permissions: network:unknown-system",
      events: [
        {
          type: "interface-driver.request.started"
        },
        {
          type: "interface-driver.request.blocked"
        }
      ]
    });
  });
});
