import { describe, expect, it } from "vitest";
import { resolveApprovedMcpServers } from "./approved-mcp.js";

describe("resolveApprovedMcpServers", () => {
  it("defaults to playwright when unset", () => {
    expect(resolveApprovedMcpServers({ processEnv: {} })).toEqual({
      servers: [
        {
          name: "playwright",
          transport: "stdio",
          command: "npx",
          args: ["-y", "@playwright/mcp@latest"],
        },
      ],
      notes: [],
    });
  });

  it("disables approved MCP sync with none, false, or off", () => {
    for (const value of ["none", "false", "off", " OFF "]) {
      expect(
        resolveApprovedMcpServers({
          env: { PAPERCLIP_APPROVED_MCP_SERVERS: value },
          processEnv: {},
        }),
      ).toEqual({ servers: [], notes: [] });
    }
  });

  it("selects approved names from a comma list and de-duplicates them", () => {
    const resolved = resolveApprovedMcpServers({
      env: { PAPERCLIP_APPROVED_MCP_SERVERS: "playwright, playwright" },
      processEnv: {},
    });

    expect(resolved.servers.map((server) => server.name)).toEqual(["playwright"]);
    expect(resolved.notes).toEqual([]);
  });

  it("skips unknown names with a note", () => {
    const resolved = resolveApprovedMcpServers({
      env: { PAPERCLIP_APPROVED_MCP_SERVERS: "playwright,unknown,bad" },
      processEnv: {},
    });

    expect(resolved.servers.map((server) => server.name)).toEqual(["playwright"]);
    expect(resolved.notes).toEqual([
      "Warning: PAPERCLIP_APPROVED_MCP_SERVERS unknown approved MCP server(s) skipped: unknown, bad.",
    ]);
  });

  it("lets adapter env override process env", () => {
    const resolved = resolveApprovedMcpServers({
      env: { PAPERCLIP_APPROVED_MCP_SERVERS: "none" },
      processEnv: { PAPERCLIP_APPROVED_MCP_SERVERS: "playwright" },
    });

    expect(resolved).toEqual({ servers: [], notes: [] });
  });
});
