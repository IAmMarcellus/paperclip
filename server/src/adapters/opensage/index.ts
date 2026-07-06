import type { AdapterConfigSchema, AdapterSessionCodec, ServerAdapterModule } from "../types.js";
import {
  DEFAULT_OPENSAGE_APP_NAME,
  DEFAULT_OPENSAGE_BASE_URL,
  DEFAULT_OPENSAGE_TIMEOUT_SEC,
  DEFAULT_PAPERCLIP_BASE_URL,
} from "./constants.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

function parseSessionId(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = (raw as Record<string, unknown>).sessionId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Persist only the OpenSage session id so a Paperclip agent maps to one durable,
 * resumable OpenSage conversation thread across heartbeats.
 */
export const openSageSessionCodec: AdapterSessionCodec = {
  deserialize(raw) {
    const sessionId = parseSessionId(raw);
    return sessionId ? { sessionId } : null;
  },
  serialize(params) {
    const sessionId = parseSessionId(params);
    return sessionId ? { sessionId } : null;
  },
  getDisplayId(params) {
    return parseSessionId(params);
  },
};

const configSchema: AdapterConfigSchema = {
  fields: [
    {
      key: "baseUrl",
      label: "OpenSage base URL",
      type: "text",
      default: DEFAULT_OPENSAGE_BASE_URL,
      hint: "The `opensage web` server (mergatriod: make opensage).",
    },
    {
      key: "appName",
      label: "App name",
      type: "text",
      hint: "Leave blank to auto-detect from the server's /list-apps. OpenSage's ADK app name = the parent folder of its --agent path.",
    },
    {
      key: "promptTemplate",
      label: "Prompt template (optional)",
      type: "textarea",
      hint: "Overrides the task body only (the wake payload, latest comment, and workspace path are still included). Substitutions: {{taskTitle}}, {{taskDescription}}, {{taskMarkdown}}, {{cwd}}, {{wakeReason}}.",
    },
    {
      key: "timeoutSec",
      label: "Timeout (seconds)",
      type: "number",
      default: DEFAULT_OPENSAGE_TIMEOUT_SEC,
      hint: "Per-turn wall-clock budget for one OpenSage run.",
    },
    {
      key: "paperclipBaseUrl",
      label: "Paperclip base URL (control-plane callback)",
      type: "text",
      default: DEFAULT_PAPERCLIP_BASE_URL,
      hint: "Where the OpenSage agent's paperclip_* tools call back into THIS Paperclip server. Seeded into session state each turn alongside a per-run API token.",
    },
  ],
};

const agentConfigurationDoc = `# opensage configuration

Drives the local **OpenSage** orchestrator, which plans, uses shared Neo4j memory, and
delegates edits to OpenCode -> local Qwen via vLLM. Paperclip POSTs the assigned task to
OpenSage's web API (\`/run_sse\`) and streams the resulting transcript back into the run log.

Config fields:
- **baseUrl** (default \`${DEFAULT_OPENSAGE_BASE_URL}\`): the \`opensage web\` server (mergatriod: \`make opensage\`).
- **appName** (auto-detected; fallback \`${DEFAULT_OPENSAGE_APP_NAME}\`): OpenSage ADK app name = the parent folder of its \`--agent\` path. Leave blank to auto-detect from /list-apps; set to override.
- **promptTemplate** (optional): overrides the task body sent to OpenSage; the structured Paperclip wake payload, the latest comment, and the workspace cwd are still included. \`{{taskTitle}}\`, \`{{taskDescription}}\`, \`{{taskMarkdown}}\`, \`{{cwd}}\`, \`{{wakeReason}}\` are substituted.
- **timeoutSec** (default \`${DEFAULT_OPENSAGE_TIMEOUT_SEC}\`): per-turn wall-clock budget.
- **paperclipBaseUrl** (default \`${DEFAULT_PAPERCLIP_BASE_URL}\`): where the OpenSage agent's \`paperclip_*\` control-plane tools call back. Each turn the adapter seeds a short-lived per-run JWT (\`X-Paperclip-Run-Id\`-scoped) + this URL into OpenSage session state (plain session keys — \`temp:\`-prefixed keys are dropped by ADK before they reach a tool), so the agent can post comments, update status, checkout/release, and delegate. The token is short-lived and re-seeded every turn, so its presence in the session snapshot is bounded. Requires the local-agent JWT secret (\`PAPERCLIP_AGENT_JWT_SECRET\`, or \`BETTER_AUTH_SECRET\`) to be set on this server; if unset, no token is minted and the tools no-op gracefully.

Approved MCP: this adapter does not spawn OpenSage and has no Paperclip-managed OpenSage home to mutate. The local mergatriod OpenSage app mirrors Paperclip's approved MCP exposure directly by adding a named \`playwright\` MCP toolset (tool prefix \`playwright\`) unless \`PAPERCLIP_APPROVED_MCP_SERVERS=none\` (also \`false\` or \`off\`). Use a dedicated dynamic subagent with \`tools_list=["playwright"]\` for interactive browser work.

Use when: you want full-stack runs (plan -> delegate -> memory) on the local model.
Don't use when: you want Paperclip to call a coding CLI directly (use \`opencode_local\`).

Start OpenSage first (\`make opensage\`, default :8800). One Paperclip agent maps to one durable
OpenSage session that resumes across heartbeats. The OpenSage web server has no auth of its own,
so keep it bound to localhost.

**Concurrency:** set this agent's **Max concurrent runs to 1-3** (Paperclip's per-agent default is 20).
This adapter maps one agent to ONE OpenSage session, so concurrent runs of the same agent would race
that shared session; and the local stack serves only a few sequences on one GPU. Keep it at 1 for a
strict serial loop. (The local LiteLLM proxy caps GPU requests as a backstop, but a low per-agent run
limit avoids host-side pile-up and 900s-timeout cascades.)`;

export const openSageAdapter: ServerAdapterModule = {
  type: "opensage",
  execute,
  testEnvironment,
  sessionCodec: openSageSessionCodec,
  models: [],
  // Mint a per-run local-agent JWT (ctx.authToken) so the OpenSage agent can act on the Paperclip
  // control plane. The adapter seeds it into OpenSage session state each turn (see execute.ts), where
  // the agent's tools read it (agent/paperclip_tool.py `_creds`); we do NOT spawn a local process, so
  // there is no env/skills injection — the token rides session state instead. No-op when the JWT
  // secret is unset (createLocalAgentJwt -> null -> no authToken).
  supportsLocalAgentJwt: true,
  getConfigSchema: () => configSchema,
  agentConfigurationDoc,
};
