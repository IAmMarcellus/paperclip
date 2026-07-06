import fs from "node:fs/promises";
import path from "node:path";
import { resolveApprovedMcpServers, type ApprovedMcpStdioServer } from "@paperclipai/adapter-utils/approved-mcp";

type PreparedCodexRuntimeConfig = {
  notes: string[];
  cleanup: () => Promise<void>;
};

type ParsedCodexProvidersConfig = {
  providers: Record<string, Record<string, unknown>>;
  modelProvider: string | null;
};

// Marker comments delimiting the Paperclip-managed regions of config.toml.
// TOML requires root-level keys (model_provider) to appear before the first
// table header, while [model_providers.*] tables must not swallow the user's
// root keys, so the managed content is split into a root block prepended to
// the file and a tables block appended to it.
const MANAGED_ROOT_BEGIN = "# >>> paperclip codex providers (root) -- managed, do not edit >>>";
const MANAGED_ROOT_END = "# <<< paperclip codex providers (root) <<<";
const MANAGED_TABLES_BEGIN = "# >>> paperclip codex providers (tables) -- managed, do not edit >>>";
const MANAGED_TABLES_END = "# <<< paperclip codex providers (tables) <<<";
const MANAGED_MCP_BEGIN = "# >>> paperclip approved mcp servers -- managed, do not edit >>>";
const MANAGED_MCP_END = "# <<< paperclip approved mcp servers <<<";
const MANAGED_MCP_ENV_BEGIN = "# >>> paperclip mcp env (adapterConfig.env) -- managed, do not edit >>>";
const MANAGED_MCP_ENV_END = "# <<< paperclip mcp env (adapterConfig.env) <<<";

// adapterConfig.env keys the codex adapter handles specially and must NOT blindly
// forward into the codex process env (execute.ts) or into MCP server env tables:
// - CODEX_HOME: the adapter sets the real (possibly remote) home itself.
// - OPENAI_API_KEY: codex reads it only for billing detection; injecting it into the
//   process env would flip a ChatGPT-subscription agent to API-key billing.
// - PAPERCLIP_API_KEY: minted/managed per run by the adapter.
export const CODEX_RESERVED_ENV_KEYS: ReadonlySet<string> = new Set([
  "CODEX_HOME",
  "OPENAI_API_KEY",
  "PAPERCLIP_API_KEY",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Recursively replace {env:VAR} placeholders with the resolved value. Used to bake
// gateway provider secrets into config.toml SERVER-SIDE, where the value is
// reliably present. Prefer codex's own `env_key` indirection (codex reads the
// named env var at request time); placeholder expansion exists for fields that
// must carry a literal value (e.g. http_headers). Unresolvable placeholders are
// left intact.
function expandEnvPlaceholders<T>(value: T, resolve: (name: string) => string | undefined): T {
  if (typeof value === "string") {
    return value.replace(/\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name: string) => {
      const resolved = resolve(name);
      return resolved !== undefined && resolved.length > 0 ? resolved : match;
    }) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => expandEnvPlaceholders(entry, resolve)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = expandEnvPlaceholders(entry, resolve);
    }
    return out as unknown as T;
  }
  return value;
}

// PAPERCLIP_CODEX_PROVIDERS is a JSON object that maps 1:1 onto codex's
// config.toml schema:
//
//   {
//     "providers": {
//       "<id>": {                      // -> [model_providers.<id>]
//         "name": "My gateway",        // optional display name
//         "base_url": "http://...",    // OpenAI-compatible endpoint
//         "env_key": "OPENAI_API_KEY", // env var codex reads the bearer key from
//         "wire_api": "responses",     // protocol codex speaks to the provider
//         ...                          // any other field codex supports
//         //                              (query_params, http_headers,
//         //                               env_http_headers, request_max_retries, ...)
//       }
//     },
//     "model_provider": "<id>"         // optional: top-level provider selection
//   }
//
// Scalar fields are emitted verbatim as TOML key = value pairs; plain-object
// fields (query_params, http_headers, ...) are emitted as inline tables and
// arrays of scalars as TOML arrays. String values may use {env:VAR}
// placeholders, expanded server-side against the run env and process.env.
function parseCodexProvidersConfig(
  raw: unknown,
  resolveEnv: (name: string) => string | undefined,
  notes: string[],
): ParsedCodexProvidersConfig | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Surface the misconfiguration instead of silently dropping the provider
    // config; an unparseable value would otherwise be undiagnosable.
    notes.push("PAPERCLIP_CODEX_PROVIDERS contains invalid JSON; custom providers ignored.");
    return null;
  }
  if (!isPlainObject(parsed)) {
    notes.push("PAPERCLIP_CODEX_PROVIDERS is set but is not a JSON object; custom providers ignored.");
    return null;
  }
  const rawProviders = parsed.providers;
  if (!isPlainObject(rawProviders)) {
    notes.push(
      'PAPERCLIP_CODEX_PROVIDERS has no "providers" object; custom providers ignored.',
    );
    return null;
  }
  // Only keep provider entries with non-empty names and object values; surface
  // the ones we drop so a malformed entry is just as diagnosable as malformed JSON.
  const providers: Record<string, Record<string, unknown>> = {};
  const skipped: string[] = [];
  for (const [key, value] of Object.entries(rawProviders)) {
    if (key.trim().length === 0 || !isPlainObject(value)) {
      skipped.push(key.trim().length === 0 ? "(empty name)" : key);
      continue;
    }
    providers[key] = expandEnvPlaceholders(value, resolveEnv);
  }
  if (Object.keys(providers).length === 0) {
    notes.push(
      `PAPERCLIP_CODEX_PROVIDERS "providers" contains no usable entries${
        skipped.length > 0
          ? ` (skipped provider(s) with empty names or non-object values: ${skipped.join(", ")})`
          : ""
      }; custom providers ignored.`,
    );
    return null;
  }
  if (skipped.length > 0) {
    notes.push(
      `PAPERCLIP_CODEX_PROVIDERS: skipped provider(s) with empty names or non-object values: ${skipped.join(", ")}.`,
    );
  }
  const modelProvider =
    typeof parsed.model_provider === "string" && parsed.model_provider.trim().length > 0
      ? parsed.model_provider.trim()
      : null;
  // A selector pointing at a provider that did not survive filtering (or was
  // never defined) would emit model_provider = "x" with no [model_providers.x]
  // table, which codex rejects at runtime with an error that points nowhere
  // near the env var. Treat it as the same class of misconfiguration as
  // malformed JSON: reject the whole block with a visible note.
  if (modelProvider !== null && !(modelProvider in providers)) {
    notes.push(
      `PAPERCLIP_CODEX_PROVIDERS: model_provider "${modelProvider}" does not match any usable provider entry; custom providers ignored.`,
    );
    return null;
  }
  return { providers, modelProvider };
}

function escapeTomlString(value: string): string {
  // TOML 1.0 basic strings require escaping U+0000-U+001F and U+007F (DEL).
  return value.replace(/[\\"\u0000-\u001f\u007f]/g, (char) => {
    switch (char) {
      case "\\":
        return "\\\\";
      case '"':
        return '\\"';
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "\t":
        return "\\t";
      default:
        return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
    }
  });
}

const BARE_TOML_KEY_RE = /^[A-Za-z0-9_-]+$/;

function tomlKey(key: string): string {
  return BARE_TOML_KEY_RE.test(key) ? key : `"${escapeTomlString(key)}"`;
}

// Hand-emitted TOML for a constrained value space (strings, numbers, booleans,
// arrays of scalars, plain objects as inline tables). Returns null for values
// that cannot be represented, which are then skipped.
function tomlValue(value: unknown): string | null {
  if (typeof value === "string") return `"${escapeTomlString(value)}"`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (Array.isArray(value)) {
    const entries = value.map((entry) => tomlValue(entry));
    if (entries.some((entry) => entry === null)) return null;
    return `[${entries.join(", ")}]`;
  }
  if (isPlainObject(value)) {
    const pairs: string[] = [];
    for (const [key, entry] of Object.entries(value)) {
      const emitted = tomlValue(entry);
      if (emitted === null) continue;
      pairs.push(`${tomlKey(key)} = ${emitted}`);
    }
    return `{ ${pairs.join(", ")} }`;
  }
  return null;
}

function emitProviderTable(name: string, fields: Record<string, unknown>): string[] {
  const lines = [`[model_providers.${tomlKey(name)}]`];
  for (const [key, value] of Object.entries(fields)) {
    const emitted = tomlValue(value);
    if (emitted === null) continue;
    lines.push(`${tomlKey(key)} = ${emitted}`);
  }
  return lines;
}

function stripManagedBlock(lines: string[], begin: string, end: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inBlock && trimmed === begin) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (trimmed === end) inBlock = false;
      continue;
    }
    out.push(line);
  }
  return out;
}

export function stripManagedCodexProviderBlocks(content: string): string {
  let lines = content.split("\n");
  lines = stripManagedBlock(lines, MANAGED_ROOT_BEGIN, MANAGED_ROOT_END);
  lines = stripManagedBlock(lines, MANAGED_TABLES_BEGIN, MANAGED_TABLES_END);
  return lines.join("\n");
}

export function stripManagedCodexMcpBlocks(content: string): string {
  return stripManagedBlock(content.split("\n"), MANAGED_MCP_BEGIN, MANAGED_MCP_END).join("\n");
}

function stripManagedCodexBlocks(content: string): string {
  return stripManagedCodexMcpBlocks(stripManagedCodexProviderBlocks(content));
}

const TABLE_HEADER_RE = /^\s*\[\s*([^\]]*?)\s*\]\s*(?:#.*)?$/;

// Best-effort parse of a TOML table header into its dotted path segments,
// stripping surrounding quotes per segment. Dotted quoted segment names are
// out of scope for this merge (codex provider ids are simple identifiers).
function parseTableHeaderPath(line: string): string[] | null {
  const match = TABLE_HEADER_RE.exec(line);
  if (!match) return null;
  return match[1]
    .split(".")
    .map((segment) => segment.trim())
    .map((segment) => segment.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"));
}

// Remove pre-existing definitions that would conflict with (or override) the
// managed content: [model_providers.<name>] tables (and their subtables) for
// names we are about to define, and the root-level `model_provider` key when
// we set one. Duplicate TOML tables/keys are parse errors in codex, so the
// managed definitions must win by excising the originals.
function stripConflictingDefinitions(
  content: string,
  providerNames: string[],
  mcpServerNames: string[],
  removeRootModelProvider: boolean,
): string {
  const names = new Set(providerNames);
  const mcpNames = new Set(mcpServerNames);
  const lines = content.split("\n");
  const out: string[] = [];
  let inRootRegion = true;
  let skippingSection = false;
  for (const line of lines) {
    const headerPath = parseTableHeaderPath(line);
    if (headerPath) {
      inRootRegion = false;
      skippingSection =
        (headerPath.length >= 2 &&
          headerPath[0] === "model_providers" &&
          names.has(headerPath[1])) ||
        (headerPath.length >= 2 &&
          headerPath[0] === "mcp_servers" &&
          mcpNames.has(headerPath[1]));
      if (skippingSection) continue;
    } else if (skippingSection) {
      continue;
    }
    if (inRootRegion && removeRootModelProvider && /^\s*model_provider\s*=/.test(line)) {
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function emitMcpServerTable(server: ApprovedMcpStdioServer): string[] {
  return [
    `[mcp_servers.${tomlKey(server.name)}]`,
    `command = ${tomlValue(server.command)}`,
    `args = ${tomlValue(server.args)}`,
  ].filter((line): line is string => line !== null);
}

function buildMergedConfigToml(input: {
  base: string;
  providers: ParsedCodexProvidersConfig | null;
  mcpServers: ApprovedMcpStdioServer[];
}): string {
  const sections: string[] = [];
  if (input.providers?.modelProvider) {
    sections.push(
      [
        MANAGED_ROOT_BEGIN,
        `model_provider = "${escapeTomlString(input.providers.modelProvider)}"`,
        MANAGED_ROOT_END,
      ].join("\n"),
    );
  }
  const trimmedBase = input.base.replace(/^\n+/, "").replace(/\n+$/, "");
  if (trimmedBase.length > 0) sections.push(trimmedBase);
  if (input.providers) {
    const tableLines: string[] = [MANAGED_TABLES_BEGIN];
    for (const [name, fields] of Object.entries(input.providers.providers)) {
      tableLines.push(...emitProviderTable(name, fields), "");
    }
    while (tableLines[tableLines.length - 1] === "") tableLines.pop();
    tableLines.push(MANAGED_TABLES_END);
    sections.push(tableLines.join("\n"));
  }
  if (input.mcpServers.length > 0) {
    const mcpLines: string[] = [MANAGED_MCP_BEGIN];
    for (const server of input.mcpServers) {
      mcpLines.push(...emitMcpServerTable(server), "");
    }
    while (mcpLines[mcpLines.length - 1] === "") mcpLines.pop();
    mcpLines.push(MANAGED_MCP_END);
    sections.push(mcpLines.join("\n"));
  }
  return `${sections.join("\n\n")}\n`;
}

async function readFileOrNull(filePath: string): Promise<string | null> {
  return fs.readFile(filePath, "utf8").catch(() => null);
}

// Pre-run backup of the original config.toml, written before the merged file.
// If a run dies without reaching cleanup() (a setup throw between prepare and
// execution, SIGKILL, ...), the next prepare restores the original from this
// backup with full fidelity -- including user [model_providers.*] sections the
// merge excised, which block-stripping alone cannot bring back.
function configTomlBackupPath(configTomlPath: string): string {
  return `${configTomlPath}.paperclip-backup`;
}

// Merge custom Codex model providers supplied via PAPERCLIP_CODEX_PROVIDERS
// into the managed CODEX_HOME's config.toml.
//
// Codex has no CLI flag or env var for pointing at a custom OpenAI-compatible
// endpoint: custom endpoints are `[model_providers.<id>]` tables in
// $CODEX_HOME/config.toml, selected by a top-level `model_provider = "<id>"`
// key (the `--model` CLI flag picks the model WITHIN the selected provider).
// We accept the providers as config (not hard-coded) so the gateway URL, key
// indirection, and wire protocol stay declarative.
//
// The merge preserves any existing config.toml content (seeded from the shared
// ~/.codex by prepareManagedCodexHome): managed content lives between marker
// comments and conflicting pre-existing definitions are excised so the managed
// definitions win. cleanup() restores the original file; if a run dies before
// cleanup, the next prepare restores the original from the pre-run backup file
// written alongside config.toml (including when PAPERCLIP_CODEX_PROVIDERS is
// no longer set), falling back to stripping the stale managed blocks.
//
// When the adapter config explicitly sets env.CODEX_HOME (a user-managed home),
// pass codexHome: null -- the file is left untouched and a note is surfaced.
export async function prepareCodexRuntimeConfig(input: {
  env: Record<string, string>;
  codexHome: string | null;
}): Promise<PreparedCodexRuntimeConfig> {
  const resolveEnv = (name: string): string | undefined => input.env[name] ?? process.env[name];
  const notes: string[] = [];
  const parsed = parseCodexProvidersConfig(
    input.env.PAPERCLIP_CODEX_PROVIDERS ?? process.env.PAPERCLIP_CODEX_PROVIDERS,
    resolveEnv,
    notes,
  );
  const approvedMcp = resolveApprovedMcpServers({ env: input.env });
  notes.push(...approvedMcp.notes);
  const hasRuntimeConfig = parsed !== null || approvedMcp.servers.length > 0;

  if (!hasRuntimeConfig) {
    // Self-heal state left behind by a crashed run (cleanup() never ran).
    if (input.codexHome) {
      const configTomlPath = path.join(input.codexHome, "config.toml");
      const reason = notes.length === 0 ? " (managed runtime config is disabled or no longer set)" : "";
      const backupPath = configTomlBackupPath(configTomlPath);
      const backup = await readFileOrNull(backupPath);
      if (backup !== null) {
        // Full-fidelity restore: the backup is the pre-run original, including
        // any user provider sections the crashed run's merge excised.
        await fs.writeFile(configTomlPath, backup, "utf8");
        await fs.rm(backupPath, { force: true });
        return {
          notes: [
            ...notes,
            `Restored "${configTomlPath}" from its pre-run backup, removing stale Paperclip-managed runtime config left by an interrupted run${reason}.`,
          ],
          cleanup: async () => {},
        };
      }
      // Fallback for pre-backup stale state: strip the managed blocks.
      const existing = await readFileOrNull(configTomlPath);
      if (existing !== null) {
        const stripped = stripManagedCodexBlocks(existing);
        if (stripped !== existing) {
          await fs.writeFile(configTomlPath, stripped, "utf8");
          return {
            notes: [
              ...notes,
              `Removed stale Paperclip-managed runtime config blocks from "${configTomlPath}"${reason}.`,
            ],
            cleanup: async () => {},
          };
        }
      }
    }
    return { notes, cleanup: async () => {} };
  }

  if (!input.codexHome) {
    const skipped = [
      parsed ? "PAPERCLIP_CODEX_PROVIDERS" : "",
      approvedMcp.servers.length > 0 ? "approved MCP sync" : "",
    ].filter(Boolean).join(" and ");
    return {
      notes: [
        ...notes,
        `${skipped} ${skipped.includes(" and ") ? "are" : "is"} enabled but the adapter config explicitly sets env.CODEX_HOME; leaving the user-managed Codex home untouched.`,
      ],
      cleanup: async () => {},
    };
  }

  const configTomlPath = path.join(input.codexHome, "config.toml");
  const backupPath = configTomlBackupPath(configTomlPath);
  // A surviving backup from an interrupted run is the true pre-run content;
  // the current config.toml would still carry that run's managed blocks.
  const original = (await readFileOrNull(backupPath)) ?? (await readFileOrNull(configTomlPath));
  const providerNames = parsed ? Object.keys(parsed.providers) : [];
  const mcpServerNames = approvedMcp.servers.map((server) => server.name);
  const base = stripConflictingDefinitions(
    stripManagedCodexBlocks(original ?? ""),
    providerNames,
    mcpServerNames,
    (parsed?.modelProvider ?? null) !== null,
  );
  await fs.mkdir(input.codexHome, { recursive: true });
  // Persist the original BEFORE writing the merged file so a run that never
  // reaches cleanup() can be restored by the next prepare.
  await fs.writeFile(backupPath, original ?? "", "utf8");
  await fs.writeFile(configTomlPath, buildMergedConfigToml({
    base,
    providers: parsed,
    mcpServers: approvedMcp.servers,
  }), "utf8");

  if (approvedMcp.servers.length > 0) {
    notes.push(
      `Merged approved Codex MCP server(s) into "${configTomlPath}": ${mcpServerNames.join(", ")}.`,
    );
  }
  if (parsed) {
    notes.push(
      `Merged ${providerNames.length} custom Codex model provider(s) from PAPERCLIP_CODEX_PROVIDERS into "${configTomlPath}": ${providerNames.join(", ")}${
        parsed.modelProvider ? `; selected model_provider "${parsed.modelProvider}"` : ""
      }.`,
    );
  }

  return {
    notes,
    cleanup: async () => {
      if (original === null) {
        await fs.rm(configTomlPath, { force: true });
      } else {
        await fs.writeFile(configTomlPath, original, "utf8");
      }
      await fs.rm(backupPath, { force: true });
    },
  };
}

// --- MCP env injection (user-managed Codex homes) -------------------------------
//
// codex sanitizes the environment of MCP server subprocesses to a small fixed
// allowlist (HOME, LANG, LOGNAME, PATH, SHELL, TERM, USER) plus whatever the
// server's [mcp_servers.<name>.env] table declares. It does NOT forward the
// parent codex process env. So an agent's adapterConfig.env never reaches its MCP
// servers unless it is written into those env tables. For user-managed homes
// (whose config.toml the provider/approved-MCP path deliberately leaves alone) we
// inject adapterConfig.env into the existing [mcp_servers.*.env] tables before the
// run and restore the original file afterwards (with crash recovery via a pre-run
// backup, mirroring prepareCodexRuntimeConfig).

interface CodexMcpServerEnvInfo {
  name: string;
  hasInlineEnv: boolean;
  // Existing [mcp_servers.<name>.env] key declarations, captured verbatim so
  // user keys we do not override are re-emitted unchanged.
  envKeyLines: Array<{ key: string; line: string }>;
}

function unquoteTomlKey(key: string): string {
  if (key.startsWith('"') && key.endsWith('"')) {
    return key.slice(1, -1).replace(/\\(.)/g, "$1");
  }
  return key;
}

// Best-effort scan of config.toml for MCP servers and their env declarations.
// Single-line key declarations only (env values are simple strings in practice);
// servers using an inline `env = { ... }` table are flagged and skipped, never
// rewritten.
function parseCodexMcpServers(content: string): CodexMcpServerEnvInfo[] {
  const byName = new Map<string, CodexMcpServerEnvInfo>();
  const order: string[] = [];
  const ensure = (name: string): CodexMcpServerEnvInfo => {
    let info = byName.get(name);
    if (!info) {
      info = { name, hasInlineEnv: false, envKeyLines: [] };
      byName.set(name, info);
      order.push(name);
    }
    return info;
  };
  let curPath: string[] | null = null;
  for (const line of content.split("\n")) {
    const headerPath = parseTableHeaderPath(line);
    if (headerPath) {
      curPath = headerPath;
      if (headerPath.length === 2 && headerPath[0] === "mcp_servers") {
        ensure(headerPath[1]);
      } else if (
        headerPath.length === 3 &&
        headerPath[0] === "mcp_servers" &&
        headerPath[2] === "env"
      ) {
        ensure(headerPath[1]);
      }
      continue;
    }
    if (!curPath || curPath[0] !== "mcp_servers") continue;
    if (curPath.length === 2) {
      // body of [mcp_servers.<name>] — detect an inline env table
      if (/^\s*env\s*=/.test(line)) ensure(curPath[1]).hasInlineEnv = true;
    } else if (curPath.length === 3 && curPath[2] === "env") {
      // body of [mcp_servers.<name>.env] — capture each key declaration verbatim
      const match = /^\s*("(?:[^"\\]|\\.)*"|[A-Za-z0-9_-]+)\s*=/.exec(line);
      if (match) ensure(curPath[1]).envKeyLines.push({ key: unquoteTomlKey(match[1]), line: line.replace(/\s+$/, "") });
    }
  }
  return order.map((name) => byName.get(name)!);
}

// Remove the [mcp_servers.<name>.env] subtable blocks for the given server names.
function stripMcpEnvSubtables(content: string, names: Set<string>): string {
  const out: string[] = [];
  let skipping = false;
  for (const line of content.split("\n")) {
    const headerPath = parseTableHeaderPath(line);
    if (headerPath) {
      skipping =
        headerPath.length === 3 &&
        headerPath[0] === "mcp_servers" &&
        headerPath[2] === "env" &&
        names.has(headerPath[1]);
      if (skipping) continue;
    } else if (skipping) {
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function stripManagedMcpEnvBlock(content: string): string {
  return stripManagedBlock(content.split("\n"), MANAGED_MCP_ENV_BEGIN, MANAGED_MCP_ENV_END).join("\n");
}

function mcpEnvBackupPath(configTomlPath: string): string {
  return `${configTomlPath}.paperclip-mcpenv-backup`;
}

// Inject adapterConfig.env into a user-managed Codex home's existing
// [mcp_servers.*.env] tables so MCP servers receive it (codex does not forward
// the process env). Returns a cleanup() that restores the pre-run file. If a run
// dies before cleanup, the next call restores the original from the pre-run backup.
export async function prepareCodexMcpEnvInjection(input: {
  codexHome: string;
  env: Record<string, string>;
}): Promise<PreparedCodexRuntimeConfig> {
  const notes: string[] = [];
  const inject = Object.entries(input.env).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && !CODEX_RESERVED_ENV_KEYS.has(entry[0]),
  );
  const configTomlPath = path.join(input.codexHome, "config.toml");
  const backupPath = mcpEnvBackupPath(configTomlPath);
  // A surviving backup is the true pre-run content (a prior run died before cleanup).
  const backup = await readFileOrNull(backupPath);
  const original = backup ?? (await readFileOrNull(configTomlPath));
  if (original === null) return { notes, cleanup: async () => {} };

  // Self-heal: if there's nothing to inject but a stale backup/managed block
  // remains from an interrupted run, restore the original and stop.
  if (inject.length === 0) {
    if (backup !== null) {
      await fs.writeFile(configTomlPath, original, "utf8");
      await fs.rm(backupPath, { force: true });
      notes.push(`Restored "${configTomlPath}" from its pre-run backup (no MCP env to inject).`);
    }
    return { notes, cleanup: async () => {} };
  }

  const servers = parseCodexMcpServers(original);
  const injectable = servers.filter((server) => !server.hasInlineEnv);
  const inlineSkipped = servers.filter((server) => server.hasInlineEnv).map((server) => server.name);
  if (inlineSkipped.length > 0) {
    notes.push(
      `Codex MCP env injection skipped server(s) using an inline env table (unsupported merge): ${inlineSkipped.join(", ")}.`,
    );
  }
  if (injectable.length === 0) {
    if (backup !== null) {
      await fs.writeFile(configTomlPath, original, "utf8");
      await fs.rm(backupPath, { force: true });
    }
    return { notes, cleanup: async () => {} };
  }

  const injectKeys = new Set(inject.map(([key]) => key));
  const sortedInject = [...inject].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const targetNames = new Set(injectable.map((server) => server.name));
  const base = stripManagedMcpEnvBlock(stripMcpEnvSubtables(original, targetNames));

  const blockLines: string[] = [MANAGED_MCP_ENV_BEGIN];
  for (const server of injectable) {
    blockLines.push(`[mcp_servers.${tomlKey(server.name)}.env]`);
    for (const { key, line } of server.envKeyLines) {
      if (!injectKeys.has(key)) blockLines.push(line); // preserve user keys we don't override
    }
    for (const [key, value] of sortedInject) {
      blockLines.push(`${tomlKey(key)} = "${escapeTomlString(value)}"`);
    }
    blockLines.push("");
  }
  while (blockLines[blockLines.length - 1] === "") blockLines.pop();
  blockLines.push(MANAGED_MCP_ENV_END);

  const merged = `${base.replace(/\n+$/, "")}\n\n${blockLines.join("\n")}\n`;

  await fs.mkdir(input.codexHome, { recursive: true });
  // Persist the original BEFORE writing the merged file so a run that never reaches
  // cleanup() can be restored by the next call.
  await fs.writeFile(backupPath, original, "utf8");
  await fs.writeFile(configTomlPath, merged, "utf8");
  notes.push(
    `Injected adapterConfig.env (${inject.length} key(s)) into Codex MCP env table(s) in "${configTomlPath}": ${injectable
      .map((server) => server.name)
      .join(", ")}.`,
  );

  return {
    notes,
    cleanup: async () => {
      await fs.writeFile(configTomlPath, original, "utf8");
      await fs.rm(backupPath, { force: true });
    },
  };
}
