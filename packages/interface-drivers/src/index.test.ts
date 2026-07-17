import { describe, expect, it } from "vitest";

import {
  createBrowserUiInterfaceDriver,
  createRestInterfaceDriver,
  ingestOpenApiDocument
} from "./index.js";

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

describe("OpenAPI ingestion", () => {
  it("extracts draft capabilities and REST driver mappings from an unknown API", () => {
    const result = ingestOpenApiDocument({
      graphId: "capability-graph:unknown-api",
      generatedAt: "2026-07-16T14:00:00.000Z",
      document: {
        openapi: "3.1.0",
        info: {
          title: "Unknown Business API",
          version: "1.0.0"
        },
        paths: {
          "/invoices": {
            get: {
              operationId: "listInvoices",
              summary: "List invoices"
            },
            post: {
              operationId: "createInvoice",
              summary: "Create invoice"
            }
          },
          "/invoices/{invoiceId}": {
            patch: {
              operationId: "updateInvoice",
              summary: "Update invoice"
            }
          }
        }
      }
    });

    expect(result.graph).toEqual({
      id: "capability-graph:unknown-api",
      schemaVersion: "0.1",
      status: "draft",
      generatedAt: "2026-07-16T14:00:00.000Z",
      nodes: [
        {
          id: "capability:list-invoices",
          schemaVersion: "0.1",
          name: "List invoices",
          level: "L2",
          confidence: 0.74,
          sourceRefs: ["openapi:GET /invoices"]
        },
        {
          id: "capability:create-invoice",
          schemaVersion: "0.1",
          name: "Create invoice",
          level: "L2",
          confidence: 0.8,
          sourceRefs: ["openapi:POST /invoices"]
        },
        {
          id: "capability:update-invoice",
          schemaVersion: "0.1",
          name: "Update invoice",
          level: "L2",
          confidence: 0.8,
          sourceRefs: ["openapi:PATCH /invoices/{invoiceId}"]
        }
      ],
      edges: []
    });
    expect(result.driverMappings).toEqual([
      {
        capabilityId: "capability:list-invoices",
        driverId: "driver:rest",
        operationId: "listInvoices",
        method: "GET",
        path: "/invoices",
        requiredPermissions: ["network"]
      },
      {
        capabilityId: "capability:create-invoice",
        driverId: "driver:rest",
        operationId: "createInvoice",
        method: "POST",
        path: "/invoices",
        requiredPermissions: ["network"]
      },
      {
        capabilityId: "capability:update-invoice",
        driverId: "driver:rest",
        operationId: "updateInvoice",
        method: "PATCH",
        path: "/invoices/{invoiceId}",
        requiredPermissions: ["network"]
      }
    ]);
  });
});

describe("Browser UI Interface Driver", () => {
  it("executes browser UI actions through an injected surface", async () => {
    const actions: unknown[] = [];
    const driver = createBrowserUiInterfaceDriver({
      surface: {
        click: async (selector) => {
          actions.push({ action: "click", selector });
          return { clicked: selector };
        },
        fill: async (selector, value) => {
          actions.push({ action: "fill", selector, value });
          return { filled: selector, value };
        },
        read: async (selector) => {
          actions.push({ action: "read", selector });
          return { text: "Create folio" };
        }
      }
    });

    const result = await driver.execute({
      operationId: "read-create-folio-button",
      action: "read",
      selector: "[data-atlas-action='submit']",
      requiredPermissions: ["browser_ui:read"],
      grantedPermissions: ["browser_ui:read"]
    });

    expect(actions).toEqual([
      { action: "read", selector: "[data-atlas-action='submit']" }
    ]);
    expect(result).toEqual({
      status: "completed",
      output: { text: "Create folio" },
      events: [
        {
          type: "interface-driver.request.started",
          driverId: "driver:browser-ui",
          operationId: "read-create-folio-button"
        },
        {
          type: "interface-driver.request.completed",
          driverId: "driver:browser-ui",
          operationId: "read-create-folio-button"
        }
      ]
    });
  });

  it("simulates browser UI actions without touching the surface", async () => {
    let callCount = 0;
    const driver = createBrowserUiInterfaceDriver({
      surface: {
        click: async () => {
          callCount += 1;
          return {};
        },
        fill: async () => {
          callCount += 1;
          return {};
        },
        read: async () => {
          callCount += 1;
          return {};
        }
      }
    });

    const result = await driver.execute({
      operationId: "fill-folio-name",
      action: "fill",
      selector: "[data-atlas-field='folio.name']",
      value: "Runtime folio",
      requiredPermissions: ["browser_ui:write"],
      grantedPermissions: ["browser_ui:write"],
      simulation: true
    });

    expect(callCount).toBe(0);
    expect(result).toEqual({
      status: "simulated",
      requestPreview: {
        action: "fill",
        selector: "[data-atlas-field='folio.name']",
        value: "Runtime folio"
      },
      events: [
        {
          type: "interface-driver.request.started",
          driverId: "driver:browser-ui",
          operationId: "fill-folio-name"
        },
        {
          type: "interface-driver.request.simulated",
          driverId: "driver:browser-ui",
          operationId: "fill-folio-name"
        }
      ]
    });
  });

  it("blocks browser UI control when permissions are missing", async () => {
    let callCount = 0;
    const driver = createBrowserUiInterfaceDriver({
      surface: {
        click: async () => {
          callCount += 1;
          return {};
        },
        fill: async () => {
          callCount += 1;
          return {};
        },
        read: async () => {
          callCount += 1;
          return {};
        }
      }
    });

    const result = await driver.execute({
      operationId: "click-create-folio",
      action: "click",
      selector: "[data-atlas-action='submit']",
      requiredPermissions: ["browser_ui:write"],
      grantedPermissions: []
    });

    expect(callCount).toBe(0);
    expect(result).toMatchObject({
      status: "blocked",
      error: "Missing driver permissions: browser_ui:write",
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
