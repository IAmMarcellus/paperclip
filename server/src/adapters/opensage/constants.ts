// Shared defaults for the OpenSage adapter (mergatriod's local orchestrator).
// Kept in their own module so index.ts and execute.ts/test.ts can both import
// them without creating an index <-> execute cycle.

/** The `opensage web` server started by the mergatriod Makefile `opensage` target. */
export const DEFAULT_OPENSAGE_BASE_URL = "http://localhost:8800";

/**
 * Fallback OpenSage ADK app name. OpenSage names the app after the PARENT folder of
 * its `--agent` path (mergatriod runs `--agent <repo>/agent`, so the app is the repo
 * dir name, "mergatriod" — not "agent"). The adapter normally auto-detects this from
 * the server's /list-apps; this constant is only used when discovery fails.
 */
export const DEFAULT_OPENSAGE_APP_NAME = "mergatriod";

/** Default per-turn wall-clock budget. OpenSage -> OpenCode -> local Qwen can be slow. */
export const DEFAULT_OPENSAGE_TIMEOUT_SEC = 900;
