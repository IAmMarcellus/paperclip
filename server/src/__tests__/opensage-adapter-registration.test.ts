import { describe, expect, it, vi } from "vitest";

// The registry imports the external hermes adapter at module load; mock it (as
// adapter-registry.test.ts does) so the barrel import resolves without the package.
vi.mock("hermes-paperclip-adapter/server", () => ({
  execute: vi.fn(async () => ({ exitCode: 0, signal: null, timedOut: false })),
  testEnvironment: async () => ({
    adapterType: "hermes_local",
    status: "pass",
    checks: [],
    testedAt: new Date(0).toISOString(),
  }),
  sessionCodec: null,
  listSkills: async () => [],
  syncSkills: async () => ({ entries: [] }),
  detectModel: async () => null,
}));

import { findServerAdapter, listServerAdapters, requireServerAdapter } from "../adapters/index.js";
import { BUILTIN_ADAPTER_TYPES } from "../adapters/builtin-adapter-types.js";

describe("opensage adapter registration", () => {
  it("is registered as a built-in server adapter", () => {
    expect(findServerAdapter("opensage")).toBeTruthy();
    expect(listServerAdapters().some((a) => a.type === "opensage")).toBe(true);
    expect(BUILTIN_ADAPTER_TYPES.has("opensage")).toBe(true);
  });

  it("exposes a session codec and a config schema with the expected fields", async () => {
    const adapter = requireServerAdapter("opensage");
    expect(adapter.type).toBe("opensage");
    expect(adapter.sessionCodec).toBeDefined();

    const { getConfigSchema } = adapter;
    expect(getConfigSchema).toBeDefined();
    if (!getConfigSchema) return;
    const schema = await getConfigSchema();
    const keys = schema.fields.map((f) => f.key);
    expect(keys).toEqual(
      expect.arrayContaining(["baseUrl", "appName", "promptTemplate", "timeoutSec"]),
    );
  });
});
