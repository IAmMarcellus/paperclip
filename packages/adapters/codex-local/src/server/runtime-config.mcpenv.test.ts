import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareCodexMcpEnvInjection } from "./runtime-config.js";

const cleanupPaths = new Set<string>();

afterEach(async () => {
  await Promise.all(
    [...cleanupPaths].map(async (filepath) => {
      await fs.rm(filepath, { recursive: true, force: true });
      cleanupPaths.delete(filepath);
    }),
  );
});

async function makeCodexHome(configToml?: string): Promise<string> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-codex-mcpenv-"));
  cleanupPaths.add(home);
  if (configToml !== undefined) {
    await fs.writeFile(path.join(home, "config.toml"), configToml, "utf8");
  }
  return home;
}

async function readConfig(home: string): Promise<string> {
  return fs.readFile(path.join(home, "config.toml"), "utf8");
}

const USER_CONFIG = `[projects."/home/marcellus/Projects/AlgoCryptoTradingBot"]
trust_level = "trusted"

# user comment that must survive
[mcp_servers.paper-trading]
command = "/venv/bin/paper-trading-mcp"
args = []
startup_timeout_sec = 30

[mcp_servers.paper-trading.env]
TRADE_MODE = "live"
PAPER_TRADING_ACTOR = "risk-governor"
`;

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("prepareCodexMcpEnvInjection", () => {
  it("injects adapterConfig.env into the mcp env table, preserves user-only keys, overrides overlaps, and restores on cleanup", async () => {
    const home = await makeCodexHome(USER_CONFIG);
    const prepared = await prepareCodexMcpEnvInjection({
      codexHome: home,
      env: {
        PERMIT_HMAC_SECRET: "s3cr3t",
        KRAKEN_API_KEY_PLAIN: "kkey",
        TRADE_MODE: "paper", // overlaps a user key -> injected value wins, exactly once
        CODEX_HOME: "/should/not/leak",
        OPENAI_API_KEY: "sk-should-not-leak",
        PAPERCLIP_API_KEY: "pc-should-not-leak",
      },
    });

    const merged = await readConfig(home);
    // injected secrets present
    expect(merged).toContain("[mcp_servers.paper-trading.env]");
    expect(merged).toContain('PERMIT_HMAC_SECRET = "s3cr3t"');
    expect(merged).toContain('KRAKEN_API_KEY_PLAIN = "kkey"');
    // user-only key preserved
    expect(merged).toContain('PAPER_TRADING_ACTOR = "risk-governor"');
    // overlapping key overridden, present exactly once
    expect(merged).toContain('TRADE_MODE = "paper"');
    expect(countOccurrences(merged, "TRADE_MODE =")).toBe(1);
    expect(merged).not.toContain('TRADE_MODE = "live"');
    // reserved keys never injected
    expect(merged).not.toContain("CODEX_HOME =");
    expect(merged).not.toContain("OPENAI_API_KEY =");
    expect(merged).not.toContain("PAPERCLIP_API_KEY =");
    // unrelated content preserved
    expect(merged).toContain("# user comment that must survive");
    expect(merged).toContain('[projects."/home/marcellus/Projects/AlgoCryptoTradingBot"]');
    expect(merged).toContain('command = "/venv/bin/paper-trading-mcp"');
    // exactly one env table for the server (no duplicate -> would be a TOML error)
    expect(countOccurrences(merged, "[mcp_servers.paper-trading.env]")).toBe(1);
    expect(prepared.notes.some((n) => n.includes("Injected adapterConfig.env"))).toBe(true);

    await prepared.cleanup();
    expect(await readConfig(home)).toBe(USER_CONFIG);
    await expect(fs.access(path.join(home, "config.toml.paperclip-mcpenv-backup"))).rejects.toThrow();
  });

  it("is idempotent across runs and restores the pristine original", async () => {
    const home = await makeCodexHome(USER_CONFIG);
    const env = { PERMIT_HMAC_SECRET: "s3cr3t", TRADE_MODE: "live" };
    const first = await prepareCodexMcpEnvInjection({ codexHome: home, env });
    const afterFirst = await readConfig(home);
    await first.cleanup();
    const second = await prepareCodexMcpEnvInjection({ codexHome: home, env });
    expect(await readConfig(home)).toBe(afterFirst); // same bytes both runs
    await second.cleanup();
    expect(await readConfig(home)).toBe(USER_CONFIG);
  });

  it("no-ops when the config has no mcp servers", async () => {
    const config = 'model = "gpt-5.5"\n';
    const home = await makeCodexHome(config);
    const prepared = await prepareCodexMcpEnvInjection({ codexHome: home, env: { PERMIT_HMAC_SECRET: "x" } });
    expect(await readConfig(home)).toBe(config);
    await prepared.cleanup();
    expect(await readConfig(home)).toBe(config);
  });

  it("no-ops when only reserved keys are supplied", async () => {
    const home = await makeCodexHome(USER_CONFIG);
    const prepared = await prepareCodexMcpEnvInjection({
      codexHome: home,
      env: { CODEX_HOME: "/x", OPENAI_API_KEY: "y", PAPERCLIP_API_KEY: "z" },
    });
    expect(await readConfig(home)).toBe(USER_CONFIG);
    await prepared.cleanup();
    expect(await readConfig(home)).toBe(USER_CONFIG);
  });

  it("skips a server that uses an inline env table and flags it", async () => {
    const inlineConfig = `[mcp_servers.inline]
command = "x"
args = []
env = { TRADE_MODE = "live" }
`;
    const home = await makeCodexHome(inlineConfig);
    const prepared = await prepareCodexMcpEnvInjection({ codexHome: home, env: { PERMIT_HMAC_SECRET: "x" } });
    expect(await readConfig(home)).toBe(inlineConfig); // untouched
    expect(prepared.notes.some((n) => n.includes("inline env table"))).toBe(true);
    await prepared.cleanup();
  });

  it("injects into multiple mcp servers", async () => {
    const config = `[mcp_servers.a]
command = "a"
args = []

[mcp_servers.b]
command = "b"
args = []

[mcp_servers.b.env]
B_ONLY = "1"
`;
    const home = await makeCodexHome(config);
    const prepared = await prepareCodexMcpEnvInjection({ codexHome: home, env: { SHARED: "v" } });
    const merged = await readConfig(home);
    expect(merged).toContain("[mcp_servers.a.env]");
    expect(merged).toContain("[mcp_servers.b.env]");
    expect(countOccurrences(merged, 'SHARED = "v"')).toBe(2);
    expect(merged).toContain('B_ONLY = "1"'); // preserved
    await prepared.cleanup();
    expect(await readConfig(home)).toBe(config);
  });

  it("self-heals a leftover backup from an interrupted run", async () => {
    const home = await makeCodexHome("DIRTY-managed-content-from-crashed-run\n");
    // simulate a pre-run backup left behind because cleanup never ran
    await fs.writeFile(path.join(home, "config.toml.paperclip-mcpenv-backup"), USER_CONFIG, "utf8");
    const prepared = await prepareCodexMcpEnvInjection({ codexHome: home, env: { PERMIT_HMAC_SECRET: "x" } });
    // base for the new injection is the pristine backup, not the dirty file
    const merged = await readConfig(home);
    expect(merged).toContain("# user comment that must survive");
    expect(merged).toContain('PERMIT_HMAC_SECRET = "x"');
    expect(merged).not.toContain("DIRTY-managed-content");
    await prepared.cleanup();
    expect(await readConfig(home)).toBe(USER_CONFIG); // restored to the true original
  });
});
