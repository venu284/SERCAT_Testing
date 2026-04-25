CREATE INDEX IF NOT EXISTS "preferences_cycle_id_pi_id_idx" ON "preferences" ("cycle_id","pi_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fractional_preferences_cycle_id_pi_id_idx" ON "fractional_preferences" ("cycle_id","pi_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "swap_requests_requester_id_idx" ON "swap_requests" ("requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "swap_requests_schedule_id_status_idx" ON "swap_requests" ("schedule_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cycle_shares_cycle_id_idx" ON "cycle_shares" ("cycle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cycle_shares_pi_id_idx" ON "cycle_shares" ("pi_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_assignments_schedule_id_idx" ON "schedule_assignments" ("schedule_id");
