import { describe, expect, it } from "vitest";

import { startAtlasRuntimeServer } from "./server.js";

describe("Atlas runtime server", () => {
  it("serves the runtime API over local HTTP", async () => {
    const server = await startAtlasRuntimeServer({ port: 0 });

    try {
      const response = await fetch(`${server.url}/health`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        service: "atlas-runtime",
        status: "ok"
      });
    } finally {
      await server.close();
    }
  });
});
