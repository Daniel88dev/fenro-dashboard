CREATE TABLE "agent_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"secret_hash" text NOT NULL,
	"hint" text NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "agent_access_token_secret_hash_unique" UNIQUE("secret_hash")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"labels" text[] NOT NULL,
	"repository_owner" text,
	"repository_name" text,
	"parent_id" text,
	"criteria" jsonb NOT NULL,
	"hold_reason" text,
	"hold_since" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_external_reference" (
	"task_id" text NOT NULL,
	"system" text NOT NULL,
	"key" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"is_source" boolean NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "task_external_reference_task_id_system_key_pk" PRIMARY KEY("task_id","system","key")
);
--> statement-breakpoint
CREATE TABLE "task_journal_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"author_kind" text NOT NULL,
	"author_id" text NOT NULL,
	"author_name" text NOT NULL,
	"session_id" text,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_link" (
	"task_id" text NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	CONSTRAINT "task_link_task_id_kind_target_id_pk" PRIMARY KEY("task_id","kind","target_id")
);
--> statement-breakpoint
CREATE TABLE "task_session" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"number" integer NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"outcome" text
);
--> statement-breakpoint
ALTER TABLE "agent_access_token" ADD CONSTRAINT "agent_access_token_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_parent_id_task_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_external_reference" ADD CONSTRAINT "task_external_reference_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_journal_entry" ADD CONSTRAINT "task_journal_entry_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_link" ADD CONSTRAINT "task_link_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_link" ADD CONSTRAINT "task_link_target_id_task_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_session" ADD CONSTRAINT "task_session_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_access_token_owner_idx" ON "agent_access_token" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_owner_number_idx" ON "task" USING btree ("owner_id","number");--> statement-breakpoint
CREATE INDEX "task_owner_status_idx" ON "task" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "task_owner_repository_idx" ON "task" USING btree ("owner_id",lower("repository_owner"),lower("repository_name"));--> statement-breakpoint
CREATE INDEX "task_parent_idx" ON "task" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "task_external_reference_target_idx" ON "task_external_reference" USING btree ("system","key");--> statement-breakpoint
CREATE INDEX "task_journal_entry_task_idx" ON "task_journal_entry" USING btree ("task_id","recorded_at");--> statement-breakpoint
CREATE INDEX "task_link_target_idx" ON "task_link" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_session_number_idx" ON "task_session" USING btree ("task_id","number");