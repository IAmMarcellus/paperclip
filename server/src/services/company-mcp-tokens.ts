import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companyMcpTokens } from "@paperclipai/db";
import { hashBearerToken } from "./board-auth.js";

// Per-company tokens for the mergatriod memory-mcp server: same `pcp_` format as agent/board API keys,
// hashed via board-auth's shared hashBearerToken (single-sourced contract). Plaintext shown once.
function createToken(): string {
  return `pcp_${randomBytes(24).toString("hex")}`;
}

export function companyMcpTokensService(db: Db) {
  return {
    // Mint a fresh token for a company (rotate semantics: revoke any active one, then insert a new one).
    mintForCompany: async (companyId: string, name = "memory-mcp"): Promise<{ token: string }> => {
      const now = new Date();
      await db
        .update(companyMcpTokens)
        .set({ status: "revoked", revokedAt: now, updatedAt: now })
        .where(and(eq(companyMcpTokens.companyId, companyId), eq(companyMcpTokens.status, "active")));
      const token = createToken();
      await db.insert(companyMcpTokens).values({
        companyId,
        name,
        tokenHash: hashBearerToken(token),
        status: "active",
      });
      return { token };
    },

    // Resolve a presented bearer token to its company id (active + not revoked); null otherwise.
    resolve: async (token: string): Promise<string | null> => {
      const row = await db
        .select({ id: companyMcpTokens.id, companyId: companyMcpTokens.companyId })
        .from(companyMcpTokens)
        .where(
          and(
            eq(companyMcpTokens.tokenHash, hashBearerToken(token)),
            eq(companyMcpTokens.status, "active"),
            isNull(companyMcpTokens.revokedAt),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!row) return null;
      await db
        .update(companyMcpTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(companyMcpTokens.id, row.id));
      return row.companyId;
    },
  };
}
