import { desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { oversightChatMessages } from "@paperclipai/db";

/**
 * Durable thread for the <REDACTED_ORG> instance-wide oversight chat ("Mergatroid").
 *
 * The per-company board chat anchors its conversation + decision log on a "Board Operations" issue,
 * but issues are companyId NOT NULL — the oversight chat spans the whole instance, so it persists to
 * its own company-less table instead (see schema `oversight_chat_messages`). Same role model:
 * `user` turns are the operator, `assistant` turns are Mergatroid's persisted replies.
 */
export function oversightChatService(db: Db) {
  return {
    // The most-recent `limit` turns, returned oldest-first (chronological) for prompt assembly and
    // rendering. Mirrors the board chat's `comments.slice(-20)` windowing.
    list: async (limit = 50) => {
      const rows = await db
        .select()
        .from(oversightChatMessages)
        .orderBy(desc(oversightChatMessages.createdAt))
        .limit(limit);
      return rows.reverse();
    },

    append: async (role: "user" | "assistant", body: string, actorId?: string | null) => {
      const [row] = await db
        .insert(oversightChatMessages)
        .values({ role, body, actorId: actorId ?? null })
        .returning();
      return row;
    },
  };
}
