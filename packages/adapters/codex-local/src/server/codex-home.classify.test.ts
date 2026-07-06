import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyConfiguredCodexHome } from "./codex-home.js";

const MANAGED = "/home/user/.paperclip/instances/default/companies/co-1/agents/ag-1/codex-home";

describe("classifyConfiguredCodexHome", () => {
  it("injects MCP env for a per-agent managed CODEX_HOME (the regression case)", () => {
    // A codex_local agent whose configured CODEX_HOME equals the per-agent
    // managed home. It is NOT user-managed (the provider merge may run), but its
    // MCP env tables STILL need injection — codex never forwards the process env.
    const result = classifyConfiguredCodexHome({
      configuredCodexHome: MANAGED,
      managedAgentHome: MANAGED,
    });
    expect(result.isPaperclipManaged).toBe(true);
    expect(result.userManagedCodexHome).toBeNull();
    expect(result.mcpEnvInjectionHome).toBe(MANAGED);
  });

  it("classifies a distinct user-managed CODEX_HOME for both merge-skip and injection", () => {
    const userHome = "/home/user/custom-codex-home";
    const result = classifyConfiguredCodexHome({
      configuredCodexHome: userHome,
      managedAgentHome: MANAGED,
    });
    expect(result.isPaperclipManaged).toBe(false);
    expect(result.userManagedCodexHome).toBe(userHome);
    expect(result.mcpEnvInjectionHome).toBe(userHome);
  });

  it("does nothing when no CODEX_HOME is configured (default shared managed home)", () => {
    const result = classifyConfiguredCodexHome({
      configuredCodexHome: null,
      managedAgentHome: MANAGED,
    });
    expect(result.isPaperclipManaged).toBe(false);
    expect(result.userManagedCodexHome).toBeNull();
    expect(result.mcpEnvInjectionHome).toBeNull();
  });

  it("normalizes paths when matching the managed home", () => {
    // A non-normalized but equivalent path still resolves to the managed home.
    const messy = path.join(MANAGED, "..", "codex-home");
    const result = classifyConfiguredCodexHome({
      configuredCodexHome: messy,
      managedAgentHome: MANAGED,
    });
    expect(result.isPaperclipManaged).toBe(true);
    expect(result.userManagedCodexHome).toBeNull();
    // Injection still targets the configured path verbatim.
    expect(result.mcpEnvInjectionHome).toBe(messy);
  });
});
