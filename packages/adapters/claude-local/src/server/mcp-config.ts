import fs from "node:fs/promises";
import path from "node:path";
import { resolveApprovedMcpServers, type ApprovedMcpStdioServer } from "@paperclipai/adapter-utils/approved-mcp";

export interface PreparedClaudeMcpConfig {
  servers: ApprovedMcpStdioServer[];
  notes: string[];
  dir: string | null;
  path: string | null;
}

export function buildClaudeMcpConfigJson(servers: ApprovedMcpStdioServer[]): string {
  return JSON.stringify(
    {
      mcpServers: Object.fromEntries(
        servers.map((server) => [
          server.name,
          {
            command: server.command,
            args: server.args,
          },
        ]),
      ),
    },
    null,
    2,
  ) + "\n";
}

export async function prepareClaudeMcpConfig(input: {
  env: Record<string, string>;
  rootDir: string;
}): Promise<PreparedClaudeMcpConfig> {
  const approvedMcp = resolveApprovedMcpServers({ env: input.env });
  if (approvedMcp.servers.length === 0) {
    return {
      servers: [],
      notes: approvedMcp.notes,
      dir: null,
      path: null,
    };
  }

  const dir = path.join(input.rootDir, ".paperclip", "mcp");
  const mcpConfigPath = path.join(dir, "mcp.json");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(mcpConfigPath, buildClaudeMcpConfigJson(approvedMcp.servers), "utf8");

  return {
    servers: approvedMcp.servers,
    notes: [
      ...approvedMcp.notes,
      `Generated approved Claude MCP config at "${mcpConfigPath}": ${approvedMcp.servers.map((server) => server.name).join(", ")}.`,
    ],
    dir,
    path: mcpConfigPath,
  };
}
