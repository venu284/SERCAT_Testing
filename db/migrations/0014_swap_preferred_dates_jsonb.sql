ALTER TABLE "swap_requests" ALTER COLUMN "preferred_dates" TYPE jsonb USING "preferred_dates"::jsonb;
