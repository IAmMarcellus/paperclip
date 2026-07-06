import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import {
  asNumber,
  asString,
  joinPromptSections,
  parseObject,
  renderPaperclipWakePrompt,
  renderTemplate,
} from "../utils.js";
import { Agent, fetch as undiciFetch } from "undici";
import {
  DEFAULT_OPENSAGE_APP_NAME,
  DEFAULT_OPENSAGE_BASE_URL,
  DEFAULT_OPENSAGE_TIMEOUT_SEC,
  DEFAULT_PAPERCLIP_BASE_URL,
} from "./constants.js";

// The OpenSage `/run_sse` stream sits SILENT for minutes while a single `opencode_run` tool call
// executes (OpenSage streams nothing back until the tool returns). Node's global fetch (undici)
// aborts an idle response body after its default 300s `bodyTimeout` (surfacing as `TypeError:
// terminated`), which killed long executor delegations mid-run (-> adapter_failed). Disable the idle
// timeouts on a dedicated dispatcher and let the per-turn AbortController (timeoutSec, default 900s)
// be the only bound on how long a run may take.
const SSE_DISPATCHER = new Agent({ bodyTimeout: 0, headersTimeout: 0 });

// ---------------------------------------------------------------------------
// OpenSage / ADK wire shapes — only the fields we read, parsed defensively.
// ADK serializes google.genai Content; key casing can vary by version, so we
// accept both snake_case and camelCase for the function call/response parts.
// ---------------------------------------------------------------------------

interface OpenSagePart {
  text?: string;
  function_call?: { name?: string; args?: unknown };
  functionCall?: { name?: string; args?: unknown };
  function_response?: { name?: string; response?: unknown };
  functionResponse?: { name?: string; response?: unknown };
}

// ADK serializes google.genai usage_metadata on model-response events; casing varies
// by version, so accept both. Tokens are reported PER LLM call → we sum across events.
interface OpenSageUsage {
  promptTokenCount?: number;
  prompt_token_count?: number;
  candidatesTokenCount?: number;
  candidates_token_count?: number;
  cachedContentTokenCount?: number;
  cached_content_token_count?: number;
}

interface OpenSageEvent {
  author?: string;
  content?: { parts?: OpenSagePart[] } | null;
  errorMessage?: string | null;
  error_message?: string | null;
  // `/run_sse` emits these top-level sentinels: `{"error": "..."}` when the SSE
  // generator itself fails (e.g. no active task context or an internal exception),
  // and `{"stopped": true, ...}` when a turn is stopped from the UI/API.
  error?: string;
  stopped?: boolean;
  message?: string;
  usageMetadata?: OpenSageUsage | null;
  usage_metadata?: OpenSageUsage | null;
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function safeJson(value: unknown): string {
  if (value === undefined) return "";
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readWorkspaceCwd(context: Record<string, unknown>): string {
  const workspace = parseObject(context.paperclipWorkspace);
  return asString(workspace.cwd, asString(context.cwd, ""));
}

/**
 * Resolve the OpenSage app name. An explicit config value wins; otherwise ask the
 * server (it serves exactly one app) via /list-apps, falling back to the constant
 * only when discovery fails. This avoids guessing OpenSage's app-name derivation
 * (the parent folder of its --agent path), which is deployment-specific.
 */
async function resolveAppName(
  baseUrl: string,
  configured: string,
  signal: AbortSignal,
): Promise<string> {
  if (configured) return configured;
  try {
    const res = await fetch(`${baseUrl}/list-apps`, { signal });
    if (res.ok) {
      const apps = (await res.json()) as unknown;
      if (Array.isArray(apps) && typeof apps[0] === "string" && apps[0]) {
        return apps[0];
      }
    }
  } catch {
    // fall through to the default
  }
  return DEFAULT_OPENSAGE_APP_NAME;
}

/**
 * Build the task prompt OpenSage runs. Mirrors the sibling adapters' assembly
 * (`wakePrompt` + task body, with the task body suppressed on a resumed session)
 * so OpenSage gets the same structured wake context Claude/Cursor/etc. receive.
 *
 * Two OpenSage-specific deviations: (1) the realized workspace cwd is injected so
 * OpenSage's `opencode_run` edits the real worktree (it can't inherit a process
 * cwd over HTTP); (2) the latest comment body is inlined because OpenSage has no
 * Paperclip API credentials to fetch the thread itself.
 */
function buildPrompt(ctx: AdapterExecutionContext, cwd: string, resumedSession: boolean): string {
  const context = ctx.context;
  const issue = parseObject(context.paperclipIssue);
  const continuationBody = asString(parseObject(context.paperclipContinuationSummary).body, "");
  const wakeCommentBody = asString(parseObject(context.paperclipWakeComment).body, "");
  const handoffNote = asString(context.paperclipSessionHandoffMarkdown, "").trim();

  const data: Record<string, string> = {
    taskTitle: asString(issue.title, ""),
    taskDescription: asString(issue.description, ""),
    taskMarkdown: asString(context.paperclipTaskMarkdown, ""),
    wakeReason: asString(context.wakeReason, ""),
    cwd,
  };

  // The structured wake payload (execution contract, issue status/priority/workMode,
  // pending-comment counts, planning directives) — empty string when no wake payload.
  const wakePrompt = renderPaperclipWakePrompt(context.paperclipWake, { resumedSession });

  const template = asString(ctx.config.promptTemplate, "");
  const taskBody = template
    ? renderTemplate(template, data)
    : data.taskMarkdown || joinPromptSections([data.taskTitle, data.taskDescription]);

  // On a resumed OpenSage session with a wake delta, the agent already holds the
  // task from the prior turn — send only the delta (the siblings' resume-delta path).
  const includeTaskBody = !(resumedSession && wakePrompt.length > 0);

  const prompt = joinPromptSections([
    wakePrompt,
    handoffNote,
    includeTaskBody ? taskBody : "",
    includeTaskBody && continuationBody ? `Continuation context:\n${continuationBody}` : "",
    wakeCommentBody && `Latest comment:\n${wakeCommentBody}`,
    cwd && `Work in this directory; pass it as the \`cwd\` argument to opencode_run: ${cwd}`,
  ]);
  return prompt || "Continue your assigned work.";
}

/**
 * Resume the prior OpenSage session if it still exists, otherwise create one
 * (reusing the prior id when possible so the display id stays stable). `resumed`
 * is true only when the session was found server-side (so the conversation
 * history is present), which drives the resume-delta prompt.
 */
async function ensureSession(input: {
  baseUrl: string;
  appName: string;
  userId: string;
  existingSessionId: string;
  signal: AbortSignal;
}): Promise<{ sessionId: string; resumed: boolean }> {
  const { baseUrl, appName, userId, existingSessionId, signal } = input;
  const base = `${baseUrl}/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(userId)}/sessions`;

  if (existingSessionId) {
    const res = await fetch(`${base}/${encodeURIComponent(existingSessionId)}`, { signal });
    if (res.ok) return { sessionId: existingSessionId, resumed: true };
    // 404 (e.g. OpenSage restarted without --resume) -> fall through and recreate.
  }

  const res = await fetch(base, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(existingSessionId ? { session_id: existingSessionId } : {}),
    signal,
  });
  if (!res.ok) {
    throw new Error(`OpenSage session create failed (HTTP ${res.status})`);
  }
  const body = (await res.json()) as { id?: unknown };
  const id = typeof body.id === "string" && body.id.length > 0 ? body.id : existingSessionId;
  if (!id) throw new Error("OpenSage session create returned no id");
  return { sessionId: id, resumed: false };
}

/**
 * Read a `text/event-stream` body line by line, parsing each `data:` payload as
 * an ADK event. Tolerates partial lines, keep-alives, and non-JSON noise.
 */
async function consumeSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: OpenSageEvent) => Promise<void>,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushLine = async (rawLine: string): Promise<void> => {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload) return;
    let parsed: OpenSageEvent;
    try {
      parsed = JSON.parse(payload) as OpenSageEvent;
    } catch {
      return;
    }
    await onEvent(parsed);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Scan with a moving start index and compact the buffer once per chunk,
    // rather than re-slicing the whole tail on every newline.
    let start = 0;
    let nl = buffer.indexOf("\n", start);
    while (nl >= 0) {
      await flushLine(buffer.slice(start, nl));
      start = nl + 1;
      nl = buffer.indexOf("\n", start);
    }
    if (start > 0) buffer = buffer.slice(start);
  }
  buffer += decoder.decode();
  if (buffer.length > 0) await flushLine(buffer);
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, runtime, onLog, onMeta } = ctx;

  const baseUrl = trimTrailingSlash(asString(config.baseUrl, DEFAULT_OPENSAGE_BASE_URL));
  const userId = ctx.agent.id;
  const timeoutSec = asNumber(config.timeoutSec, DEFAULT_OPENSAGE_TIMEOUT_SEC);

  // Per-run Paperclip control-plane credentials, seeded into OpenSage session state on every turn so
  // the agent's `paperclip_*` tools can call back with correct X-Paperclip-Run-Id attribution. These
  // key names are a cross-runtime contract: they MUST match the readers in agent/paperclip_tool.py
  // (_TOKEN_KEY / _RUN_ID_KEY / _BASE_URL_KEY / _AGENT_ID_KEY / _COMPANY_ID_KEY).
  // Plain (session-scoped) keys — NOT `temp:`-prefixed: ADK's extract_state_delta drops temp: keys
  // from session state, so a temp: key in the run_async state_delta never reaches tool_context.state.
  // The token is short-lived (~1h) and overwritten here every turn, bounding its presence in the
  // persisted session snapshot. Undefined when no JWT was minted (secret unset) — tools then no-op.
  const paperclipStateDelta = ctx.authToken
    ? {
        paperclip_api_token: ctx.authToken,
        paperclip_run_id: ctx.runId,
        paperclip_base_url: asString(config.paperclipBaseUrl, DEFAULT_PAPERCLIP_BASE_URL),
        paperclip_agent_id: ctx.agent.id,
        paperclip_company_id: ctx.agent.companyId,
      }
    : undefined;

  const priorSessionId = asString(parseObject(runtime.sessionParams).sessionId, "");
  const cwd = readWorkspaceCwd(ctx.context);

  const controller = new AbortController();
  const timer = timeoutSec > 0 ? setTimeout(() => controller.abort(), timeoutSec * 1000) : null;

  let sessionId = priorSessionId;
  let lastText = "";
  let toolCalls = 0;
  let runErrorMessage: string | null = null;
  // Token usage summed across the run's model-response events (the chatgpt-codex planner).
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;

  try {
    const appName = await resolveAppName(baseUrl, asString(config.appName, ""), controller.signal);
    const ensured = await ensureSession({
      baseUrl,
      appName,
      userId,
      existingSessionId: priorSessionId,
      signal: controller.signal,
    });
    sessionId = ensured.sessionId;
    const prompt = buildPrompt(ctx, cwd, ensured.resumed);

    if (onMeta) {
      await onMeta({
        adapterType: "opensage",
        command: `POST ${baseUrl}/run_sse`,
        ...(cwd ? { cwd } : {}),
        prompt,
        context: { appName, userId, sessionId, resumed: ensured.resumed },
      });
    }

    // Use undici's own fetch (not Node's global fetch) so the dispatcher comes from the SAME undici
    // as the Agent: a standalone-undici Agent passed to Node's bundled-undici global fetch is
    // rejected ("invalid onRequestStart method"). SSE_DISPATCHER disables the 300s idle bodyTimeout.
    const res = await undiciFetch(`${baseUrl}/run_sse`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({
        app_name: appName,
        user_id: userId,
        session_id: sessionId,
        new_message: { role: "user", parts: [{ text: prompt }] },
        streaming: true,
        ...(paperclipStateDelta ? { state_delta: paperclipStateDelta } : {}),
      }),
      signal: controller.signal,
      dispatcher: SSE_DISPATCHER,
    });

    if (!res.ok || !res.body) {
      const detail = !res.ok ? `HTTP ${res.status}` : "no response body";
      throw new Error(`OpenSage /run_sse failed (${detail})`);
    }

    // undici types body as ReadableStream<any>; runtime chunks are Uint8Array (what consumeSse reads).
    await consumeSse(res.body as unknown as ReadableStream<Uint8Array>, async (event) => {
      if (event.stopped === true) {
        runErrorMessage = event.message ?? "OpenSage turn was stopped";
        return;
      }
      // Top-level `{"error": "..."}` sentinel from the SSE generator (no task
      // context / internal exception) — surface it instead of silently passing.
      if (typeof event.error === "string" && event.error) {
        runErrorMessage = event.error;
        await onLog("stderr", `${event.error}\n`);
        return;
      }
      const errMsg = event.errorMessage ?? event.error_message;
      if (errMsg) {
        runErrorMessage = errMsg;
        await onLog("stderr", `${errMsg}\n`);
      }
      const evUsage = event.usageMetadata ?? event.usage_metadata;
      if (evUsage) {
        inputTokens += asNumber(evUsage.promptTokenCount ?? evUsage.prompt_token_count, 0);
        outputTokens += asNumber(evUsage.candidatesTokenCount ?? evUsage.candidates_token_count, 0);
        cachedInputTokens += asNumber(
          evUsage.cachedContentTokenCount ?? evUsage.cached_content_token_count,
          0,
        );
      }
      for (const part of event.content?.parts ?? []) {
        if (typeof part.text === "string" && part.text.length > 0) {
          lastText = part.text;
          await onLog("stdout", part.text.endsWith("\n") ? part.text : `${part.text}\n`);
          continue;
        }
        const call = part.function_call ?? part.functionCall;
        if (call?.name) {
          toolCalls += 1;
          await onLog("stdout", `→ tool: ${call.name}(${safeJson(call.args)})\n`);
          continue;
        }
        const resp = part.function_response ?? part.functionResponse;
        if (resp?.name) {
          await onLog("stdout", `← tool result: ${resp.name}: ${safeJson(resp.response).slice(0, 2000)}\n`);
        }
      }
    });

    // Report planner (chatgpt-codex / GPT-5.5) token usage to Paperclip's Costs panel.
    // costUsd is 0: the manager runs on a ChatGPT subscription (no per-token price) and the
    // qwen worker is local — neither has a marginal dollar cost. (The qwen worker's tokens run
    // inside OpenCode and are not surfaced in OpenSage's event stream.)
    const usageSummary =
      inputTokens || outputTokens || cachedInputTokens
        ? { inputTokens, outputTokens, cachedInputTokens }
        : undefined;
    const usageFields = usageSummary ? { usage: usageSummary, costUsd: 0 } : {};

    if (runErrorMessage) {
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: runErrorMessage,
        sessionParams: { sessionId },
        sessionDisplayId: sessionId,
        summary: lastText.slice(0, 500) || runErrorMessage,
        ...usageFields,
      };
    }

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      sessionParams: { sessionId },
      sessionDisplayId: sessionId,
      summary:
        lastText.slice(0, 500) ||
        `OpenSage completed (${toolCalls} tool call${toolCalls === 1 ? "" : "s"})`,
      ...usageFields,
    };
  } catch (err) {
    const sessionFields = sessionId
      ? { sessionParams: { sessionId }, sessionDisplayId: sessionId }
      : {};
    if (err instanceof Error && err.name === "AbortError") {
      return {
        exitCode: null,
        signal: null,
        timedOut: true,
        errorMessage: `OpenSage run timed out after ${timeoutSec}s`,
        ...sessionFields,
      };
    }
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: err instanceof Error ? err.message : String(err),
      ...sessionFields,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
