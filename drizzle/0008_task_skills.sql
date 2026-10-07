CREATE TABLE "task_skill" (
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
CREATE TABLE "task_skill_label" (
	"skill_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"label_name" text NOT NULL,
	CONSTRAINT "task_skill_label_skill_id_label_name_pk" PRIMARY KEY("skill_id","label_name")
);
--> statement-breakpoint
CREATE TABLE "task_skill_revision" (
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
ALTER TABLE "task_skill_label" ADD CONSTRAINT "task_skill_label_skill_id_task_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."task_skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_skill_revision" ADD CONSTRAINT "task_skill_revision_skill_id_task_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."task_skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_skill_owner_name_idx" ON "task_skill" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "task_skill_label_owner_label_idx" ON "task_skill_label" USING btree ("owner_id","label_name");