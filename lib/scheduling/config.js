import { z } from 'zod';

export const weightsSchema = z.object({
  institutionalDeficit: z.number().min(0).max(1),
  choicePreference: z.number().min(0).max(1),
  institutionalSatisfaction: z.number().min(0).max(1),
  crossInstitutionBalance: z.number().min(0).max(1),
  patternBonus: z.number().min(0).max(1),
}).superRefine((value, ctx) => {
  const sum = Object.values(value).reduce((total, item) => total + item, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `weights must sum to 1.0; received ${sum}`,
    });
  }
});

export const satisfactionScoresSchema = z.object({
  firstChoice: z.number().min(0).max(1),
  secondChoice: z.number().min(0).max(1),
  fallback: z.number().min(0).max(1),
  autoAssigned: z.number().min(0).max(1),
});

export const qualityWeightsSchema = z.object({
  satisfaction: z.number().min(0).max(1),
  fairness: z.number().min(0).max(1),
  fallbackPenalty: z.number().min(0).max(1),
}).superRefine((value, ctx) => {
  const sum = Object.values(value).reduce((total, item) => total + item, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `quality weights must sum to 1.0; received ${sum}`,
    });
  }
});

export const configSchema = z.object({
  weights: weightsSchema,
  deficitDecayRate: z.number().min(0).max(1),
  conflictWinnerDeficit: z.number().min(-10).max(10),
  fallbackDeficit: z.number().min(0).max(10),
  perShareDrop: z.number().min(0).max(10),
  gapMinDays: z.number().int().min(0).max(365),
  gapPreferredDays: z.number().int().min(0).max(365),
  proximitySearchDays: z.number().int().min(0).max(365),
  minPatternCycles: z.number().int().min(1).max(100),
  rerunBoostPct: z.number().min(0).max(1),
  autoAssignGapDays: z.number().int().min(0).max(365),
  satisfactionScores: satisfactionScoresSchema,
  qualityWeights: qualityWeightsSchema,
});

export const DEFAULT_CONFIG = configSchema.parse({
  weights: {
    institutionalDeficit: 0.35,
    choicePreference: 0.25,
    institutionalSatisfaction: 0.20,
    crossInstitutionBalance: 0.15,
    patternBonus: 0.05,
  },
  deficitDecayRate: 0.9,
  conflictWinnerDeficit: -0.5,
  fallbackDeficit: 1.0,
  perShareDrop: 0.15,
  gapMinDays: 7,
  gapPreferredDays: 14,
  proximitySearchDays: 14,
  minPatternCycles: 3,
  rerunBoostPct: 0.10,
  autoAssignGapDays: 7,
  satisfactionScores: {
    firstChoice: 1.0,
    secondChoice: 0.6,
    fallback: 0.2,
    autoAssigned: 0.5,
  },
  qualityWeights: {
    satisfaction: 0.6,
    fairness: 0.3,
    fallbackPenalty: 0.1,
  },
});
