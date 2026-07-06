import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

// Per-company bearer token for the mergatriod memory-mcp server. Stored as a SHA-256 hash (like
// agent_api_keys); the plaintext is shown once at company-create. memory-mcp resolves token -> company
// live via GET /api/internal/memory-mcp/resolve. Cascade-deleted with the company.
export const companyMcpTokens = pgTable(
  "company_mcp_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("memory-mcp"),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: index("company_mcp_tokens_token_hash_idx").on(table.tokenHash),
    companyIdx: index("company_mcp_tokens_company_idx").on(table.companyId),
  }),
);
