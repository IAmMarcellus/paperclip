import type { AdapterConfigSchema, AdapterSessionCodec, ServerAdapterModule } from "../types.js";
import {
  DEFAULT_OPENSAGE_APP_NAME,
  DEFAULT_OPENSAGE_BASE_URL,
  DEFAULT_OPENSAGE_TIMEOUT_SEC,
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

Use when: you want full-stack runs (plan -> delegate -> memory) on the local model.
Don't use when: you want Paperclip to call a coding CLI directly (use \`opencode_local\`).

Start OpenSage first (\`make opensage\`, default :8800). One Paperclip agent maps to one durable
OpenSage session that resumes across heartbeats. The OpenSage web server has no auth of its own,
so keep it bound to localhost.`;

export const openSageAdapter: ServerAdapterModule = {
  type: "opensage",
  execute,
  testEnvironment,
  sessionCodec: openSageSessionCodec,
  models: [],
  getConfigSchema: () => configSchema,
  agentConfigurationDoc,
};
