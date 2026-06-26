import { describe, expect, it } from "vitest";
import { createLogger, createRuntimeConfig } from "./index.js";

describe("runtime config", () => {
  it("uses development defaults when optional environment values are missing", () => {
    expect(createRuntimeConfig({})).toEqual({
      env: "development",
      logLevel: "info"
    });
  });

  it("reads explicit Atlas environment values", () => {
    expect(
      createRuntimeConfig({
        ATLAS_ENV: "test",
        ATLAS_LOG_LEVEL: "debug"
      })
    ).toEqual({
      env: "test",
      logLevel: "debug"
    });
  });
});

describe("logger", () => {
  it("emits structured records through the provided sink", () => {
    const records: unknown[] = [];
    const logger = createLogger({
      level: "info",
      sink: (record) => records.push(record)
    });

    logger.info("Capability resolved", { capabilityId: "cap_create_resource" });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      level: "info",
      message: "Capability resolved",
      context: { capabilityId: "cap_create_resource" }
    });
  });
});
