ALTER TABLE "preference_history" ADD COLUMN "share_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "preference_history" ADD COLUMN "assignment_type" text;