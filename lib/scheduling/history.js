import { daysBetween } from './dates.js';

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function standardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function calculateEffectiveDeficits(deficitHistory, decayRate) {
  const result = new Map();

  (deficitHistory || []).forEach((entry) => {
    const key = `${entry.institutionId}:${entry.shift}`;
    const weighted = (Number(entry.deficitScore) || 0) * (decayRate ** (entry.cycleAge || 0));
    result.set(key, (result.get(key) || 0) + weighted);
  });

  return result;
}

export function detectPatterns(preferenceHistory, minCycles) {
  const patterns = [];
  const grouped = new Map();

  (preferenceHistory || []).forEach((entry) => {
    const key = `${entry.institutionId}:${entry.shift}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  });

  grouped.forEach((entries, key) => {
    const [institutionId, shift] = key.split(':');
    const cycleIds = new Set(entries.map((entry) => entry.cycleId).filter(Boolean));
    if (cycleIds.size < minCycles) return;

    const preferredDates = entries
      .map((entry) => entry.choice1Date || entry.assignedDate)
      .filter(Boolean)
      .sort();

    const monthCounts = preferredDates.reduce((acc, date) => {
      const month = String(date).slice(5, 7);
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    const dominantMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
    if (dominantMonth) {
      const confidence = dominantMonth[1] / preferredDates.length;
      if (confidence >= 0.5) {
        patterns.push({
          institutionId,
          shift,
          patternType: 'date-range-preference',
          confidence: Number(confidence.toFixed(4)),
          detail: `Prefers month ${dominantMonth[0]} for ${shift}`,
        });
      }
    }

    const assignedDates = entries.map((entry) => entry.assignedDate).filter(Boolean).sort();
    if (assignedDates.length >= minCycles) {
      const gaps = [];
      for (let index = 1; index < assignedDates.length; index += 1) {
        gaps.push(daysBetween(assignedDates[index - 1], assignedDates[index]));
      }
      if (gaps.length > 0) {
        const deviation = standardDeviation(gaps);
        const confidence = Math.max(0, 1 - (deviation / 14));
        if (confidence >= 0.5) {
          patterns.push({
            institutionId,
            shift,
            patternType: 'shift-clustering',
            confidence: Number(confidence.toFixed(4)),
            detail: `Typical spacing ${median(gaps).toFixed(1)} days for ${shift}`,
          });
        }
      }
    }

    if (preferredDates.length >= (minCycles * 2)) {
      const presentMonths = new Set(preferredDates.map((date) => String(date).slice(5, 7)));
      const missingSpringMonth = ['02', '03', '04'].find((month) => !presentMonths.has(month));
      if (missingSpringMonth) {
        patterns.push({
          institutionId,
          shift,
          patternType: 'avoidance-pattern',
          confidence: 0.5,
          detail: `Avoids month ${missingSpringMonth} for ${shift}`,
        });
      }
    }
  });

  return patterns;
}
