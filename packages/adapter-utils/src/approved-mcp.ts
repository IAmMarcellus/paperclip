export type ApprovedMcpServerName = "playwright";

export interface ApprovedMcpStdioServer {
  name: ApprovedMcpServerName;
  transport: "stdio";
  command: string;
  args: string[];
}

export interface ResolvedApprovedMcpServers {
  servers: ApprovedMcpStdioServer[];
  notes: string[];
}

const APPROVED_MCP_REGISTRY: Record<ApprovedMcpServerName, ApprovedMcpStdioServer> = {
  playwright: {
    name: "playwright",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@playwright/mcp@latest"],
  },
};

const DEFAULT_APPROVED_MCP_SERVER_NAMES: ApprovedMcpServerName[] = ["playwright"];
const DISABLED_APPROVED_MCP_VALUES = new Set(["none", "false", "off"]);

function readSelectionValue(input: {
  env?: Record<string, string | undefined>;
  processEnv?: Record<string, string | undefined>;
}): string | null {
  if (typeof input.env?.PAPERCLIP_APPROVED_MCP_SERVERS === "string") {
    return input.env.PAPERCLIP_APPROVED_MCP_SERVERS;
  }
  if (typeof input.processEnv?.PAPERCLIP_APPROVED_MCP_SERVERS === "string") {
    return input.processEnv.PAPERCLIP_APPROVED_MCP_SERVERS;
  }
  return null;
}

export function resolveApprovedMcpServers(input: {
  env?: Record<string, string | undefined>;
  processEnv?: Record<string, string | undefined>;
} = {}): ResolvedApprovedMcpServers {
  const raw = readSelectionValue({
    env: input.env,
    processEnv: input.processEnv ?? process.env,
  });
  const trimmed = raw?.trim() ?? "";
  const requestedNames =
    trimmed.length === 0
      ? DEFAULT_APPROVED_MCP_SERVER_NAMES
      : DISABLED_APPROVED_MCP_VALUES.has(trimmed.toLowerCase())
        ? []
        : trimmed
          .split(",")
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean);

  const servers: ApprovedMcpStdioServer[] = [];
  const unknownNames: string[] = [];
  const seen = new Set<string>();
  for (const name of requestedNames) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (name in APPROVED_MCP_REGISTRY) {
      const server = APPROVED_MCP_REGISTRY[name as ApprovedMcpServerName];
      servers.push({ ...server, args: [...server.args] });
    } else {
      unknownNames.push(name);
    }
  }

  const notes =
    unknownNames.length > 0
      ? [
          `Warning: PAPERCLIP_APPROVED_MCP_SERVERS unknown approved MCP server(s) skipped: ${unknownNames.join(", ")}.`,
        ]
      : [];
  return { servers, notes };
}
