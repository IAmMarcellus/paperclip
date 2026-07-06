import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { execute } from "../adapters/opensage/execute.js";
import { testEnvironment } from "../adapters/opensage/test.js";
import { openSageSessionCodec } from "../adapters/opensage/index.js";

interface RunBody {
  app_name?: string;
  user_id?: string;
  session_id?: string;
  new_message?: { role?: string; parts?: Array<{ text?: string }> };
  streaming?: boolean;
}

interface MockOpenSageOptions {
  /** Session ids that GET .../sessions/:id resolves (200) instead of 404. */
  existingSessionIds?: string[];
  /** ADK events streamed from /run_sse (defaults to a tool call + a final text). */
  events?: unknown[];
  /** Status code for /run_sse (default 200). */
  runStatus?: number;
}

async function createMockOpenSage(options: MockOpenSageOptions = {}) {
  const events = options.events ?? [
    { author: "agent", content: { parts: [{ function_call: { name: "opencode_run", args: { task: "add fn" } } }] } },
    { author: "agent", content: { parts: [{ text: "Done. Added add(a, b)." }] } },
  ];
  const existing = new Set(options.existingSessionIds ?? []);
  const sessionPosts: Array<{ session_id?: string }> = [];
  let runBody: RunBody | null = null;
  let createdCounter = 0;

  const server = createServer((req, res) => {
    const url = req.url ?? "";
    const method = req.method ?? "GET";
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => {
      const bodyText = Buffer.concat(chunks).toString("utf8");
      const body = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {};

      if (method === "GET" && url === "/list-apps") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(["agent"]));
        return;
      }

      const sessionGet = method === "GET" ? /\/sessions\/([^/?]+)$/.exec(url) : null;
      if (sessionGet) {
        const id = decodeURIComponent(sessionGet[1]);
        if (existing.has(id)) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ id, events: [] }));
        } else {
          res.writeHead(404);
          res.end();
        }
        return;
      }

      if (method === "POST" && url.endsWith("/sessions")) {
        const requested = typeof body.session_id === "string" ? body.session_id : undefined;
        sessionPosts.push({ session_id: requested });
        const id = requested && requested.length > 0 ? requested : `sess-${++createdCounter}`;
        existing.add(id);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id }));
        return;
      }

      if (method === "POST" && url.endsWith("/run_sse")) {
        runBody = body as RunBody;
        const status = options.runStatus ?? 200;
        if (status !== 200) {
          res.writeHead(status);
          res.end();
          return;
        }
        res.writeHead(200, { "content-type": "text/event-stream" });
        for (const ev of events) {
          res.write(`data: ${JSON.stringify(ev)}\n\n`);
        }
        res.end();
        return;
      }

      res.writeHead(404);
      res.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to resolve test server address");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    getRunBody: () => runBody,
    getSessionPosts: () => sessionPosts,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function buildContext(
  config: Record<string, unknown>,
  overrides?: Partial<AdapterExecutionContext>,
  priorSessionId?: string,
  extraContext?: Record<string, unknown>,
): AdapterExecutionContext {
  return {
    runId: "run-1",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "mergatriod_coder",
      adapterType: "opensage",
      adapterConfig: {},
    },
    runtime: {
      sessionId: null,
      sessionParams: priorSessionId ? { sessionId: priorSessionId } : null,
      sessionDisplayId: null,
      taskKey: null,
    },
    config,
    context: {
      paperclipIssue: { title: "Add add()", description: "Add add(a, b) to calc.py with a test" },
      paperclipTaskMarkdown: "## Add add()\nAdd add(a, b) to calc.py with a test",
      paperclipWorkspace: { cwd: "/tmp/ws-123" },
      wakeReason: "issue_assigned",
      ...extraContext,
    },
    onLog: async () => {},
    ...overrides,
  };
}

describe("opensage adapter execute", () => {
  it("creates a session, streams the run, and persists the session id", async () => {
    const server = await createMockOpenSage();
    const logs: string[] = [];
    try {
      const result = await execute(
        buildContext(
          { baseUrl: server.baseUrl },
          { onLog: async (_stream, chunk) => void logs.push(chunk) },
        ),
      );

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.sessionParams).toEqual({ sessionId: "sess-1" });
      expect(result.sessionDisplayId).toBe("sess-1");

      const run = server.getRunBody();
      expect(run?.app_name).toBe("agent");
      expect(run?.user_id).toBe("agent-1");
      expect(run?.session_id).toBe("sess-1");
      expect(run?.streaming).toBe(true);
      const prompt = run?.new_message?.parts?.[0]?.text ?? "";
      expect(prompt).toContain("Add add(a, b) to calc.py");
      expect(prompt).toContain("/tmp/ws-123"); // cwd bridge for opencode_run

      const transcript = logs.join("");
      expect(transcript).toContain("opencode_run"); // tool call surfaced
      expect(transcript).toContain("Done. Added add(a, b).");
    } finally {
      await server.close();
    }
  });

  it("reports summed token usage from usageMetadata, with costUsd 0 (subscription)", async () => {
    const server = await createMockOpenSage({
      events: [
        {
          author: "agent",
          content: { parts: [{ text: "thinking" }] },
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10, cachedContentTokenCount: 5 },
        },
        {
          author: "agent",
          content: { parts: [{ text: "done" }] },
          // snake_case on a later event — must still be summed in
          usage_metadata: { prompt_token_count: 200, candidates_token_count: 20 },
        },
      ],
    });
    try {
      const result = await execute(buildContext({ baseUrl: server.baseUrl }));
      expect(result.usage).toEqual({ inputTokens: 300, outputTokens: 30, cachedInputTokens: 5 });
      expect(result.costUsd).toBe(0); // ChatGPT-subscription planner + local worker: no per-token $
    } finally {
      await server.close();
    }
  });

  it("omits usage/costUsd when the stream carries no usageMetadata", async () => {
    const server = await createMockOpenSage(); // default events have no usageMetadata
    try {
      const result = await execute(buildContext({ baseUrl: server.baseUrl }));
      expect(result.usage).toBeUndefined();
      expect(result.costUsd).toBeUndefined();
    } finally {
      await server.close();
    }
  });

  it("uses an explicitly configured app name (skips auto-detect)", async () => {
    const server = await createMockOpenSage();
    try {
      await execute(buildContext({ baseUrl: server.baseUrl, appName: "custom-app" }));
      expect(server.getRunBody()?.app_name).toBe("custom-app");
    } finally {
      await server.close();
    }
  });

  it("resumes an existing session without creating a new one", async () => {
    const server = await createMockOpenSage({ existingSessionIds: ["sess-resume"] });
    try {
      const result = await execute(
        buildContext({ baseUrl: server.baseUrl }, undefined, "sess-resume"),
      );

      expect(result.sessionParams).toEqual({ sessionId: "sess-resume" });
      expect(server.getSessionPosts()).toHaveLength(0); // resumed via GET, no create
      expect(server.getRunBody()?.session_id).toBe("sess-resume");
    } finally {
      await server.close();
    }
  });

  it("recreates a stale session id when the server no longer has it", async () => {
    const server = await createMockOpenSage(); // no existing sessions -> GET 404
    try {
      const result = await execute(
        buildContext({ baseUrl: server.baseUrl }, undefined, "stale"),
      );

      expect(server.getSessionPosts()).toEqual([{ session_id: "stale" }]); // recreated with same id
      expect(result.sessionParams).toEqual({ sessionId: "stale" });
    } finally {
      await server.close();
    }
  });

  it("honors a custom promptTemplate", async () => {
    const server = await createMockOpenSage();
    try {
      await execute(buildContext({ baseUrl: server.baseUrl, promptTemplate: "STATIC OVERRIDE" }));
      const prompt = server.getRunBody()?.new_message?.parts?.[0]?.text ?? "";
      expect(prompt).toContain("STATIC OVERRIDE"); // template overrides the task body
      expect(prompt).toContain("/tmp/ws-123"); // cwd note still appended around it
    } finally {
      await server.close();
    }
  });

  it("treats the stopped sentinel as an error but still persists the session", async () => {
    const server = await createMockOpenSage({
      events: [{ stopped: true, message: "Turn stopped by UI" }],
    });
    try {
      const result = await execute(buildContext({ baseUrl: server.baseUrl }));
      expect(result.exitCode).toBe(1);
      expect(result.errorMessage).toContain("stopped");
      expect(result.sessionParams).toEqual({ sessionId: "sess-1" });
    } finally {
      await server.close();
    }
  });

  it("returns a structured error (not a throw) when /run_sse fails", async () => {
    const server = await createMockOpenSage({ runStatus: 500 });
    try {
      const result = await execute(buildContext({ baseUrl: server.baseUrl }));
      expect(result.exitCode).toBe(1);
      expect(result.timedOut).toBe(false);
      expect(result.errorMessage).toContain("run_sse");
    } finally {
      await server.close();
    }
  });

  it("surfaces the /run_sse error sentinel as a failure", async () => {
    const server = await createMockOpenSage({ events: [{ error: "boom on the server" }] });
    try {
      const result = await execute(buildContext({ baseUrl: server.baseUrl }));
      expect(result.exitCode).toBe(1);
      expect(result.errorMessage).toContain("boom on the server");
    } finally {
      await server.close();
    }
  });

  it("injects the structured wake payload into the prompt", async () => {
    const server = await createMockOpenSage();
    try {
      await execute(
        buildContext({ baseUrl: server.baseUrl }, undefined, undefined, {
          paperclipWake: {
            reason: "issue_commented",
            issue: { identifier: "PAP-1", title: "Add add()" },
            comments: [{ body: "please add it" }],
            commentIds: ["c1"],
            latestCommentId: "c1",
          },
        }),
      );
      const prompt = server.getRunBody()?.new_message?.parts?.[0]?.text ?? "";
      expect(prompt).toContain("Paperclip Wake Payload"); // structured wake block
      expect(prompt).toContain("PAP-1"); // issue identifier
      expect(prompt).toContain("Add add(a, b) to calc.py"); // task body still present on a fresh run
    } finally {
      await server.close();
    }
  });

  it("uses a resume-delta prompt (task body suppressed) on a resumed session with a wake", async () => {
    const server = await createMockOpenSage({ existingSessionIds: ["sess-resume"] });
    try {
      await execute(
        buildContext({ baseUrl: server.baseUrl }, undefined, "sess-resume", {
          paperclipWake: {
            reason: "issue_commented",
            issue: { identifier: "PAP-1", title: "Add add()" },
            comments: [{ body: "follow up" }],
            commentIds: ["c2"],
            latestCommentId: "c2",
          },
        }),
      );
      const prompt = server.getRunBody()?.new_message?.parts?.[0]?.text ?? "";
      expect(prompt).toContain("Paperclip Resume Delta"); // resume-delta variant
      expect(prompt).not.toContain("Add add(a, b) to calc.py"); // full task body suppressed
      expect(prompt).toContain("/tmp/ws-123"); // cwd still present
    } finally {
      await server.close();
    }
  });
});

describe("opensage adapter testEnvironment", () => {
  it("passes and auto-detects the app when none is configured", async () => {
    const server = await createMockOpenSage();
    try {
      const result = await testEnvironment({
        companyId: "company-1",
        adapterType: "opensage",
        config: { baseUrl: server.baseUrl },
      });
      expect(result.status).toBe("pass");
      expect(result.checks.some((c) => c.code === "opensage_app_discovered")).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("passes when the explicitly configured app is served", async () => {
    const server = await createMockOpenSage();
    try {
      const result = await testEnvironment({
        companyId: "company-1",
        adapterType: "opensage",
        config: { baseUrl: server.baseUrl, appName: "agent" },
      });
      expect(result.status).toBe("pass");
      expect(result.checks.some((c) => c.code === "opensage_app_found")).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("fails on an invalid base URL", async () => {
    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "opensage",
      config: { baseUrl: "::::" },
    });
    expect(result.status).toBe("fail");
    expect(result.checks.some((c) => c.code === "opensage_base_url_invalid")).toBe(true);
  });
});

describe("opensage session codec", () => {
  it("round-trips only the session id", () => {
    expect(openSageSessionCodec.serialize({ sessionId: "s1", extra: 1 })).toEqual({ sessionId: "s1" });
    expect(openSageSessionCodec.deserialize({ sessionId: "s1" })).toEqual({ sessionId: "s1" });
    expect(openSageSessionCodec.getDisplayId?.({ sessionId: "s1" })).toBe("s1");
  });

  it("returns null for missing/invalid params", () => {
    expect(openSageSessionCodec.serialize(null)).toBeNull();
    expect(openSageSessionCodec.deserialize("nope")).toBeNull();
    expect(openSageSessionCodec.deserialize({})).toBeNull();
  });
});
