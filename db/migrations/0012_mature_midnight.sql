ALTER TABLE "swap_requests" ALTER COLUMN "preferred_dates" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "shift_timing_overrides" text;--> statement-breakpoint
CREATE INDEX "audit_log_user_id_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "available_dates_cycle_id_idx" ON "available_dates" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "comments_pi_id_idx" ON "comments" USING btree ("pi_id");--> statement-breakpoint
CREATE INDEX "cycle_shares_institution_id_idx" ON "cycle_shares" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "master_shares_institution_id_idx" ON "master_shares" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "master_shares_pi_id_idx" ON "master_shares" USING btree ("pi_id");--> statement-breakpoint
CREATE INDEX "schedule_assignments_pi_id_idx" ON "schedule_assignments" USING btree ("pi_id");--> statement-breakpoint
CREATE INDEX "schedule_assignments_institution_id_idx" ON "schedule_assignments" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "schedules_cycle_id_idx" ON "schedules" USING btree ("cycle_id");