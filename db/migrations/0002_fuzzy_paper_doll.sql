ALTER TABLE "schedule_assignments" ADD COLUMN "assignment_type" text DEFAULT 'AUTO_ASSIGNED' NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD COLUMN "hours" numeric(5, 2) DEFAULT '6' NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD COLUMN "is_shared" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD COLUMN "shared_with_pi_id" uuid;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_shared_with_pi_id_users_id_fk" FOREIGN KEY ("shared_with_pi_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;