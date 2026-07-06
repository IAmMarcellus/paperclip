CREATE TABLE IF NOT EXISTS "oversight_chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "role" text NOT NULL,
  "body" text NOT NULL,
  "actor_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oversight_chat_messages_created_idx" ON "oversight_chat_messages" USING btree ("created_at");
