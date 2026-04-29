ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role_title" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verify_token_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verify_token_expires_at" timestamp with time zone;