import { and, desc, eq, inArray, isNull, lte, ne } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { cycles } from '../../db/schema/cycles.js';
import { cycleShares } from '../../db/schema/cycle-shares.js';
import { preferences } from '../../db/schema/preferences.js';
import { fractionalPreferences } from '../../db/schema/fractional-preferences.js';
import { preferenceHistory } from '../../db/schema/preference-history.js';
import { deficitHistory } from '../../db/schema/deficit-history.js';
import { availableDates } from '../../db/schema/available-dates.js';
import { users } from '../../db/schema/users.js';
import { institutions } from '../../db/schema/institutions.js';
import { schedules } from '../../db/schema/schedules.js';
import { scheduleAssignments } from '../../db/schema/schedule-assignments.js';
import { runAnalytics } from '../../db/schema/run-analytics.js';
import { DEFAULT_CONFIG } from './config.js';
import { generateDateRange } from './dates.js';

function normalizeDateOnly(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0];
}

function assignmentReasonToSatisfaction(assignmentReason, choiceRank) {
  if (choiceRank === 1) return 1;
  if (choiceRank === 2) return 0.6;
  if (['auto_assigned', 'fractional_packed'].includes(assignmentReason)) return 0.5;
  return 0.2;
}

function buildCycleAgeMap(currentCycle, allCycles) {
  const previousCycles = allCycles
    .filter((cycle) => cycle.id !== currentCycle.id && normalizeDateOnly(cycle.endDate) <= normalizeDateOnly(currentCycle.endDate))
    .sort((a, b) => normalizeDateOnly(b.endDate).localeCompare(normalizeDateOnly(a.endDate)));

  return new Map(previousCycles.map((cycle, index) => [cycle.id, index]));
}

export async function loadEngineInput(cycleId) {
  const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
  if (!cycle) throw new Error(`Cycle ${cycleId} not found`);

  const shareRows = await db
    .select({
      piId: cycleShares.piId,
      institutionId: cycleShares.institutionId,
      institutionAbbreviation: institutions.abbreviation,
      institutionName: institutions.name,
      wholeShares: cycleShares.wholeShares,
      fractionalShares: cycleShares.fractionalShares,
      piName: users.name,
      piEmail: users.email,
      isActive: users.isActive,
    })
    .from(cycleShares)
    .innerJoin(users, eq(cycleShares.piId, users.id))
    .innerJoin(institutions, eq(cycleShares.institutionId, institutions.id))
    .where(and(eq(cycleShares.cycleId, cycleId), eq(users.isActive, true), isNull(users.deletedAt)));

  const shares = shareRows.map((row) => ({
    piId: row.piId,
    institutionId: row.institutionId,
    institutionAbbreviation: row.institutionAbbreviation,
    institutionName: row.institutionName,
    memberId: row.institutionAbbreviation,
    wholeShares: Number(row.wholeShares) || 0,
    fractionalShares: Number(row.fractionalShares) || 0,
    piName: row.piName,
    piEmail: row.piEmail,
    isActive: Boolean(row.isActive),
  }));

  const piIdToAbbr = Object.fromEntries(shares.map((row) => [row.piId, row.memberId]));
  const abbrToPiId = Object.fromEntries(shares.map((row) => [row.memberId, row.piId]));
  const abbrToInstitutionId = Object.fromEntries(shares.map((row) => [row.memberId, row.institutionId]));
  const institutionIds = [...new Set(shares.map((row) => row.institutionId))];

  const preferenceRows = await db
    .select()
    .from(preferences)
    .where(eq(preferences.cycleId, cycleId))
    .orderBy(preferences.piId, preferences.shareIndex, preferences.shift);

  const enginePreferences = preferenceRows
    .map((row) => ({
      piId: row.piId,
      institutionId: row.institutionId,
      memberId: piIdToAbbr[row.piId],
      shareIndex: row.shareIndex,
      shift: row.shift,
      choice1Date: normalizeDateOnly(row.choice1Date),
      choice2Date: normalizeDateOnly(row.choice2Date),
    }))
    .filter((row) => row.memberId && row.institutionId);

  const fractionalRows = await db
    .select()
    .from(fractionalPreferences)
    .where(eq(fractionalPreferences.cycleId, cycleId))
    .orderBy(fractionalPreferences.piId, fractionalPreferences.blockIndex);

  const engineFractionalPreferences = fractionalRows
    .map((row) => ({
      piId: row.piId,
      institutionId: row.institutionId,
      memberId: piIdToAbbr[row.piId],
      blockIndex: row.blockIndex,
      fractionalHours: Number(row.fractionalHours) || 0,
      choice1Date: normalizeDateOnly(row.choice1Date),
      choice2Date: normalizeDateOnly(row.choice2Date),
    }))
    .filter((row) => row.memberId && row.institutionId);

  const availabilityRows = await db
    .select()
    .from(availableDates)
    .where(eq(availableDates.cycleId, cycleId));

  const blockedDates = availabilityRows
    .filter((row) => !row.isAvailable)
    .map((row) => normalizeDateOnly(row.date))
    .sort();

  const blockedSlots = [];
  availabilityRows.forEach((row) => {
    const date = normalizeDateOnly(row.date);
    if (row.isAvailable) {
      if (row.ds1Available === false) blockedSlots.push(`${date}:DS1`);
      if (row.ds2Available === false) blockedSlots.push(`${date}:DS2`);
      if (row.nsAvailable === false) blockedSlots.push(`${date}:NS`);
    }
  });

  const explicitAvailable = availabilityRows
    .filter((row) => row.isAvailable)
    .map((row) => normalizeDateOnly(row.date))
    .sort();

  const allDates = generateDateRange(normalizeDateOnly(cycle.startDate), normalizeDateOnly(cycle.endDate));
  const available = explicitAvailable.length > 0
    ? explicitAvailable
    : allDates.filter((date) => !blockedDates.includes(date));

  const allCycles = await db.select({ id: cycles.id, endDate: cycles.endDate }).from(cycles).where(lte(cycles.endDate, cycle.endDate));
  const cycleAgeMap = buildCycleAgeMap(cycle, allCycles);

  const priorDeficitRows = institutionIds.length > 0
    ? await db
      .select()
      .from(deficitHistory)
      .where(and(inArray(deficitHistory.institutionId, institutionIds), ne(deficitHistory.cycleId, cycleId)))
    : [];

  const engineDeficitHistory = priorDeficitRows.map((row) => ({
    institutionId: row.institutionId,
    shift: row.shift,
    deficitScore: Number(row.deficitScore) || 0,
    cycleId: row.cycleId,
    cycleAge: cycleAgeMap.get(row.cycleId) ?? 0,
  }));

  const pastAssignmentRows = institutionIds.length > 0
    ? await db
      .select({
        piId: scheduleAssignments.piId,
        institutionId: scheduleAssignments.institutionId,
        cycleId: schedules.cycleId,
        shareIndex: scheduleAssignments.shareIndex,
        shift: scheduleAssignments.shift,
        assignedDate: scheduleAssignments.assignedDate,
        isManualOverride: scheduleAssignments.isManualOverride,
      })
      .from(scheduleAssignments)
      .innerJoin(schedules, eq(scheduleAssignments.scheduleId, schedules.id))
      .where(and(
        inArray(scheduleAssignments.institutionId, institutionIds),
        eq(schedules.status, 'published'),
        ne(schedules.cycleId, cycleId),
      ))
    : [];

  const pastAssignments = pastAssignmentRows.map((row) => ({
    institutionId: row.institutionId,
    piId: row.piId,
    cycleId: row.cycleId,
    shareIndex: row.shareIndex,
    shift: row.shift,
    assignedDate: normalizeDateOnly(row.assignedDate),
    wasManualOverride: Boolean(row.isManualOverride),
  }));

  const preferenceHistoryRows = institutionIds.length > 0
    ? await db
      .select()
      .from(preferenceHistory)
      .where(inArray(preferenceHistory.institutionId, institutionIds))
    : [];

  const enginePreferenceHistory = preferenceHistoryRows.map((row) => ({
    institutionId: row.institutionId,
    piId: row.piId,
    cycleId: row.cycleId,
    shareIndex: row.shareIndex,
    shift: row.shift,
    choice1Date: normalizeDateOnly(row.choice1Date),
    choice2Date: normalizeDateOnly(row.choice2Date),
    assignedDate: normalizeDateOnly(row.assignedDate),
    choiceRank: row.choiceRank,
    assignmentReason: row.assignmentReason,
    satisfactionScore: assignmentReasonToSatisfaction(row.assignmentReason, row.choiceRank),
  }));

  const [latestDraft] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.cycleId, cycleId), eq(schedules.status, 'draft')))
    .orderBy(desc(schedules.version))
    .limit(1);

  let previousDraft = null;
  if (latestDraft) {
    const [draftAnalytics] = await db
      .select()
      .from(runAnalytics)
      .where(eq(runAnalytics.scheduleId, latestDraft.id))
      .limit(1);

    const draftAssignments = await db
      .select({
        piId: scheduleAssignments.piId,
        institutionId: scheduleAssignments.institutionId,
        memberId: institutions.abbreviation,
        shareIndex: scheduleAssignments.shareIndex,
        blockIndex: scheduleAssignments.blockIndex,
        shift: scheduleAssignments.shift,
        assignedDate: scheduleAssignments.assignedDate,
        assignmentReason: scheduleAssignments.assignmentReason,
        choiceRank: scheduleAssignments.choiceRank,
      })
      .from(scheduleAssignments)
      .innerJoin(institutions, eq(scheduleAssignments.institutionId, institutions.id))
      .where(eq(scheduleAssignments.scheduleId, latestDraft.id));

    previousDraft = {
      assignments: draftAssignments.map((row) => ({
        ...row,
        assignedDate: normalizeDateOnly(row.assignedDate),
      })),
      satisfaction: draftAnalytics?.piSatisfactionScores || [],
      fairnessMetrics: {
        overallStdDev: Number(draftAnalytics?.fairnessStdDeviation || 0),
      },
    };
  }

  return {
    shares,
    preferences: enginePreferences,
    fractionalPreferences: engineFractionalPreferences,
    availableDates: available,
    blockedSlots,
    deficitHistory: engineDeficitHistory,
    preferenceHistory: enginePreferenceHistory,
    pastAssignments,
    config: DEFAULT_CONFIG,
    previousDraft,
    cycleDates: {
      startDate: normalizeDateOnly(cycle.startDate),
      endDate: normalizeDateOnly(cycle.endDate),
      blockedDates,
    },
    _cycleId: cycleId,
    _abbrToPiId: abbrToPiId,
    _abbrToInstitutionId: abbrToInstitutionId,
  };
}
