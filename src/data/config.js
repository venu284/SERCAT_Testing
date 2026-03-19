export const DEFAULT_CONFIG = {
  winPenalty: 0.15,
  secondChoicePenaltyRatio: 0.3,
  preferenceProximityDays: 7,
  backfillMinGapDays: 14,
  backfillIdealGapDays: 21,
  deficitHalfLifeCycles: 3,
  expectedSatisfaction: 0.7,
  satisfactionWeights: { firstChoice: 1.0, secondChoice: 0.7, proximity3: 0.4, proximity7: 0.2, auto: 0.0, backfill: 0.45 },
  fairnessWeights: { satisfaction: 0.6, desirability: 0.4 },
  pairingTolerance: 0.5,
  cycleNumber: 1,
};

export const ALGORITHM_PROFILE = {
  id: 'sercat-shift-slot-engine',
  name: 'SERCAT Shift-Slot Engine',
  version: '2.1-test',
};
