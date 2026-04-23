import { SHIFT_HOURS, SHIFT_ORDER, WHOLE_SHARE_SHIFTS } from './constants.js';
import { daysBetween } from './dates.js';
import { DEFAULT_CONFIG } from './config.js';
import { validateEngineInput, EngineOutputSchema } from './schemas.js';
import { calculatePriorityScore } from './scorer.js';
import { calculateEffectiveDeficits, detectPatterns } from './history.js';
import {
  calculateSatisfaction,
  calculateFairnessMetrics,
  calculateRunQuality,
  calculateDeficitUpdates,
} from './analyzer.js';

function round(value, precision = 4) {
  return Number(Number(value || 0).toFixed(precision));
}

function sortDatesAsc(a, b) {
  return String(a).localeCompare(String(b));
}

function keyForAvailability(date, shift) {
  return `${date}:${shift}`;
}

function getShareMemberId(share) {
  return share.memberId || share.institutionAbbreviation || share.institutionId;
}

function roundNumber(value, precision = 4) {
  return Number(Number(value || 0).toFixed(precision));
}

function createLogEntry(entry) {
  const {
    phase = 'Phase 2',
    round = null,
    shift = null,
    action,
    institutionId = null,
    piId = null,
    priorityScore = null,
    scoreBreakdown = null,
    result = null,
    assignedDate = null,
    detail = '',
  } = entry;

  return {
    phase,
    round,
    shift,
    action,
    institutionId,
    piId,
    priorityScore: priorityScore == null ? null : roundNumber(priorityScore),
    scoreBreakdown,
    result,
    assignedDate,
    detail,
    details: detail,
  };
}

export function computeEntitlements(items = []) {
  return (items || [])
    .filter((item) => item.status !== 'DEACTIVATED' && item.isActive !== false)
    .map((item) => {
      if (typeof item.shares === 'number') {
        const wholeShares = Math.floor(item.shares);
        const fractionalHours = round((item.shares - wholeShares) * 24, 2);
        return {
          memberId: item.id || item.memberId || item.institutionAbbreviation,
          totalShares: item.shares,
          wholeShares,
          fractionalHours,
          nightShifts: wholeShares,
        };
      }

      const wholeShares = Number(item.wholeShares) || 0;
      const fractionalShares = Number(item.fractionalShares) || 0;
      const totalShares = round(wholeShares + fractionalShares, 4);
      return {
        memberId: getShareMemberId(item),
        totalShares,
        wholeShares,
        fractionalHours: round(fractionalShares * 24, 2),
        nightShifts: wholeShares,
      };
    });
}

export function buildDemandMap(wholePrefs = [], fracPrefs = []) {
  const counts = {};
  [...wholePrefs, ...fracPrefs].forEach((preference) => {
    if (!preference?.choice1Date) return;
    counts[preference.choice1Date] = (counts[preference.choice1Date] || 0) + 1;
  });
  const max = Math.max(1, ...Object.values(counts));
  return Object.fromEntries(
    Object.entries(counts).map(([date, count]) => [
      date,
      { date, demandCount: count, desirabilityIndex: round(count / max) },
    ]),
  );
}

function getPreferenceValue(historyEntry) {
  if (historyEntry.choiceRank === 1) return 1.0;
  if (historyEntry.choiceRank === 2) return 0.6;
  if (['auto_assigned', 'fractional_packed'].includes(historyEntry.assignmentReason)) return 0.5;
  return 0.2;
}

function buildHistoricalSatisfaction(preferenceHistory = []) {
  const grouped = new Map();
  preferenceHistory.forEach((entry) => {
    if (!grouped.has(entry.institutionId)) grouped.set(entry.institutionId, []);
    grouped.get(entry.institutionId).push(getPreferenceValue(entry));
  });

  const result = new Map();
  grouped.forEach((scores, institutionId) => {
    const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    result.set(institutionId, average);
  });
  return result;
}

function buildRerunBoosts(previousDraft, config) {
  const boosts = new Map();
  const satisfaction = previousDraft?.satisfaction || [];
  if (satisfaction.length === 0) return boosts;
  const averages = satisfaction.map((entry) => entry.averageSatisfaction ?? entry.score ?? 0);
  const mean = averages.reduce((sum, value) => sum + value, 0) / averages.length;
  satisfaction.forEach((entry) => {
    const score = entry.averageSatisfaction ?? entry.score ?? 0;
    if (score < mean) {
      boosts.set(entry.institutionId, config.rerunBoostPct);
    }
  });
  return boosts;
}

function buildPreferenceMaps(preferences = [], fractionalPreferences = []) {
  const wholeByPi = new Map();
  const wholeByShare = new Map();
  const fractionalByPi = new Map();

  preferences.forEach((preference) => {
    if (!wholeByPi.has(preference.piId)) wholeByPi.set(preference.piId, []);
    wholeByPi.get(preference.piId).push(preference);

    const shareKey = `${preference.piId}:${preference.shareIndex}`;
    if (!wholeByShare.has(shareKey)) wholeByShare.set(shareKey, []);
    wholeByShare.get(shareKey).push(preference);
  });

  fractionalPreferences.forEach((preference) => {
    if (!fractionalByPi.has(preference.piId)) fractionalByPi.set(preference.piId, []);
    fractionalByPi.get(preference.piId).push(preference);
  });

  return { wholeByPi, wholeByShare, fractionalByPi };
}

function buildAvailabilityIndex(availableDates = [], blockedSlots = []) {
  const blockedSet = new Set(blockedSlots);
  const availability = new Map();
  [...availableDates].sort(sortDatesAsc).forEach((date) => {
    SHIFT_ORDER.forEach((shift) => {
      const key = keyForAvailability(date, shift);
      if (blockedSet.has(key)) return;
      availability.set(keyForAvailability(date, shift), {
        capacity: SHIFT_HOURS[shift],
        used: 0,
      });
    });
  });
  return availability;
}

function getCandidateDates(availableDates, anchorDate = '', customComparator) {
  if (typeof customComparator === 'function') {
    return [...availableDates].sort(customComparator);
  }
  return [...availableDates].sort((a, b) => {
    if (!anchorDate) return sortDatesAsc(a, b);
    const diff = daysBetween(a, anchorDate) - daysBetween(b, anchorDate);
    if (diff !== 0) return diff;
    return sortDatesAsc(a, b);
  });
}

function getAssignedDatesForPi(assignments, piId) {
  return [...new Set(assignments.filter((entry) => entry.piId === piId).map((entry) => entry.assignedDate))];
}

function deriveGapPreference(piId, wholeByPi, fractionalByPi, config) {
  const allPreferences = [
    ...(wholeByPi.get(piId) || []),
    ...(fractionalByPi.get(piId) || []),
  ];
  const primaryDates = allPreferences
    .map((entry) => entry.choice1Date)
    .filter(Boolean)
    .sort(sortDatesAsc);
  const allDates = (primaryDates.length >= 2 ? primaryDates : allPreferences
    .flatMap((entry) => [entry.choice1Date, entry.choice2Date])
    .filter(Boolean))
    .filter((value, index, collection) => collection.indexOf(value) === index)
    .sort(sortDatesAsc);

  const gaps = [];
  for (let index = 1; index < allDates.length; index += 1) {
    const gap = daysBetween(allDates[index - 1], allDates[index]);
    if (gap > 0) gaps.push(gap);
  }

  if (gaps.length === 0) return config.gapPreferredDays;
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];
  return Math.max(config.gapMinDays, Math.min(config.gapPreferredDays, Math.round(median)));
}

function getDateRemainingCapacity(availability, date, allowedShifts = SHIFT_ORDER) {
  return allowedShifts.reduce((total, shift) => {
    const cell = availability.get(keyForAvailability(date, shift));
    if (!cell) return total;
    return total + Math.max(0, cell.capacity - cell.used);
  }, 0);
}

function getMinimumGapForMode(mode, config) {
  if (mode === 'fractional') return 5;
  if (mode === 'auto') return config.autoAssignGapDays;
  return config.gapMinDays;
}

function getPreferredGapForMode(request, mode, config, wholeByPi, fractionalByPi) {
  if (mode === 'auto' || mode === 'fractional') return config.gapPreferredDays;
  return deriveGapPreference(request.piId, wholeByPi, fractionalByPi, config);
}

function isCapacityAvailable(availability, date, shift, hours) {
  const cell = availability.get(keyForAvailability(date, shift));
  return Boolean(cell) && (cell.used + hours <= cell.capacity + 1e-9);
}

function reserveCapacity(availability, date, shift, hours) {
  const key = keyForAvailability(date, shift);
  const cell = availability.get(key);
  if (!cell) return;
  cell.used = round(cell.used + hours, 4);
  availability.set(key, cell);
}

function getPatternConfidence(patterns, institutionId, shift, date) {
  const month = String(date || '').slice(5, 7);
  return patterns
    .filter((pattern) => pattern.institutionId === institutionId && pattern.shift === shift)
    .reduce((max, pattern) => {
      if (pattern.patternType === 'date-range-preference' && pattern.detail.includes(month)) {
        return Math.max(max, pattern.confidence);
      }
      if (pattern.patternType === 'shift-clustering') {
        return Math.max(max, pattern.confidence * 0.7);
      }
      return max;
    }, 0);
}

function buildScoreContext(candidates, shift, historicalSatisfaction, effectiveDeficits) {
  const allDeficits = candidates.map(
    (candidate) => effectiveDeficits.get(`${candidate.institutionId}:${shift}`) || 0,
  );
  const allAvgSatisfactions = candidates.map(
    (candidate) => historicalSatisfaction.get(candidate.institutionId) ?? 0.5,
  );
  return { allDeficits, allAvgSatisfactions };
}

function scoreCandidates(candidates, shift, round, context) {
  const { config, effectiveDeficits, historicalSatisfaction, patterns, rerunBoosts } = context;
  const scoreContext = buildScoreContext(candidates, shift, historicalSatisfaction, effectiveDeficits);

  return candidates
    .map((candidate) => {
      const raw = calculatePriorityScore({
        institutionalDeficit: effectiveDeficits.get(`${candidate.institutionId}:${shift}`) || 0,
        allDeficits: scoreContext.allDeficits,
        choiceRank: candidate.choiceRank,
        avgSatisfaction: historicalSatisfaction.get(candidate.institutionId) ?? 0.5,
        allAvgSatisfactions: scoreContext.allAvgSatisfactions,
        patternConfidence: getPatternConfidence(patterns, candidate.institutionId, shift, candidate.anchorDate),
        round,
        config,
      });
      const boost = rerunBoosts.get(candidate.institutionId) || 0;
      return {
        ...candidate,
        priorityScore: raw.score * (1 + boost),
        scoreBreakdown: raw.breakdown,
      };
    })
    .sort((a, b) => (
      (b.priorityScore - a.priorityScore)
      || a.piId.localeCompare(b.piId)
    ));
}

function buildConflictDetail(group, winner, losers) {
  const scoreLine = group
    .map((entry) => `${entry.memberId}/${entry.piId}:${round(entry.priorityScore, 3)}`)
    .join(', ');
  return `${winner.memberId}/${winner.piId} wins ${winner.anchorDate} over ${losers.map((entry) => `${entry.memberId}/${entry.piId}`).join(', ')} (${scoreLine})`;
}

function makeAssignment(request, date, shift, assignmentReason, choiceRank, hours, extra = {}) {
  return {
    piId: request.piId,
    institutionId: request.institutionId,
    memberId: request.memberId,
    shareIndex: request.shareIndex,
    blockIndex: request.blockIndex ?? null,
    shift,
    assignedDate: date,
    choiceRank,
    assignmentReason,
    hours,
    fractionalHours: request.shareIndex === 0 ? hours : null,
    isShared: Boolean(extra.isShared),
    sharedWith: extra.sharedWith || null,
    coAssignments: extra.coAssignments || null,
    wonConflict: Boolean(extra.wonConflict),
  };
}

function chooseShiftForDate(state, date, request, allowedShifts) {
  const ranked = [...allowedShifts]
    .map((shift) => ({
      shift,
      remaining: getDateRemainingCapacity(state.availability, date, [shift]),
      deficit: state.context.effectiveDeficits.get(`${request.institutionId}:${shift}`) || 0,
    }))
    .filter((entry) => isCapacityAvailable(state.availability, date, entry.shift, request.hours))
    .sort((left, right) => (right.deficit - left.deficit) || (right.remaining - left.remaining) || left.shift.localeCompare(right.shift));

  return ranked[0]?.shift || null;
}

function findFallbackDate(request, state, config, anchorDate, mode = 'preference') {
  const assignedDates = getAssignedDatesForPi(state.assignments, request.piId);
  const preferredGap = getPreferredGapForMode(request, mode, config, state.context.wholeByPi, state.context.fractionalByPi);
  const minimumGap = getMinimumGapForMode(mode, config);
  const ordered = getCandidateDates(
    state.availableDates,
    anchorDate || '',
    mode === 'auto'
      ? (left, right) => (
        (getDateRemainingCapacity(state.availability, right, request.allowedShifts) - getDateRemainingCapacity(state.availability, left, request.allowedShifts))
        || sortDatesAsc(left, right)
      )
      : undefined,
  );

  const canUseDate = (date, requiredGap) => {
    if (!assignedDates.every((assignedDate) => daysBetween(assignedDate, date) >= requiredGap)) return null;
    return chooseShiftForDate(state, date, request, request.allowedShifts);
  };

  for (const date of ordered) {
    const shift = canUseDate(date, preferredGap);
    if (shift) return { date, shift, relaxed: false, reason: 'fallback_proximity' };
  }

  for (const date of ordered) {
    const shift = canUseDate(date, minimumGap);
    if (shift) return { date, shift, relaxed: true, reason: 'fallback_proximity' };
  }

  for (const date of ordered) {
    if (assignedDates.includes(date)) continue;
    const shift = chooseShiftForDate(state, date, request, request.allowedShifts);
    if (shift) return { date, shift, relaxed: true, reason: 'fallback_any' };
  }

  for (const date of ordered) {
    const shift = chooseShiftForDate(state, date, request, request.allowedShifts);
    if (shift) return { date, shift, relaxed: true, reason: 'fallback_any' };
  }

  return null;
}

function assignAndTrack(state, assignment, logEntry) {
  state.assignments.push(assignment);
  reserveCapacity(state.availability, assignment.assignedDate, assignment.shift, assignment.hours);
  state.assignmentKeys.add(`${assignment.piId}:${assignment.shareIndex}:${assignment.blockIndex || 0}:${assignment.shift}`);
  if (assignment.assignmentReason === 'fallback_proximity') state.totalProximity += 1;
  if (assignment.assignmentReason === 'auto_assigned') state.totalAuto += 1;
  if (assignment.assignmentReason === 'fallback_any') state.totalBackfill += 1;
  state.engineLog.push(createLogEntry(logEntry));
}

function groupByDate(requests, field) {
  const groups = new Map();
  requests.forEach((request) => {
    const date = request[field];
    if (!date) return;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(request);
  });
  return Array.from(groups.entries()).sort((a, b) => sortDatesAsc(a[0], b[0]));
}

function buildWholeRequests(shares, wholeByShare, round, shift) {
  const requests = [];
  shares.forEach((share) => {
    if (!share.isActive || share.wholeShares < round) return;
    const pref = (wholeByShare.get(`${share.piId}:${round}`) || []).find((entry) => entry.shift === shift);
    if (!pref?.choice1Date) return;
    requests.push({
      ...pref,
      memberId: getShareMemberId(share),
      shift,
      shareIndex: round,
      allowedShifts: [shift],
      hours: SHIFT_HOURS[shift],
    });
  });
  return requests;
}

function assignWholeShareRequests(shares, wholeByShare, state, context) {
  const maxWholeShares = Math.max(0, ...shares.map((share) => share.wholeShares));

  for (let roundIndex = 1; roundIndex <= maxWholeShares; roundIndex += 1) {
    SHIFT_ORDER.forEach((shift) => {
      const requests = buildWholeRequests(shares, wholeByShare, roundIndex, shift);
      const firstPassGroups = groupByDate(
        requests.map((request) => ({ ...request, choiceRank: 1, anchorDate: request.choice1Date })),
        'choice1Date',
      );
      const losers = [];

      firstPassGroups.forEach(([date, group]) => {
        if (!isCapacityAvailable(state.availability, date, shift, SHIFT_HOURS[shift])) {
          losers.push(...group);
          return;
        }

        if (group.length === 1) {
          const [scored] = scoreCandidates(group, shift, roundIndex, context);
          const assignment = makeAssignment(group[0], date, shift, 'choice1_no_conflict', 1, SHIFT_HOURS[shift], { wonConflict: false });
          assignAndTrack(state, assignment, {
            phase: 'Phase 2',
            action: 'First Choice',
            round: roundIndex,
            shift,
            institutionId: group[0].institutionId,
            piId: group[0].piId,
            priorityScore: scored.priorityScore,
            scoreBreakdown: scored.scoreBreakdown,
            result: 'choice1_no_conflict',
            assignedDate: date,
            detail: `${group[0].memberId}/${group[0].piId} assigned ${date} ${shift}`,
          });
          state.scoringBreakdowns.push({
            institutionId: group[0].institutionId,
            shift,
            components: scored.scoreBreakdown,
            round: roundIndex,
            choiceRank: 1,
            requestedDate: date,
          });
          return;
        }

        state.totalConflicts += 1;
        const scored = scoreCandidates(group, shift, roundIndex, context);
        const [winner, ...remainder] = scored;
        const assignment = makeAssignment(winner, date, shift, 'choice1', 1, SHIFT_HOURS[shift], { wonConflict: true });
        assignAndTrack(state, assignment, {
          phase: 'Phase 2',
          action: 'Conflict Won',
          round: roundIndex,
          shift,
          institutionId: winner.institutionId,
          piId: winner.piId,
          priorityScore: winner.priorityScore,
          scoreBreakdown: winner.scoreBreakdown,
          result: 'choice1',
          assignedDate: date,
          detail: buildConflictDetail(scored, winner, remainder),
        });
        remainder.forEach((entry) => losers.push(entry));
        scored.forEach((entry) => {
          state.scoringBreakdowns.push({
            institutionId: entry.institutionId,
            shift,
            components: entry.scoreBreakdown,
            round: roundIndex,
            choiceRank: 1,
            requestedDate: date,
          });
        });
      });

      const secondPassGroups = groupByDate(
        losers
          .filter((request) => request.choice2Date)
          .map((request) => ({ ...request, choiceRank: 2, anchorDate: request.choice2Date })),
        'choice2Date',
      );
      const fallbackQueue = losers.filter((request) => !request.choice2Date);

      secondPassGroups.forEach(([date, group]) => {
        if (!isCapacityAvailable(state.availability, date, shift, SHIFT_HOURS[shift])) {
          fallbackQueue.push(...group);
          return;
        }

        if (group.length === 1) {
          const [scored] = scoreCandidates(group, shift, roundIndex, context);
          const assignment = makeAssignment(group[0], date, shift, 'choice2', 2, SHIFT_HOURS[shift]);
          assignAndTrack(state, assignment, {
            phase: 'Phase 2',
            action: 'Second Choice',
            round: roundIndex,
            shift,
            institutionId: group[0].institutionId,
            piId: group[0].piId,
            priorityScore: scored.priorityScore,
            scoreBreakdown: scored.scoreBreakdown,
            result: 'choice2',
            assignedDate: date,
            detail: `${group[0].memberId}/${group[0].piId} assigned ${date} ${shift}`,
          });
          state.scoringBreakdowns.push({
            institutionId: group[0].institutionId,
            shift,
            components: scored.scoreBreakdown,
            round: roundIndex,
            choiceRank: 2,
            requestedDate: date,
          });
          return;
        }

        const scored = scoreCandidates(group, shift, roundIndex, context);
        const [winner, ...remainder] = scored;
        const assignment = makeAssignment(winner, date, shift, 'choice2', 2, SHIFT_HOURS[shift]);
        assignAndTrack(state, assignment, {
          phase: 'Phase 2',
          action: 'Second Choice Conflict',
          round: roundIndex,
          shift,
          institutionId: winner.institutionId,
          piId: winner.piId,
          priorityScore: winner.priorityScore,
          scoreBreakdown: winner.scoreBreakdown,
          result: 'choice2',
          assignedDate: date,
          detail: buildConflictDetail(scored, winner, remainder),
        });
        remainder.forEach((entry) => fallbackQueue.push(entry));
        scored.forEach((entry) => {
          state.scoringBreakdowns.push({
            institutionId: entry.institutionId,
            shift,
            components: entry.scoreBreakdown,
            round: roundIndex,
            choiceRank: 2,
            requestedDate: date,
          });
        });
      });

      fallbackQueue.forEach((request) => {
        const fallback = findFallbackDate(request, state, context.config, request.choice2Date || request.choice1Date, 'preference');
        if (!fallback) {
          state.errors.push(`No fallback date available for ${request.memberId}/${request.piId} ${request.shift}`);
          return;
        }

        const assignment = makeAssignment(request, fallback.date, fallback.shift, fallback.reason, null, SHIFT_HOURS[fallback.shift]);
        assignAndTrack(state, assignment, {
          phase: 'Phase 2',
          action: 'Proximity',
          round: roundIndex,
          shift: fallback.shift,
          institutionId: request.institutionId,
          piId: request.piId,
          result: fallback.reason,
          assignedDate: fallback.date,
          detail: `${request.memberId}/${request.piId} assigned ${fallback.date} ${fallback.shift}${fallback.relaxed ? ' (relaxed gap)' : ''}`,
        });
        if (fallback.relaxed) {
          state.warnings.push(`Gap constraint relaxed for ${request.memberId}/${request.piId} ${request.shift}`);
        }
      });
    });
  }
}

function buildFractionalBlocks(shares, fractionalByPi) {
  const blocks = [];

  shares.forEach((share) => {
    if (!share.isActive || !(share.fractionalShares > 0)) return;

    const totalHours = round((share.fractionalShares || 0) * 24, 2);
    const prefRows = [...(fractionalByPi.get(share.piId) || [])]
      .sort((a, b) => (a.blockIndex || 0) - (b.blockIndex || 0));

    let consumedHours = 0;
    let blockIndex = 1;

    prefRows.forEach((pref) => {
      if (consumedHours >= totalHours) return;
      const hours = Math.min(round(pref.fractionalHours || 0, 2), totalHours - consumedHours);
      if (hours <= 0) return;
      blocks.push({
        piId: share.piId,
        institutionId: share.institutionId,
        memberId: getShareMemberId(share),
        shareIndex: 0,
        blockIndex,
        choice1Date: pref.choice1Date || '',
        choice2Date: pref.choice2Date || '',
        allowedShifts: ['DS1', 'DS2'],
        hours,
      });
      consumedHours = round(consumedHours + hours, 2);
      blockIndex += 1;
    });

    while (consumedHours < totalHours - 1e-9) {
      const remaining = round(totalHours - consumedHours, 2);
      const hours = Math.min(6, remaining);
      blocks.push({
        piId: share.piId,
        institutionId: share.institutionId,
        memberId: getShareMemberId(share),
        shareIndex: 0,
        blockIndex,
        choice1Date: '',
        choice2Date: '',
        allowedShifts: ['DS1', 'DS2'],
        hours,
      });
      consumedHours = round(consumedHours + hours, 2);
      blockIndex += 1;
    }
  });

  return blocks;
}

function assignFractionalGroup(state, chosen, date, shift, assignmentReason, choiceRank) {
  const coAssignments = chosen.length > 1
    ? chosen.map((entry) => ({ institutionId: entry.institutionId, memberId: entry.memberId, hours: entry.hours }))
    : null;

  chosen.forEach((entry) => {
    const sharedWith = chosen.find((other) => other.piId !== entry.piId)?.memberId || null;
    const assignment = makeAssignment(entry, date, shift, assignmentReason, choiceRank, entry.hours, {
      isShared: chosen.length > 1,
      sharedWith,
      coAssignments,
    });
    assignAndTrack(state, assignment, {
      phase: 'Phase 3',
      action: assignmentReason,
      shift,
      institutionId: entry.institutionId,
      piId: entry.piId,
      result: assignmentReason,
      assignedDate: date,
      detail: `${entry.memberId}/${entry.piId} assigned ${date} ${shift} (${entry.hours}h)`,
    });
  });
}

function chooseFractionalShift(state, date, candidate, context) {
  return [...candidate.allowedShifts]
    .map((shift) => ({
      shift,
      capacityOk: isCapacityAvailable(state.availability, date, shift, candidate.hours),
      deficit: context.effectiveDeficits.get(`${candidate.institutionId}:${shift}`) || 0,
      remaining: getDateRemainingCapacity(state.availability, date, [shift]),
    }))
    .filter((entry) => entry.capacityOk)
    .sort((left, right) => (right.deficit - left.deficit) || (right.remaining - left.remaining) || left.shift.localeCompare(right.shift))[0]?.shift || null;
}

function satisfiesGapForPreferredFractionalDate(state, candidate, date, requiredGap) {
  const assignedDates = getAssignedDatesForPi(state.assignments, candidate.piId);
  return assignedDates.every((assignedDate) => daysBetween(assignedDate, date) >= requiredGap);
}

function assignFractionalBlocks(shares, state, context) {
  const blocks = buildFractionalBlocks(shares, context.fractionalByPi);
  const submittedBlocks = blocks.filter((block) => block.choice1Date || block.choice2Date);
  const unassignedBlocks = [];

  ['choice1Date', 'choice2Date'].forEach((field, passIndex) => {
    const pending = passIndex === 0 ? submittedBlocks : [...unassignedBlocks];
    unassignedBlocks.length = 0;
    const grouped = new Map();

    pending.forEach((block) => {
      const date = block[field];
      if (!date) {
        unassignedBlocks.push(block);
        return;
      }
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date).push({ ...block, anchorDate: date, choiceRank: passIndex + 1 });
    });

    Array.from(grouped.entries()).sort((a, b) => sortDatesAsc(a[0], b[0])).forEach(([date, group]) => {
      const selected = [];
      const leftovers = [];
      const scored = scoreCandidates(group, 'DS1', 1, context);
      const requiredGap = passIndex === 0
        ? getPreferredGapForMode(group[0], 'fractional', context.config, context.wholeByPi, context.fractionalByPi)
        : getMinimumGapForMode('fractional', context.config);

      scored.forEach((entry) => {
        if (!satisfiesGapForPreferredFractionalDate(state, entry, date, requiredGap)) {
          leftovers.push(entry);
          return;
        }
        const shift = chooseFractionalShift(state, date, entry, context);
        if (!shift) {
          leftovers.push(entry);
          return;
        }
        selected.push({ ...entry, selectedShift: shift });
        state.scoringBreakdowns.push({
          institutionId: entry.institutionId,
          shift,
          components: entry.scoreBreakdown,
          round: 0,
          choiceRank: passIndex + 1,
          requestedDate: date,
        });
      });

      leftovers.forEach((entry) => unassignedBlocks.push(entry));
      const byShift = selected.reduce((acc, entry) => {
        if (!acc[entry.selectedShift]) acc[entry.selectedShift] = [];
        acc[entry.selectedShift].push(entry);
        return acc;
      }, {});

      Object.entries(byShift).forEach(([shift, chosen]) => {
        assignFractionalGroup(state, chosen, date, shift, 'fractional_packed', passIndex + 1);
      });
    });
  });

  unassignedBlocks.forEach((block) => {
    const fallback = findFallbackDate(block, state, context.config, block.choice2Date || block.choice1Date, 'fractional');
    if (!fallback) {
      state.errors.push(`No fractional date available for ${block.memberId}/${block.piId}`);
      return;
    }
    const assignment = makeAssignment(block, fallback.date, fallback.shift, 'auto_assigned', null, block.hours);
    assignAndTrack(state, assignment, {
      phase: 'Phase 3',
      action: 'Fractional Fallback',
      shift: fallback.shift,
      institutionId: block.institutionId,
      piId: block.piId,
      result: 'auto_assigned',
      assignedDate: fallback.date,
      detail: `${block.memberId}/${block.piId} assigned ${fallback.date} ${fallback.shift} (${block.hours}h)`,
    });
  });

  return blocks;
}

function assignOutstandingWholeSlots(shares, wholeByShare, state, context) {
  const orderedShares = [...shares].sort((a, b) => {
    const aKey = SHIFT_ORDER.reduce((total, shift) => total + (context.effectiveDeficits.get(`${a.institutionId}:${shift}`) || 0), 0);
    const bKey = SHIFT_ORDER.reduce((total, shift) => total + (context.effectiveDeficits.get(`${b.institutionId}:${shift}`) || 0), 0);
    return (bKey - aKey) || a.piId.localeCompare(b.piId);
  });

  orderedShares.forEach((share) => {
    if (!share.isActive) return;

    for (let shareIndex = 1; shareIndex <= share.wholeShares; shareIndex += 1) {
      const prefs = wholeByShare.get(`${share.piId}:${shareIndex}`) || [];

      WHOLE_SHARE_SHIFTS.forEach((shift) => {
        const assignmentKey = `${share.piId}:${shareIndex}:0:${shift}`;
        if (state.assignmentKeys.has(assignmentKey)) return;

        const pref = prefs.find((entry) => entry.shift === shift);
        const request = {
          piId: share.piId,
          institutionId: share.institutionId,
          memberId: getShareMemberId(share),
          shareIndex,
          shift,
          choice1Date: pref?.choice1Date || '',
          choice2Date: pref?.choice2Date || '',
          allowedShifts: [shift],
          hours: SHIFT_HOURS[shift],
        };
        const fallback = findFallbackDate(request, state, context.config, '', 'auto');
        if (!fallback) {
          state.errors.push(`No backfill date available for ${request.memberId}/${request.piId} ${shift}`);
          return;
        }

        const isNoPreferenceShare = prefs.length === 0;
        const assignmentReason = isNoPreferenceShare ? 'auto_assigned' : 'fallback_any';
        const assignment = makeAssignment(request, fallback.date, fallback.shift, assignmentReason, null, SHIFT_HOURS[fallback.shift]);
        assignAndTrack(state, assignment, {
          phase: 'Phase 4',
          action: isNoPreferenceShare ? 'Auto Assign Whole' : 'Backfill Whole',
          shift: fallback.shift,
          institutionId: request.institutionId,
          piId: request.piId,
          result: assignmentReason,
          assignedDate: fallback.date,
          detail: `${request.memberId}/${request.piId} assigned ${fallback.date} ${fallback.shift}`,
        });
        if (fallback.relaxed) {
          state.warnings.push(`${isNoPreferenceShare ? 'Auto-assignment' : 'Backfill'} gap relaxed for ${request.memberId}/${request.piId} ${shift}`);
        }
      });
    }
  });
}

function assignOutstandingFractionalBlocks(allBlocks, state, context) {
  allBlocks.forEach((block) => {
    const exists = state.assignments.some((assignment) => (
      assignment.piId === block.piId
      && assignment.shareIndex === 0
      && assignment.blockIndex === block.blockIndex
    ));
    if (exists) return;

    const fallback = findFallbackDate(block, state, context.config, '', 'auto');
    if (!fallback) return;

    const assignment = makeAssignment(block, fallback.date, fallback.shift, 'auto_assigned', null, block.hours);
    assignAndTrack(state, assignment, {
      phase: 'Phase 4',
      action: 'Backfill Fractional',
      shift: fallback.shift,
      institutionId: block.institutionId,
      piId: block.piId,
      result: 'auto_assigned',
      assignedDate: fallback.date,
      detail: `${block.memberId}/${block.piId} assigned ${fallback.date} ${fallback.shift} (${block.hours}h)`,
    });
  });
}

function buildFairnessView(satisfaction, fairnessMetrics, deficitUpdates, shares, effectiveDeficits) {
  const memberSatisfaction = satisfaction.map((entry) => ({
    memberId: entry.memberId,
    averageSatisfaction: entry.averageSatisfaction,
  }));

  const updatedPriorityQueue = deficitUpdates
    .reduce((acc, update) => {
      const share = shares.find((entry) => entry.institutionId === update.institutionId);
      const memberId = share ? getShareMemberId(share) : update.institutionId;
      const existingShiftDeficit = effectiveDeficits.get(`${update.institutionId}:${update.shift}`) || 0;
      const existing = acc.find((entry) => entry.memberId === memberId);
      if (existing) {
        existing.deficitScore = round(existing.deficitScore + existingShiftDeficit + update.newDeficitScore);
      } else {
        acc.push({ memberId, deficitScore: round(existingShiftDeficit + update.newDeficitScore) });
      }
      return acc;
    }, [])
    .sort((a, b) => (b.deficitScore - a.deficitScore) || a.memberId.localeCompare(b.memberId));

  const workingQueueFinal = shares
    .map((share) => ({
      memberId: getShareMemberId(share),
      deficitScore: round(
        SHIFT_ORDER.reduce(
          (sum, shift) => sum + (effectiveDeficits.get(`${share.institutionId}:${shift}`) || 0),
          0,
        ),
      ),
    }))
    .sort((a, b) => (b.deficitScore - a.deficitScore) || a.memberId.localeCompare(b.memberId));

  const mean = memberSatisfaction.length > 0
    ? memberSatisfaction.reduce((sum, entry) => sum + entry.averageSatisfaction, 0) / memberSatisfaction.length
    : 0;

  return {
    memberSatisfaction,
    updatedPriorityQueue,
    workingQueueFinal,
    deviation: {
      mean: round(mean),
      stdDev: fairnessMetrics.overallStdDev,
    },
  };
}

export function runSchedulingEngine(input) {
  const parsed = validateEngineInput({
    ...input,
    config: input.config || DEFAULT_CONFIG,
  });
  if (!parsed.valid) {
    throw new Error(`Invalid scheduling input: ${parsed.errors.join('; ')}`);
  }

  const data = parsed.data;
  const shares = data.shares
    .map((share) => ({
      ...share,
      memberId: getShareMemberId(share),
      wholeShares: Number(share.wholeShares) || 0,
      fractionalShares: Number(share.fractionalShares) || 0,
      isActive: share.isActive !== false,
    }))
    .filter((share) => share.isActive);

  const availableDates = [...new Set(data.availableDates)].sort(sortDatesAsc);
  const { wholeByPi, wholeByShare, fractionalByPi } = buildPreferenceMaps(data.preferences, data.fractionalPreferences || []);
  const effectiveDeficits = calculateEffectiveDeficits(data.deficitHistory, data.config.deficitDecayRate);
  const patterns = detectPatterns(data.preferenceHistory, data.config.minPatternCycles);
  const historicalSatisfaction = buildHistoricalSatisfaction(data.preferenceHistory);
  const rerunBoosts = buildRerunBoosts(data.previousDraft, data.config);

  const context = {
    config: data.config,
    effectiveDeficits,
    patterns,
    historicalSatisfaction,
    rerunBoosts,
    wholeByPi,
    wholeByShare,
    fractionalByPi,
  };

  const state = {
    assignments: [],
    assignmentKeys: new Set(),
    availability: buildAvailabilityIndex(availableDates, data.blockedSlots || []),
    availableDates,
    engineLog: [createLogEntry({ phase: 'Phase 1', action: 'Initialize', detail: 'Validated input and initialized scheduling state' })],
    scoringBreakdowns: [],
    errors: [],
    warnings: [],
    totalConflicts: 0,
    totalProximity: 0,
    totalAuto: 0,
    totalBackfill: 0,
    context,
  };

  assignWholeShareRequests(shares, wholeByShare, state, context);
  const fractionalBlocks = assignFractionalBlocks(shares, state, context);
  assignOutstandingWholeSlots(shares, wholeByShare, state, context);
  assignOutstandingFractionalBlocks(fractionalBlocks, state, context);

  const satisfaction = calculateSatisfaction(state.assignments, data.config);
  const fairnessMetrics = calculateFairnessMetrics(satisfaction);
  const runQuality = calculateRunQuality(state.assignments, satisfaction, fairnessMetrics, data.config);
  const deficitUpdates = calculateDeficitUpdates(state.assignments, data.config);
  const fairness = buildFairnessView(satisfaction, fairnessMetrics, deficitUpdates, shares, effectiveDeficits);

  const output = {
    assignments: state.assignments.map((assignment) => ({
      ...assignment,
      hours: round(assignment.hours, 2),
    })),
    deficitUpdates,
    satisfaction,
    fairnessMetrics,
    runQuality,
    fairness,
    metadata: {
      totalRounds: Math.max(0, ...shares.map((share) => share.wholeShares)),
      totalConflicts: state.totalConflicts,
      totalProximity: state.totalProximity,
      totalAuto: state.totalAuto,
      totalBackfill: state.totalBackfill,
    },
    engineLog: state.engineLog,
    analytics: {
      inputSnapshot: JSON.parse(JSON.stringify(data)),
      detectedPatterns: patterns,
      scoringBreakdowns: state.scoringBreakdowns,
    },
    errors: state.errors,
    warnings: state.warnings,
  };

  return EngineOutputSchema.parse(output);
}
