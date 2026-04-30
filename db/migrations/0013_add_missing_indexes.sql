CREATE INDEX IF NOT EXISTS "audit_log_user_id_idx" ON "audit_log" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "available_dates_cycle_id_idx" ON "available_dates" ("cycle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "master_shares_institution_id_idx" ON "master_shares" ("institution_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "master_shares_pi_id_idx" ON "master_shares" ("pi_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedules_cycle_id_idx" ON "schedules" ("cycle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_assignments_pi_id_idx" ON "schedule_assignments" ("pi_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_assignments_institution_id_idx" ON "schedule_assignments" ("institution_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_pi_id_idx" ON "comments" ("pi_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cycle_shares_institution_id_idx" ON "cycle_shares" ("institution_id");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_trgm_idx" ON "users" USING gin ("email" gin_trgm_ops);
