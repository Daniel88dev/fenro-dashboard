CREATE TABLE "fenro"."task_questionnaire" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"task_id" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"intro" text,
	"status" text NOT NULL,
	"questions" jsonb NOT NULL,
	"answers" jsonb,
	"question_count" integer NOT NULL,
	"answered_count" integer DEFAULT 0 NOT NULL,
	"posted_by_kind" text NOT NULL,
	"posted_by_id" text NOT NULL,
	"posted_by_name" text NOT NULL,
	"session_id" text,
	"posted_at" timestamp with time zone NOT NULL,
	"answered_by_kind" text,
	"answered_by_id" text,
	"answered_by_name" text,
	"answered_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_reason" text,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fenro"."task_questionnaire_picture" (
	"questionnaire_id" text NOT NULL,
	"picture_id" text NOT NULL,
	"question_id" text NOT NULL,
	"option_id" text,
	"role" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "task_questionnaire_picture_questionnaire_id_picture_id_pk" PRIMARY KEY("questionnaire_id","picture_id")
);
--> statement-breakpoint
ALTER TABLE "fenro"."task_questionnaire" ADD CONSTRAINT "task_questionnaire_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "fenro"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."task_questionnaire_picture" ADD CONSTRAINT "task_questionnaire_picture_questionnaire_id_task_questionnaire_id_fk" FOREIGN KEY ("questionnaire_id") REFERENCES "fenro"."task_questionnaire"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."task_questionnaire_picture" ADD CONSTRAINT "task_questionnaire_picture_picture_id_task_picture_id_fk" FOREIGN KEY ("picture_id") REFERENCES "fenro"."task_picture"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_questionnaire_number_idx" ON "fenro"."task_questionnaire" USING btree ("task_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "task_questionnaire_open_idx" ON "fenro"."task_questionnaire" USING btree ("task_id") WHERE "fenro"."task_questionnaire"."status" = 'open';--> statement-breakpoint
CREATE INDEX "task_questionnaire_owner_open_idx" ON "fenro"."task_questionnaire" USING btree ("owner_id") WHERE "fenro"."task_questionnaire"."status" = 'open';--> statement-breakpoint
CREATE INDEX "task_questionnaire_picture_picture_idx" ON "fenro"."task_questionnaire_picture" USING btree ("picture_id");