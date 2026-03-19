import { SHIFT_HOURS, SHIFT_ORDER, WHOLE_SLOT_ORDER } from '../lib/constants';
import { addDays, daysBetween, generateDateRange } from '../lib/dates';

export function computeEntitlements(members) {
  return members.filter((m) => m.status === 'ACTIVE').map((m) => ({
    memberId: m.id,
    totalShares: m.shares,
    wholeShares: Math.floor(m.shares),
    fractionalHours: parseFloat(((m.shares - Math.floor(m.shares)) * 24).toFixed(2)),
    nightShifts: Math.floor(m.shares),
  }));
}

export function buildDemandMap(wholePrefs, fracPrefs) {
  const counts = {};
  wholePrefs.forEach((p) => {
    if (!p.firstChoiceDate) return;
    counts[p.firstChoiceDate] = (counts[p.firstChoiceDate] || 0) + 1;
  });
  fracPrefs.forEach((p) => {
    if (!p.firstChoiceDate) return;
    counts[p.firstChoiceDate] = (counts[p.firstChoiceDate] || 0) + 1;
  });
  const max = Math.max(...Object.values(counts), 1);
  const map = {};
  Object.entries(counts).forEach(([date, count]) => {
    map[date] = { date, demandCount: count, desirabilityIndex: count / max };
  });
  return map;
}

export function runSchedulingEngine(input) {
  const { cycle, members, wholeSharePreferences, fractionalPreferences, priorityQueue, config, simpleHash } = input;
  const log = [];
  const addLog = (phase, action, details) => log.push({ phase, action, details, ts: Date.now() });

  addLog('Phase 0', 'Start', 'Initializing engine');
  const entitlements = computeEntitlements(members);
  const entitlementMap = new Map(entitlements.map((e) => [e.memberId, e]));
  const memberNeedScore = (memberId, roundHint = 1) => {
    const e = entitlementMap.get(memberId);
    if (!e) return 0;
    const remainingWhole = Math.max(0, e.wholeShares - roundHint + 1);
    const fractionalBlocks = Math.ceil(Math.max(0, e.fractionalHours) / 6);
    return remainingWhole * WHOLE_SLOT_ORDER.length + fractionalBlocks;
  };
  const winPenaltyMultiplier = (memberId) => {
    const e = entitlementMap.get(memberId);
    if (!e) return 1;
    return 1 + Math.max(0, (e.totalShares || 0) - 1) * 0.1;
  };
  const queueSort = (a, b, roundHint = 1) =>
    (b.deficitScore - a.deficitScore) ||
    (memberNeedScore(b.memberId, roundHint) - memberNeedScore(a.memberId, roundHint)) ||
    a.memberId.localeCompare(b.memberId);
  const workingQueue = JSON.parse(JSON.stringify(priorityQueue));

  entitlements.forEach((e) => {
    if (!workingQueue.find((q) => q.memberId === e.memberId)) {
      const scores = workingQueue.map((q) => q.deficitScore);
      const meanDef = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const needBias = memberNeedScore(e.memberId, 1) * 0.001;
      const seededDeficit = parseFloat((meanDef + needBias).toFixed(4));
      const pos = Math.ceil(workingQueue.length / 2);
      workingQueue.splice(pos, 0, { memberId: e.memberId, deficitScore: seededDeficit, cycleWins: 0, roundWins: 0 });
      addLog('Phase 0', 'Cold Start', `${e.memberId} inserted at pos ${pos} with deficit ${seededDeficit.toFixed(4)} (need bias=${needBias.toFixed(4)})`);
    }
  });
  workingQueue.sort((a, b) => queueSort(a, b, 1));

  addLog('Phase 1', 'Start', 'Building shift-level slot pool');
  const allDates = generateDateRange(cycle.startDate, cycle.endDate);
  const blockedDateSet = new Set(cycle.blockedDates || []);
  const blockedSlotSet = new Set(cycle.blockedSlots || []);
  const dateSlots = allDates.filter((d) => !blockedDateSet.has(d)).map((d) => ({ date: d, isFullDay: true }));
  const fullDayCount = dateSlots.length;
  const totalWholeDemand = entitlements.reduce((s, e) => s + e.wholeShares * WHOLE_SLOT_ORDER.length, 0);
  addLog('Phase 1', 'Pool Built', `${fullDayCount} available dates, ${totalWholeDemand} whole-share shift slots requested`);

  const demandMap = buildDemandMap(wholeSharePreferences, fractionalPreferences);
  const assignedSlots = new Map();
  const assignments = [];
  const isSlotAvailable = (date, shiftType) => {
    if (!date || !shiftType) return false;
    if (date < cycle.startDate || date > cycle.endDate) return false;
    if (blockedDateSet.has(date)) return false;
    if (blockedSlotSet.has(`${date}:${shiftType}`)) return false;
    if (!dateSlots.some((s) => s.date === date)) return false;
    return !assignedSlots.has(`${date}:${shiftType}`);
  };

  const assignWholeShift = (memberId, date, shiftType, shareIndex, slotKey, assignmentType) => {
    assignments.push({ memberId, date, shiftType, shareIndex, slotKey, assignmentType, isShared: false, hours: SHIFT_HOURS[shiftType] || 6 });
    assignedSlots.set(`${date}:${shiftType}`, memberId);
  };

  const maxRounds = Math.max(...entitlements.map((e) => e.wholeShares), 0);
  addLog('Phase 2', 'Start', `Max rounds: ${maxRounds}`);

  for (let round = 1; round <= maxRounds; round += 1) {
    const roundMembers = entitlements.filter((e) => e.wholeShares >= round);
    if (roundMembers.length === 0) continue;

    addLog('Phase 2', `Round ${round}`, `${roundMembers.length} members participating`);

    const conflictWinners = new Set();
    const secondChoiceWinners = new Set();
    const nonConflictWinners = new Set();

    WHOLE_SLOT_ORDER.forEach((slotKey) => {
      const roundPrefs = wholeSharePreferences
        .filter(
          (p) => p.shareIndex === round
            && (p.slotKey || (p.shiftType === 'NS' ? 'NS' : p.shiftType === 'DS2' ? 'DAY2' : 'DAY1')) === slotKey
            && p.firstChoiceDate
            && roundMembers.some((m) => m.memberId === p.memberId),
        )
        .map((p) => ({
          ...p,
          slotKey,
          shiftType: slotKey === 'NS' ? 'NS' : (p.shiftType || 'DS1'),
        }));

      if (roundPrefs.length === 0) return;

      const preferenceGroups = {};
      roundPrefs.forEach((p) => {
        const key = `${p.firstChoiceDate}:${p.shiftType}`;
        if (!preferenceGroups[key]) preferenceGroups[key] = [];
        preferenceGroups[key].push(p);
      });

      const fallbackCandidates = [];

      Object.entries(preferenceGroups).forEach(([groupKey, prefs]) => {
        const [firstDate, shiftType] = groupKey.split(':');
        let competitors = prefs.map((p) => ({
          ...p,
          deficitScore: workingQueue.find((q) => q.memberId === p.memberId)?.deficitScore || 0,
          needScore: memberNeedScore(p.memberId, round),
        })).sort((a, b) => (b.deficitScore - a.deficitScore) || (b.needScore - a.needScore) || a.memberId.localeCompare(b.memberId));

        if (
          competitors.length > 1
          && competitors[0].deficitScore === competitors[1].deficitScore
          && competitors[0].needScore === competitors[1].needScore
        ) {
          const tied = competitors.filter(
            (c) => c.deficitScore === competitors[0].deficitScore && c.needScore === competitors[0].needScore,
          );
          tied.forEach((c) => { c.tiebreakHash = simpleHash(`${c.memberId}${cycle.id}${round}${slotKey}${shiftType}`) % 10000; });
          tied.sort((a, b) => b.tiebreakHash - a.tiebreakHash);
          const winnerId = tied[0].memberId;
          competitors = [tied[0], ...competitors.filter((c) => c.memberId !== winnerId)];
          addLog('Phase 2', 'Tiebreak', `Need+deficit tie: cycle-rotated hash used for Share ${round} ${slotKey} ${shiftType} on ${firstDate}`);
        }

        const winner = competitors[0];
        const losers = competitors.slice(1);

        if (isSlotAvailable(firstDate, shiftType)) {
          assignWholeShift(winner.memberId, firstDate, shiftType, round, slotKey, 'FIRST_CHOICE');
          if (losers.length > 0) conflictWinners.add(winner.memberId);
          else nonConflictWinners.add(winner.memberId);
          addLog('Phase 2', losers.length > 0 ? 'Conflict Won' : 'No Conflict', `${winner.memberId} → Share ${round} ${slotKey} ${shiftType} @ ${firstDate}${losers.length > 0 ? `; losers: ${losers.map((l) => l.memberId).join(',')}` : ''}`);
        } else {
          fallbackCandidates.push(winner);
          addLog('Phase 2', 'Primary Unavailable', `${winner.memberId} cannot use Share ${round} ${slotKey} ${shiftType} @ ${firstDate}; fallback required`);
        }

        losers.forEach((loser) => fallbackCandidates.push(loser));
      });

      const loserGroups = {};
      fallbackCandidates.forEach((loser) => {
        const key = `${loser.secondChoiceDate || '__none__'}:${loser.shiftType}`;
        if (!loserGroups[key]) loserGroups[key] = [];
        loserGroups[key].push(loser);
      });

      Object.entries(loserGroups).forEach(([groupKey, candidates]) => {
        const [secondDate, shiftType] = groupKey.split(':');
        candidates.sort(
          (a, b) =>
            (b.deficitScore - a.deficitScore) ||
            (memberNeedScore(b.memberId, round) - memberNeedScore(a.memberId, round)) ||
            a.memberId.localeCompare(b.memberId),
        );

        if (secondDate !== '__none__' && isSlotAvailable(secondDate, shiftType)) {
          const winner = candidates.shift();
          assignWholeShift(winner.memberId, secondDate, shiftType, round, slotKey, 'SECOND_CHOICE');
          secondChoiceWinners.add(winner.memberId);
          addLog('Phase 2', '2nd Choice', `${winner.memberId} → Share ${round} ${slotKey} ${shiftType} @ ${secondDate}`);
        }

        candidates.forEach((loser) => {
          const prox = findProximitySlot(
            loser.secondChoiceDate || loser.firstChoiceDate,
            shiftType,
            assignedSlots,
            dateSlots,
            demandMap,
            config.preferenceProximityDays,
            cycle,
            blockedSlotSet,
          );
          if (prox) {
            assignWholeShift(loser.memberId, prox, shiftType, round, slotKey, 'PROXIMITY');
            addLog('Phase 2', 'Proximity', `${loser.memberId} → Share ${round} ${slotKey} ${shiftType} @ ${prox}`);
            return;
          }

          const anyDate = findAnyShiftDate(assignedSlots, dateSlots, blockedDateSet, blockedSlotSet, shiftType);
          if (anyDate) {
            assignWholeShift(loser.memberId, anyDate, shiftType, round, slotKey, 'AUTO_ASSIGNED');
            addLog('Phase 2', 'Auto-Assign', `${loser.memberId} → Share ${round} ${slotKey} ${shiftType} @ ${anyDate}`);
          }
        });
      });
    });

    conflictWinners.forEach((id) => {
      const e = workingQueue.find((q) => q.memberId === id);
      if (e) {
        const penalty = config.winPenalty * winPenaltyMultiplier(id);
        e.deficitScore -= penalty;
        e.cycleWins += 1;
        e.roundWins += 1;
      }
    });
    secondChoiceWinners.forEach((id) => {
      const e = workingQueue.find((q) => q.memberId === id);
      if (e) {
        const penalty = config.winPenalty * config.secondChoicePenaltyRatio * winPenaltyMultiplier(id);
        e.deficitScore -= penalty;
        e.cycleWins += 1;
      }
    });
    nonConflictWinners.forEach((id) => {
      const e = workingQueue.find((q) => q.memberId === id);
      if (e) e.cycleWins += 1;
    });
    workingQueue.sort((a, b) => queueSort(a, b, round + 1));
    addLog('Phase 2', `Queue R${round}`, workingQueue.map((q) => `${q.memberId}:${q.deficitScore.toFixed(3)}`).join(' → '));
  }

  const submittedIds = new Set([
    ...wholeSharePreferences.map((p) => p.memberId),
    ...fractionalPreferences.map((p) => p.memberId),
  ]);

  addLog('Phase 3', 'Start', 'Fractional assignment for submitted members');
  const fracMembers = entitlements.filter((e) => e.fractionalHours > 0 && submittedIds.has(e.memberId));

  fracMembers.forEach((fm) => {
    const fullSlots = Math.floor(fm.fractionalHours / 6);
    const remainder = parseFloat((fm.fractionalHours - fullSlots * 6).toFixed(2));
    const prefs = fractionalPreferences.filter((p) => p.memberId === fm.memberId);

    for (let i = 0; i < fullSlots; i += 1) {
      const pref = prefs[i];
      const shift = pref?.shiftType || 'DS1';
      const date = pref
        ? findAvailableDSDate(pref.firstChoiceDate, pref.secondChoiceDate, assignedSlots, dateSlots, blockedDateSet, blockedSlotSet, shift)
        : findAnyDSDate(assignedSlots, dateSlots, blockedDateSet, blockedSlotSet, shift);
      if (date) {
        const assignmentType = !pref ? 'AUTO_ASSIGNED'
          : date === pref.firstChoiceDate ? 'FIRST_CHOICE'
            : date === pref.secondChoiceDate ? 'SECOND_CHOICE'
              : 'AUTO_ASSIGNED';
        assignments.push({ memberId: fm.memberId, date, shiftType: shift, shareIndex: 0, assignmentType, isShared: false, hours: 6 });
        assignedSlots.set(`${date}:${shift}`, fm.memberId);
        addLog('Phase 3', 'Fractional Solo', `${fm.memberId} → ${date} ${shift} (6hrs)`);
      }
    }

    if (remainder > 0) fm._remainder = remainder;
  });

  const remainders = fracMembers.filter((fm) => fm._remainder > 0).sort((a, b) => b._remainder - a._remainder);
  const paired = new Set();
  for (let i = 0; i < remainders.length; i += 1) {
    if (paired.has(i)) continue;
    for (let j = i + 1; j < remainders.length; j += 1) {
      if (paired.has(j)) continue;
      const sum = remainders[i]._remainder + remainders[j]._remainder;
      if (Math.abs(sum - 6) <= config.pairingTolerance) {
        paired.add(i);
        paired.add(j);
        const date = findAnyDSDate(assignedSlots, dateSlots, blockedDateSet, blockedSlotSet, 'DS1');
        if (date) {
          assignments.push({ memberId: remainders[i].memberId, date, shiftType: 'DS1', shareIndex: 0, assignmentType: 'FIRST_CHOICE', isShared: true, sharedWith: remainders[j].memberId, hours: remainders[i]._remainder });
          assignments.push({ memberId: remainders[j].memberId, date, shiftType: 'DS1', shareIndex: 0, assignmentType: 'FIRST_CHOICE', isShared: true, sharedWith: remainders[i].memberId, hours: remainders[j]._remainder });
          assignedSlots.set(`${date}:DS1`, 'shared');
          addLog('Phase 3', 'Paired', `${remainders[i].memberId}(${remainders[i]._remainder}h) + ${remainders[j].memberId}(${remainders[j]._remainder}h) → ${date}`);
        }
        break;
      }
    }
  }
  for (let i = 0; i < remainders.length; i += 1) {
    if (!paired.has(i)) {
      const date = findAnyDSDate(assignedSlots, dateSlots, blockedDateSet, blockedSlotSet, 'DS1');
      if (date) {
        assignments.push({ memberId: remainders[i].memberId, date, shiftType: 'DS1', shareIndex: 0, assignmentType: 'AUTO_ASSIGNED', isShared: false, hours: remainders[i]._remainder });
        assignedSlots.set(`${date}:DS1`, remainders[i].memberId);
        addLog('Phase 3', 'Unpaired', `${remainders[i].memberId}(${remainders[i]._remainder}h) → ${date} solo`);
      }
    }
  }

  addLog('Phase 4', 'Start', 'Unsubmitted member backfill');
  const queueRank = new Map(workingQueue.map((q, idx) => [q.memberId, idx]));
  const unsubmitted = entitlements
    .filter((e) => !submittedIds.has(e.memberId))
    .sort((a, b) => (queueRank.get(a.memberId) ?? 999) - (queueRank.get(b.memberId) ?? 999));
  unsubmitted.forEach((member) => {
    const memberDatesByShift = { DS1: [], DS2: [], NS: [] };
    for (let si = 1; si <= member.wholeShares; si += 1) {
      WHOLE_SLOT_ORDER.forEach((slotKey) => {
        const shiftType = slotKey === 'NS' ? 'NS' : slotKey === 'DAY2' ? 'DS2' : 'DS1';
        const best = findGapCompliantSlot(
          memberDatesByShift[shiftType],
          assignedSlots,
          dateSlots,
          demandMap,
          config,
          blockedDateSet,
          blockedSlotSet,
          shiftType,
        );
        if (best) {
          assignWholeShift(member.memberId, best.date, shiftType, si, slotKey, 'BACKFILL_ASSIGNED');
          memberDatesByShift[shiftType].push(best.date);
          addLog('Phase 4', 'Backfill', `${member.memberId} share ${si} ${slotKey} ${shiftType} → ${best.date}`);
        }
      });
    }

    const fractionalBlocks = Math.floor(member.fractionalHours / 6);
    const fractionalRemainder = parseFloat((member.fractionalHours - fractionalBlocks * 6).toFixed(2));
    const fracDates = [];

    for (let i = 0; i < fractionalBlocks; i += 1) {
      const preferredShift = i % 2 === 0 ? 'DS1' : 'DS2';
      const best = findGapCompliantSlot(
        fracDates,
        assignedSlots,
        dateSlots,
        demandMap,
        config,
        blockedDateSet,
        blockedSlotSet,
        preferredShift,
      );
      if (best) {
        assignments.push({
          memberId: member.memberId,
          date: best.date,
          shiftType: best.shiftType,
          shareIndex: 0,
          assignmentType: 'BACKFILL_ASSIGNED',
          isShared: false,
          hours: 6,
        });
        assignedSlots.set(`${best.date}:${best.shiftType}`, member.memberId);
        fracDates.push(best.date);
        addLog('Phase 4', 'Backfill Fractional', `${member.memberId} block ${i + 1} ${best.shiftType} → ${best.date}`);
      }
    }

    if (fractionalRemainder > 0) {
      const best = findGapCompliantSlot(
        fracDates,
        assignedSlots,
        dateSlots,
        demandMap,
        config,
        blockedDateSet,
        blockedSlotSet,
        'DS1',
      ) || findGapCompliantSlot(
        fracDates,
        assignedSlots,
        dateSlots,
        demandMap,
        config,
        blockedDateSet,
        blockedSlotSet,
        'DS2',
      );

      if (best) {
        assignments.push({
          memberId: member.memberId,
          date: best.date,
          shiftType: best.shiftType,
          shareIndex: 0,
          assignmentType: 'BACKFILL_ASSIGNED',
          isShared: false,
          hours: fractionalRemainder,
        });
        assignedSlots.set(`${best.date}:${best.shiftType}`, member.memberId);
        addLog('Phase 4', 'Backfill Fractional', `${member.memberId} remainder ${fractionalRemainder}h ${best.shiftType} → ${best.date}`);
      }
    }
  });

  addLog('Phase 5', 'Start', 'Constraint validation');
  const errors = [];
  const warnings = [];
  entitlements.forEach((e) => {
    const ma = assignments.filter((a) => a.memberId === e.memberId);
    const expectedWholeSlots = e.wholeShares * WHOLE_SLOT_ORDER.length;
    const wholeAssigned = ma.filter((a) => a.shareIndex > 0).length;
    if (wholeAssigned !== expectedWholeSlots) errors.push(`${e.memberId}: expected ${expectedWholeSlots} whole-share shift slots, got ${wholeAssigned}`);
    for (let si = 1; si <= e.wholeShares; si += 1) {
      WHOLE_SLOT_ORDER.forEach((slotKey) => {
        const sa = ma.filter((a) => a.shareIndex === si && a.slotKey === slotKey);
        if (sa.length !== 1) errors.push(`${e.memberId} share ${si} ${slotKey}: expected 1 assignment, got ${sa.length}`);
        if (slotKey === 'NS' && sa.length === 1 && sa[0].shiftType !== 'NS') {
          errors.push(`${e.memberId} share ${si} ${slotKey}: NS shift is mandatory`);
        }
      });
    }
  });
  addLog('Phase 5', 'Complete', `${errors.length} errors, ${warnings.length} warnings`);

  addLog('Phase 6', 'Start', 'Fairness calculation');
  const backfillScore = config.satisfactionWeights.backfill ?? 0.45;
  const memberSatisfaction = entitlements.map((e) => {
    const ma = assignments.filter((a) => a.memberId === e.memberId);
    const scores = [];
    for (let si = 1; si <= e.wholeShares; si += 1) {
      WHOLE_SLOT_ORDER.forEach((slotKey) => {
        const sa = ma.find((a) => a.shareIndex === si && a.slotKey === slotKey);
        if (!sa) return;
        const prefScore = sa.assignmentType === 'FIRST_CHOICE' ? config.satisfactionWeights.firstChoice
          : sa.assignmentType === 'SECOND_CHOICE' ? config.satisfactionWeights.secondChoice
            : sa.assignmentType === 'PROXIMITY' ? config.satisfactionWeights.proximity3
              : sa.assignmentType === 'BACKFILL_ASSIGNED' ? backfillScore
                : config.satisfactionWeights.auto;
        const desScore = demandMap[sa.date]?.desirabilityIndex || 0;
        scores.push(prefScore * config.fairnessWeights.satisfaction + desScore * config.fairnessWeights.desirability);
      });
    }
    const fracA = ma.filter((a) => a.shareIndex === 0);
    fracA.forEach((fa) => {
      const ps = fa.assignmentType === 'FIRST_CHOICE'
        ? config.satisfactionWeights.firstChoice
        : fa.assignmentType === 'SECOND_CHOICE'
          ? config.satisfactionWeights.secondChoice
          : fa.assignmentType === 'BACKFILL_ASSIGNED'
            ? backfillScore
            : config.satisfactionWeights.auto;
      scores.push(ps * config.fairnessWeights.satisfaction);
    });
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { memberId: e.memberId, scores, averageSatisfaction: parseFloat(avg.toFixed(4)) };
  });

  const updatedQueue = memberSatisfaction.map((ms) => {
    const currentDeficit = config.expectedSatisfaction - ms.averageSatisfaction;
    const existing = workingQueue.find((q) => q.memberId === ms.memberId);
    const total = currentDeficit + (existing?.deficitScore || 0) * Math.pow(0.5, 1 / config.deficitHalfLifeCycles);
    return { memberId: ms.memberId, deficitScore: parseFloat(total.toFixed(4)), cycleWins: 0, roundWins: 0 };
  }).sort((a, b) => queueSort(a, b, 1));

  addLog('Phase 6', 'Complete', `Satisfaction: ${memberSatisfaction.map((m) => `${m.memberId}=${m.averageSatisfaction}`).join(', ')}`);

  const scores = memberSatisfaction.map((m) => m.averageSatisfaction);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const stdDev = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length);

  return {
    assignments,
    fairness: { memberSatisfaction, updatedPriorityQueue: updatedQueue, workingQueueFinal: workingQueue, deviation: { mean, stdDev } },
    metadata: {
      totalRounds: maxRounds,
      totalConflicts: log.filter((l) => l.action === 'Conflict Won').length,
      totalProximity: log.filter((l) => l.action === 'Proximity').length,
      totalAuto: assignments.filter((a) => a.assignmentType === 'AUTO_ASSIGNED').length,
      totalBackfill: assignments.filter((a) => a.assignmentType === 'BACKFILL_ASSIGNED').length,
    },
    engineLog: log,
    errors,
    warnings,
  };
}

function findProximitySlot(target, shiftType, assignedSlots, slots, demandMap, maxDays, cycle, blockedSlotSet) {
  if (!target) return null;
  const candidates = [];
  for (let d = 1; d <= maxDays; d += 1) {
    [1, -1].forEach((dir) => {
      const cand = addDays(target, d * dir);
      const slotKey = `${cand}:${shiftType}`;
      if (
        cand >= cycle.startDate
        && cand <= cycle.endDate
        && slots.some((s) => s.date === cand)
        && !assignedSlots.has(slotKey)
        && !blockedSlotSet.has(slotKey)
      ) {
        const demand = demandMap[cand]?.demandCount || 0;
        candidates.push({ date: cand, score: (maxDays - d) * 2 - demand * 3 });
      }
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].date;
}

function findAvailableDSDate(first, second, assignedSlots, slots, blockedDateSet, blockedSlotSet, preferredShift = 'DS1') {
  if (first && !blockedDateSet.has(first) && !blockedSlotSet.has(`${first}:${preferredShift}`) && !assignedSlots.has(`${first}:${preferredShift}`) && slots.some((s) => s.date === first)) return first;
  if (second && !blockedDateSet.has(second) && !blockedSlotSet.has(`${second}:${preferredShift}`) && !assignedSlots.has(`${second}:${preferredShift}`) && slots.some((s) => s.date === second)) return second;
  return findAnyDSDate(assignedSlots, slots, blockedDateSet, blockedSlotSet, preferredShift);
}

function findAnyDSDate(assignedSlots, slots, blockedDateSet, blockedSlotSet, preferredShift = 'DS1') {
  for (const slot of slots) {
    if (blockedDateSet.has(slot.date)) continue;
    const key = `${slot.date}:${preferredShift}`;
    if (!blockedSlotSet.has(key) && !assignedSlots.has(key)) return slot.date;
  }
  return null;
}

function findAnyShiftDate(assignedSlots, slots, blockedDateSet, blockedSlotSet, shiftType) {
  for (const slot of slots) {
    if (blockedDateSet.has(slot.date)) continue;
    const key = `${slot.date}:${shiftType}`;
    if (!blockedSlotSet.has(key) && !assignedSlots.has(key)) return slot.date;
  }
  return null;
}

export function findAnySlot(assignedSlots, slots, blockedDateSet, blockedSlotSet, preferredShift = 'DS1') {
  const preferredOrder = [preferredShift, 'DS1', 'DS2', 'NS'].filter((v, i, arr) => arr.indexOf(v) === i);
  for (const slot of slots) {
    if (blockedDateSet.has(slot.date)) continue;
    for (const shiftType of preferredOrder) {
      const key = `${slot.date}:${shiftType}`;
      if (!blockedSlotSet.has(key) && !assignedSlots.has(key)) {
        return { date: slot.date, shiftType };
      }
    }
  }
  return null;
}

function findGapCompliantSlot(existingDates, assignedSlots, slots, demandMap, config, blockedDateSet, blockedSlotSet, preferredShift = null) {
  const candidates = [];
  slots.forEach((s) => {
    if (blockedDateSet.has(s.date)) return;
    const shiftsToCheck = preferredShift ? [preferredShift] : SHIFT_ORDER;
    shiftsToCheck.forEach((shiftType) => {
      const key = `${s.date}:${shiftType}`;
      if (!blockedSlotSet.has(key) && !assignedSlots.has(key)) {
        candidates.push({ date: s.date, shiftType });
      }
    });
  });

  if (candidates.length === 0) return null;
  if (existingDates.length === 0) {
    return candidates.sort((a, b) => (demandMap[a.date]?.demandCount || 0) - (demandMap[b.date]?.demandCount || 0))[0];
  }

  const scored = candidates.map((c) => {
    const closest = Math.min(...existingDates.map((d) => daysBetween(c.date, d)));
    if (closest < config.backfillMinGapDays) return null;
    const demandPenalty = (demandMap[c.date]?.demandCount || 0) * 2;
    return { ...c, score: 100 - Math.abs(closest - config.backfillIdealGapDays) * 2 - demandPenalty };
  }).filter(Boolean);
  if (scored.length > 0) {
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  const relaxed = candidates.map((c) => {
    const closest = Math.min(...existingDates.map((d) => daysBetween(c.date, d)));
    const demandPenalty = (demandMap[c.date]?.demandCount || 0) * 2;
    const minGapPenalty = Math.max(0, config.backfillMinGapDays - closest) * 5;
    return { ...c, score: 100 - Math.abs(closest - config.backfillIdealGapDays) * 1.5 - demandPenalty - minGapPenalty };
  });
  relaxed.sort((a, b) => b.score - a.score);
  return relaxed[0] || candidates[0];
}
