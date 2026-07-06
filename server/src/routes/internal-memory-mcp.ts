import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { companyMcpTokensService } from "../services/company-mcp-tokens.js";
import { tokenHashesMatch } from "../services/board-auth.js";

// memory-mcp resolves a per-company bearer token -> company id here. This is NOT behind the normal
// actor/session auth (memory-mcp presents a memory-mcp token, not a Paperclip session) — it validates
// the token itself via companyMcpTokens.resolve. GET = a safe method, so boardMutationGuard never acts.
// If PAPERCLIP_INTERNAL_TOKEN is set, also require a matching X-Internal-Token header (defense-in-depth
// for the tailnet-exposed server); otherwise rely on localhost binding.
export function internalMemoryMcpRoutes(db: Db) {
  const router = Router();
  const mcpTokens = companyMcpTokensService(db);
  const internalToken = (process.env.PAPERCLIP_INTERNAL_TOKEN ?? "").trim();

  router.get("/internal/memory-mcp/resolve", async (req, res) => {
    const unauthorized = () => res.status(401).json({ error: "unauthorized" });

    if (internalToken && !tokenHashesMatch((req.header("x-internal-token") ?? "").trim(), internalToken)) {
      return unauthorized();
    }
    const auth = req.header("authorization") ?? "";
    if (!auth.toLowerCase().startsWith("bearer ")) return unauthorized();

    const companyId = await mcpTokens.resolve(auth.slice("bearer ".length).trim());
    if (!companyId) return unauthorized();
    res.json({ company_id: companyId });
  });

  return router;
}
