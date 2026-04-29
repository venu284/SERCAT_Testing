ALTER TYPE "public"."comment_status" ADD VALUE 'resolved';
--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('pi', 'admin');
--> statement-breakpoint
CREATE TABLE "comment_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comment_messages" ADD CONSTRAINT "comment_messages_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "comment_messages" ADD CONSTRAINT "comment_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "comment_messages" ("comment_id", "author_id", "role", "body", "created_at")
SELECT "id", "pi_id", 'pi', "message", "created_at"
FROM "comments"
WHERE "message" IS NOT NULL AND "message" != '';
--> statement-breakpoint
INSERT INTO "comment_messages" ("comment_id", "author_id", "role", "body", "created_at")
SELECT "id", "admin_reply_by", 'admin', "admin_reply", COALESCE("admin_reply_at", "updated_at")
FROM "comments"
WHERE "admin_reply" IS NOT NULL AND "admin_reply" != '' AND "admin_reply_by" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "message";
--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "admin_reply";
--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "admin_reply_by";
--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "admin_reply_at";
