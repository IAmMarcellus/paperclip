import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildClaudeMcpConfigJson, prepareClaudeMcpConfig } from "./mcp-config.js";

const cleanupPaths = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...cleanupPaths].map(async (filepath) => {
      cleanupPaths.delete(filepath);
      await fs.rm(filepath, { recursive: true, force: true });
    }),
  );
});

async function makeRootDir(): Promise<string> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-claude-mcp-"));
  cleanupPaths.add(rootDir);
  return rootDir;
}

describe("buildClaudeMcpConfigJson", () => {
  it("emits Claude mcpServers JSON for approved stdio servers", () => {
    expect(
      JSON.parse(
        buildClaudeMcpConfigJson([
          {
            name: "playwright",
            transport: "stdio",
            command: "npx",
            args: ["-y", "@playwright/mcp@latest"],
          },
        ]),
      ),
    ).toEqual({
      mcpServers: {
        playwright: {
          command: "npx",
          args: ["-y", "@playwright/mcp@latest"],
        },
      },
    });
  });
});

describe("prepareClaudeMcpConfig", () => {
  it("writes the default playwright MCP config", async () => {
    const rootDir = await makeRootDir();
    const prepared = await prepareClaudeMcpConfig({ env: {}, rootDir });

    expect(prepared.path).toBe(path.join(rootDir, ".paperclip", "mcp", "mcp.json"));
    expect(prepared.servers.map((server) => server.name)).toEqual(["playwright"]);
    expect(JSON.parse(await fs.readFile(prepared.path!, "utf8"))).toEqual({
      mcpServers: {
        playwright: {
          command: "npx",
          args: ["-y", "@playwright/mcp@latest"],
        },
      },
    });
  });

  it("omits the generated config when disabled", async () => {
    const rootDir = await makeRootDir();
    const prepared = await prepareClaudeMcpConfig({
      env: { PAPERCLIP_APPROVED_MCP_SERVERS: "none" },
      rootDir,
    });

    expect(prepared.servers).toEqual([]);
    expect(prepared.path).toBeNull();
    await expect(fs.access(path.join(rootDir, ".paperclip", "mcp", "mcp.json"))).rejects.toThrow();
  });
});
