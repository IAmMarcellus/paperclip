import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

// Company-less standing thread for the <REDACTED_ORG> instance-wide oversight chat ("Mergatroid").
// Deliberately NOT issue-backed: issues / issue_comments are companyId NOT NULL, but this conversation
// spans the whole instance (the umbrella over every company). `role` is 'user' | 'assistant'; the
// assistant turns are Mergatroid's persisted replies. Mirrors the durable decision-log behaviour of
// the per-company board chat (which uses a "Board Operations" issue) without a company anchor.
export const oversightChatMessages = pgTable(
  "oversight_chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: text("role").notNull(),
    body: text("body").notNull(),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    createdIdx: index("oversight_chat_messages_created_idx").on(table.createdAt),
  }),
);
