CREATE TYPE "public"."comment_status" AS ENUM('sent', 'read', 'replied');--> statement-breakpoint
CREATE TYPE "public"."shift" AS ENUM('DS1', 'DS2', 'NS');--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pi_id" uuid NOT NULL,
	"institution_id" uuid,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" "comment_status" DEFAULT 'sent' NOT NULL,
	"read_at" timestamp with time zone,
	"admin_reply" text,
	"admin_reply_by" uuid,
	"admin_reply_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fractional_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"pi_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"block_index" integer NOT NULL,
	"fractional_hours" numeric(5, 2) NOT NULL,
	"choice_1_date" date,
	"choice_2_date" date,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deficit_history" RENAME COLUMN "slot_key" TO "shift";--> statement-breakpoint
ALTER TABLE "preference_history" RENAME COLUMN "slot_key" TO "shift";--> statement-breakpoint
ALTER TABLE "preference_history" RENAME COLUMN "assignment_type" TO "assignment_reason";--> statement-breakpoint
ALTER TABLE "preferences" RENAME COLUMN "slot_key" TO "shift";--> statement-breakpoint
ALTER TABLE "schedule_assignments" RENAME COLUMN "shift_type" TO "shift";--> statement-breakpoint
ALTER TABLE "schedule_assignments" RENAME COLUMN "assignment_type" TO "assignment_reason";--> statement-breakpoint
ALTER TABLE "deficit_history" DROP CONSTRAINT "deficit_history_pi_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "preference_history" ADD COLUMN "institution_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "institution_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "run_analytics" ADD COLUMN "composite_score" numeric(6, 4);--> statement-breakpoint
ALTER TABLE "run_analytics" ADD COLUMN "engine_log" jsonb;--> statement-breakpoint
ALTER TABLE "run_analytics" ADD COLUMN "input_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD COLUMN "block_index" integer;--> statement-breakpoint
ALTER TABLE "schedule_assignments" ADD COLUMN "fractional_hours" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_pi_id_users_id_fk" FOREIGN KEY ("pi_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_admin_reply_by_users_id_fk" FOREIGN KEY ("admin_reply_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fractional_preferences" ADD CONSTRAINT "fractional_preferences_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fractional_preferences" ADD CONSTRAINT "fractional_preferences_pi_id_users_id_fk" FOREIGN KEY ("pi_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fractional_preferences" ADD CONSTRAINT "fractional_preferences_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_history" ADD CONSTRAINT "preference_history_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deficit_history" DROP COLUMN "pi_id";--> statement-breakpoint
ALTER TABLE "preferences" DROP COLUMN "shift_type";--> statement-breakpoint
ALTER TABLE "schedule_assignments" DROP COLUMN "slot_key";--> statement-breakpoint
DROP TYPE "public"."slot_key";--> statement-breakpoint
DROP TYPE "public"."shift_type";