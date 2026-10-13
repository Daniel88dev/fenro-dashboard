CREATE SCHEMA "fenro";
--> statement-breakpoint
CREATE TABLE "fenro"."github_issue" (
	"repository_id" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"labels" text[] NOT NULL,
	"assignees" text[] NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "github_issue_repository_id_number_pk" PRIMARY KEY("repository_id","number")
);
--> statement-breakpoint
CREATE TABLE "fenro"."github_pull_request" (
	"repository_id" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"is_draft" boolean NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"review_decision" text,
	"requested_reviewers" text[] NOT NULL,
	"approved_by" text[] NOT NULL,
	"changes_requested_by" text[] NOT NULL,
	"head_sha" text,
	"check_rollup" text NOT NULL,
	"checks" jsonb NOT NULL,
	CONSTRAINT "github_pull_request_repository_id_number_pk" PRIMARY KEY("repository_id","number")
);
--> statement-breakpoint
CREATE TABLE "fenro"."github_repository_snapshot" (
	"repository_id" text PRIMARY KEY NOT NULL,
	"open_pull_requests" integer NOT NULL,
	"open_issues" integer NOT NULL,
	"last_activity_at" timestamp with time zone,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fenro"."github_watched_repository" (
	"id" text PRIMARY KEY NOT NULL,
	"watcher_id" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"watched_at" timestamp with time zone NOT NULL,
	"source" text DEFAULT 'github' NOT NULL,
	"pinned_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"last_sync_attempted_at" timestamp with time zone,
	"last_sync_failure" text,
	"last_sync_failure_kind" text,
	"sync_started_at" timestamp with time zone,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fenro"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fenro"."agent_access_token" (
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
CREATE TABLE "fenro"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "fenro"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"github_login" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "fenro"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fenro"."task" (
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
CREATE TABLE "fenro"."task_external_reference" (
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
CREATE TABLE "fenro"."task_journal_entry" (
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
CREATE TABLE "fenro"."task_label" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"colour" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fenro"."task_link" (
	"task_id" text NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	CONSTRAINT "task_link_task_id_kind_target_id_pk" PRIMARY KEY("task_id","kind","target_id")
);
--> statement-breakpoint
CREATE TABLE "fenro"."task_picture" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"task_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"added_by_kind" text NOT NULL,
	"added_by_id" text NOT NULL,
	"added_by_name" text NOT NULL,
	"session_id" text,
	"added_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fenro"."task_session" (
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
CREATE TABLE "fenro"."task_skill" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"revision" integer NOT NULL,
	"created_by_kind" text NOT NULL,
	"created_by_id" text NOT NULL,
	"created_by_name" text NOT NULL,
	"updated_by_kind" text NOT NULL,
	"updated_by_id" text NOT NULL,
	"updated_by_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fenro"."task_skill_label" (
	"skill_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"label_name" text NOT NULL,
	CONSTRAINT "task_skill_label_skill_id_label_name_pk" PRIMARY KEY("skill_id","label_name")
);
--> statement-breakpoint
CREATE TABLE "fenro"."task_skill_revision" (
	"skill_id" text NOT NULL,
	"revision" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"by_kind" text NOT NULL,
	"by_id" text NOT NULL,
	"by_name" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "task_skill_revision_skill_id_revision_pk" PRIMARY KEY("skill_id","revision")
);
--> statement-breakpoint
ALTER TABLE "fenro"."github_issue" ADD CONSTRAINT "github_issue_repository_id_github_watched_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "fenro"."github_watched_repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."github_pull_request" ADD CONSTRAINT "github_pull_request_repository_id_github_watched_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "fenro"."github_watched_repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."github_repository_snapshot" ADD CONSTRAINT "github_repository_snapshot_repository_id_github_watched_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "fenro"."github_watched_repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "fenro"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."agent_access_token" ADD CONSTRAINT "agent_access_token_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "fenro"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "fenro"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."task" ADD CONSTRAINT "task_parent_id_task_id_fk" FOREIGN KEY ("parent_id") REFERENCES "fenro"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."task_external_reference" ADD CONSTRAINT "task_external_reference_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "fenro"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."task_journal_entry" ADD CONSTRAINT "task_journal_entry_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "fenro"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."task_link" ADD CONSTRAINT "task_link_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "fenro"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."task_link" ADD CONSTRAINT "task_link_target_id_task_id_fk" FOREIGN KEY ("target_id") REFERENCES "fenro"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."task_picture" ADD CONSTRAINT "task_picture_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "fenro"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."task_session" ADD CONSTRAINT "task_session_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "fenro"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."task_skill_label" ADD CONSTRAINT "task_skill_label_skill_id_task_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "fenro"."task_skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."task_skill_revision" ADD CONSTRAINT "task_skill_revision_skill_id_task_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "fenro"."task_skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_watched_repository_watcher_repository_idx" ON "fenro"."github_watched_repository" USING btree ("watcher_id",lower("owner"),lower("name"));--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "fenro"."account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_idx" ON "fenro"."account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "agent_access_token_owner_idx" ON "fenro"."agent_access_token" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "fenro"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "fenro"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "task_owner_number_idx" ON "fenro"."task" USING btree ("owner_id","number");--> statement-breakpoint
CREATE INDEX "task_owner_status_idx" ON "fenro"."task" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "task_owner_repository_idx" ON "fenro"."task" USING btree ("owner_id",lower("repository_owner"),lower("repository_name"));--> statement-breakpoint
CREATE INDEX "task_parent_idx" ON "fenro"."task" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "task_external_reference_target_idx" ON "fenro"."task_external_reference" USING btree ("system","key");--> statement-breakpoint
CREATE INDEX "task_journal_entry_task_idx" ON "fenro"."task_journal_entry" USING btree ("task_id","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_label_owner_name_idx" ON "fenro"."task_label" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "task_link_target_idx" ON "fenro"."task_link" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "task_picture_task_idx" ON "fenro"."task_picture" USING btree ("task_id","added_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_session_number_idx" ON "fenro"."task_session" USING btree ("task_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "task_skill_owner_name_idx" ON "fenro"."task_skill" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "task_skill_label_owner_label_idx" ON "fenro"."task_skill_label" USING btree ("owner_id","label_name");