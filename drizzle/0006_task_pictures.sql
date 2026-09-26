CREATE TABLE "task_picture" (
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
ALTER TABLE "task_picture" ADD CONSTRAINT "task_picture_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_picture_task_idx" ON "task_picture" USING btree ("task_id","added_at");