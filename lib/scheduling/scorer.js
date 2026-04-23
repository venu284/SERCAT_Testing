function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function minMaxNormalize(value, values) {
  if (!Array.isArray(values) || values.length === 0) return 0.5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (Math.abs(max - min) < 1e-9) return 0.5;
  return clamp((value - min) / (max - min));
}

function invertNormalized(value, values) {
  return 1 - minMaxNormalize(value, values);
}

export function calculatePriorityScore(params) {
  const {
    institutionalDeficit,
    allDeficits,
    choiceRank,
    avgSatisfaction,
    allAvgSatisfactions,
    patternConfidence,
    round,
    config,
  } = params;

  const deficitComponent = minMaxNormalize(institutionalDeficit, allDeficits);
  const choiceComponent = choiceRank === 1 ? 1 : choiceRank === 2 ? 0.5 : 0;
  const satisfactionComponent = invertNormalized(avgSatisfaction, allAvgSatisfactions);

  const allInverseSatisfaction = (allAvgSatisfactions || []).map((value) => 1 - value);
  const crossInstitutionBalance = minMaxNormalize(1 - avgSatisfaction, allInverseSatisfaction);
  const patternComponent = clamp(patternConfidence ?? 0);
  const drop = clamp((Math.max(1, round) - 1) * config.perShareDrop, 0, 10);

  const score = (
    (config.weights.institutionalDeficit * deficitComponent) +
    (config.weights.choicePreference * choiceComponent) +
    (config.weights.institutionalSatisfaction * satisfactionComponent) +
    (config.weights.crossInstitutionBalance * crossInstitutionBalance) +
    (config.weights.patternBonus * patternComponent) -
    drop
  );

  return {
    score,
    breakdown: {
      w1: deficitComponent,
      w2: choiceComponent,
      w3: satisfactionComponent,
      w4: crossInstitutionBalance,
      w5: patternComponent,
      drop,
    },
  };
}
