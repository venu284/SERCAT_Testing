import { pgTable, uuid, decimal, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { schedules } from './schedules.js';

export const runAnalytics = pgTable('run_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  scheduleId: uuid('schedule_id').notNull().references(() => schedules.id),
  totalFirstChoicePct: decimal('total_first_choice_pct', { precision: 5, scale: 2 }),
  totalSecondChoicePct: decimal('total_second_choice_pct', { precision: 5, scale: 2 }),
  totalFallbackPct: decimal('total_fallback_pct', { precision: 5, scale: 2 }),
  compositeScore: decimal('composite_score', { precision: 6, scale: 4 }),
  fairnessStdDeviation: decimal('fairness_std_deviation', { precision: 10, scale: 4 }),
  manualAdjustmentsCount: integer('manual_adjustments_count').notNull().default(0),
  piSatisfactionScores: jsonb('pi_satisfaction_scores'),
  engineLog: jsonb('engine_log'),
  inputSnapshot: jsonb('input_snapshot'),
  detectedPatterns: jsonb('detected_patterns'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
