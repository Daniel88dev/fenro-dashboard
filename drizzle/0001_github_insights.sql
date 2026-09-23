CREATE TABLE "github_issue" (
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
CREATE TABLE "github_pull_request" (
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
CREATE TABLE "github_repository_snapshot" (
	"repository_id" text PRIMARY KEY NOT NULL,
	"open_pull_requests" integer NOT NULL,
	"open_issues" integer NOT NULL,
	"last_activity_at" timestamp with time zone,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_watched_repository" (
	"id" text PRIMARY KEY NOT NULL,
	"watcher_id" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"watched_at" timestamp with time zone NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_attempted_at" timestamp with time zone,
	"last_sync_failure" text,
	"sync_started_at" timestamp with time zone,
	"version" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_issue" ADD CONSTRAINT "github_issue_repository_id_github_watched_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_watched_repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_pull_request" ADD CONSTRAINT "github_pull_request_repository_id_github_watched_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_watched_repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repository_snapshot" ADD CONSTRAINT "github_repository_snapshot_repository_id_github_watched_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_watched_repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_watched_repository_watcher_repository_idx" ON "github_watched_repository" USING btree ("watcher_id",lower("owner"),lower("name"));