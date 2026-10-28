ALTER TABLE "fenro"."task" ADD COLUMN "assignee_id" text;--> statement-breakpoint
ALTER TABLE "fenro"."task" ADD COLUMN "assignee_login" text;--> statement-breakpoint
CREATE INDEX "task_owner_assignee_idx" ON "fenro"."task" USING btree ("owner_id","assignee_id");