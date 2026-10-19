CREATE TABLE "fenro"."user_group" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fenro"."group_invitation" (
	"group_id" text NOT NULL,
	"login" text NOT NULL,
	"invited_by_id" text NOT NULL,
	"invited_by_login" text NOT NULL,
	"invited_at" timestamp with time zone NOT NULL,
	CONSTRAINT "group_invitation_group_id_login_pk" PRIMARY KEY("group_id","login")
);
--> statement-breakpoint
CREATE TABLE "fenro"."group_member" (
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"login" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	CONSTRAINT "group_member_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "fenro"."task" ADD COLUMN "key_prefix" text DEFAULT 'T' NOT NULL;--> statement-breakpoint
ALTER TABLE "fenro"."group_invitation" ADD CONSTRAINT "group_invitation_group_id_user_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "fenro"."user_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fenro"."group_member" ADD CONSTRAINT "group_member_group_id_user_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "fenro"."user_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_group_key_prefix_idx" ON "fenro"."user_group" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "group_invitation_login_idx" ON "fenro"."group_invitation" USING btree (lower("login"));--> statement-breakpoint
CREATE INDEX "group_member_user_idx" ON "fenro"."group_member" USING btree ("user_id");