CREATE TYPE "public"."message_role" AS ENUM('pi', 'admin');--> statement-breakpoint
ALTER TYPE "public"."comment_status" ADD VALUE 'resolved';--> statement-breakpoint
CREATE TABLE "comment_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_admin_reply_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comment_messages" ADD CONSTRAINT "comment_messages_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_messages" ADD CONSTRAINT "comment_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "message";--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "admin_reply";--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "admin_reply_by";--> statement-breakpoint
ALTER TABLE "comments" DROP COLUMN "admin_reply_at";