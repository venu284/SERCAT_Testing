import { z } from 'zod';
import { configSchema } from './config.js';

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const shiftSchema = z.enum(['DS1', 'DS2', 'NS']);
const assignmentReasonSchema = z.enum([
  'choice1',
  'choice1_no_conflict',
  'choice2',
  'fallback_proximity',
  'fallback_any',
  'auto_assigned',
  'fractional_packed',
  'manual_override',
]);

const shareSchema = z.object({
  piId: z.string(),
  institutionId: z.string(),
  institutionAbbreviation: z.string().optional(),
  memberId: z.string().optional(),
  wholeShares: z.number().min(0),
  fractionalShares: z.number().min(0),
  isActive: z.boolean().optional(),
}).passthrough();

const preferenceSchema = z.object({
  piId: z.string(),
  institutionId: z.string(),
  memberId: z.string().optional(),
  shareIndex: z.number().int().min(1),
  shift: shiftSchema,
  choice1Date: dateStringSchema.nullish().transform((value) => value || ''),
  choice2Date: dateStringSchema.nullish().transform((value) => value || ''),
}).passthrough();

const fractionalPreferenceSchema = z.object({
  piId: z.string(),
  institutionId: z.string(),
  memberId: z.string().optional(),
  blockIndex: z.number().int().min(1).optional(),
  fractionalHours: z.number().positive().max(6),
  choice1Date: dateStringSchema.nullish().transform((value) => value || ''),
  choice2Date: dateStringSchema.nullish().transform((value) => value || ''),
}).passthrough();

const deficitHistorySchema = z.object({
  institutionId: z.string(),
  shift: shiftSchema,
  deficitScore: z.number(),
  cycleAge: z.number().int().min(0),
}).passthrough();

const preferenceHistorySchema = z.object({
  institutionId: z.string(),
  piId: z.string(),
  cycleId: z.string(),
  shareIndex: z.number().int().min(0).optional(),
  shift: shiftSchema,
  choice1Date: dateStringSchema.nullish().transform((value) => value || ''),
  choice2Date: dateStringSchema.nullish().transform((value) => value || ''),
  assignedDate: dateStringSchema.nullish().transform((value) => value || ''),
  choiceRank: z.number().int().nullable().optional(),
  assignmentReason: z.string().nullable().optional(),
}).passthrough();

const pastAssignmentSchema = z.object({
  institutionId: z.string(),
  piId: z.string(),
  cycleId: z.string(),
  shareIndex: z.number().int().min(0).optional(),
  shift: shiftSchema,
  assignedDate: dateStringSchema,
  wasManualOverride: z.boolean().default(false),
}).passthrough();

const previousDraftSchema = z.object({
  assignments: z.array(z.object({
    piId: z.string().optional(),
    institutionId: z.string().optional(),
    memberId: z.string().optional(),
    assignedDate: dateStringSchema.optional(),
    shift: shiftSchema.optional(),
    assignmentReason: assignmentReasonSchema.optional(),
  }).passthrough()),
  satisfaction: z.array(z.object({
    institutionId: z.string(),
    averageSatisfaction: z.number().optional(),
    score: z.number().optional(),
  }).passthrough()).optional(),
  fairnessMetrics: z.object({
    overallStdDev: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();

export const EngineInputSchema = z.object({
  shares: z.array(shareSchema),
  preferences: z.array(preferenceSchema),
  fractionalPreferences: z.array(fractionalPreferenceSchema).default([]),
  availableDates: z.array(dateStringSchema),
  blockedSlots: z.array(z.string()).default([]),
  deficitHistory: z.array(deficitHistorySchema),
  preferenceHistory: z.array(preferenceHistorySchema),
  pastAssignments: z.array(pastAssignmentSchema),
  config: configSchema,
  previousDraft: previousDraftSchema.nullable(),
  cycleDates: z.object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    blockedDates: z.array(dateStringSchema).default([]),
  }).passthrough(),
}).passthrough();

const engineAssignmentSchema = z.object({
  piId: z.string(),
  institutionId: z.string(),
  memberId: z.string(),
  shareIndex: z.number().int().min(0),
  blockIndex: z.number().int().min(1).nullable().optional(),
  shift: shiftSchema,
  assignedDate: dateStringSchema,
  choiceRank: z.number().int().nullable(),
  assignmentReason: assignmentReasonSchema,
  hours: z.number().positive(),
  fractionalHours: z.number().nullable().optional(),
  isShared: z.boolean(),
  sharedWith: z.string().nullable(),
  coAssignments: z.array(z.object({
    institutionId: z.string(),
    memberId: z.string().optional(),
    hours: z.number().positive(),
  })).nullable().optional(),
}).passthrough();

export const EngineOutputSchema = z.object({
  assignments: z.array(engineAssignmentSchema),
  deficitUpdates: z.array(z.object({
    institutionId: z.string(),
    shift: shiftSchema,
    newDeficitScore: z.number(),
  })),
  satisfaction: z.array(z.object({
    institutionId: z.string(),
    memberId: z.string(),
    score: z.number().optional(),
    averageSatisfaction: z.number(),
    breakdown: z.record(z.string(), z.any()).optional(),
  }).passthrough()),
  fairnessMetrics: z.object({
    overallStdDev: z.number(),
    institutionBreakdown: z.array(z.any()),
    shiftBreakdown: z.record(z.string(), z.any()),
  }).passthrough(),
  runQuality: z.object({
    firstChoicePct: z.number(),
    secondChoicePct: z.number(),
    fallbackPct: z.number(),
    compositeScore: z.number(),
  }),
  fairness: z.object({
    memberSatisfaction: z.array(z.any()),
    updatedPriorityQueue: z.array(z.any()),
    workingQueueFinal: z.array(z.any()),
    deviation: z.object({
      mean: z.number(),
      stdDev: z.number(),
    }),
  }),
  metadata: z.object({
    totalRounds: z.number().int().min(0),
    totalConflicts: z.number().int().min(0),
    totalProximity: z.number().int().min(0),
    totalAuto: z.number().int().min(0),
    totalBackfill: z.number().int().min(0),
  }),
  engineLog: z.array(z.object({
    phase: z.string(),
    action: z.string(),
    details: z.string(),
  }).passthrough()),
  analytics: z.object({
    inputSnapshot: z.any(),
    detectedPatterns: z.array(z.any()),
    scoringBreakdowns: z.array(z.any()),
  }).passthrough(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
}).passthrough();

export function validateEngineInput(input) {
  const parsed = EngineInputSchema.safeParse(input);
  if (parsed.success) {
    return { valid: true, errors: [], data: parsed.data };
  }
  return {
    valid: false,
    errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`),
    data: null,
  };
}

export {
  assignmentReasonSchema,
  dateStringSchema,
  shiftSchema,
};
