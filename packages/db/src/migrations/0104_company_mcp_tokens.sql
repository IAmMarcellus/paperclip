CREATE TABLE IF NOT EXISTS "company_mcp_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text DEFAULT 'memory-mcp' NOT NULL,
  "token_hash" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_mcp_tokens" ADD CONSTRAINT "company_mcp_tokens_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_mcp_tokens_token_hash_idx" ON "company_mcp_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_mcp_tokens_company_idx" ON "company_mcp_tokens" USING btree ("company_id");
