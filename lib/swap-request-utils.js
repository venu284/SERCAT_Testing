import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { cycles } from '../db/schema/cycles.js';
import { institutions } from '../db/schema/institutions.js';
import { scheduleAssignments } from '../db/schema/schedule-assignments.js';
import { schedules } from '../db/schema/schedules.js';
import { swapRequests } from '../db/schema/swap-requests.js';
import { users } from '../db/schema/users.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateString(value) {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

export function serializePreferredDates(preferredDates) {
  if (!Array.isArray(preferredDates)) {
    return null;
  }

  const normalized = preferredDates
    .map((value) => String(value || '').trim())
    .filter((value) => isIsoDateString(value));

  return normalized.length > 0 ? normalized : null;
}

export function parsePreferredDates(preferredDates) {
  if (Array.isArray(preferredDates)) {
    return preferredDates
      .map((value) => String(value || '').trim())
      .filter((value) => isIsoDateString(value));
  }

  // Fallback for any legacy string rows still in DB during migration window
  if (typeof preferredDates === 'string' && preferredDates.trim()) {
    try {
      const parsed = JSON.parse(preferredDates);
      return Array.isArray(parsed)
        ? parsed
          .map((value) => String(value || '').trim())
          .filter((value) => isIsoDateString(value))
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function mapSwapRequestRow(row) {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    requesterId: row.requesterId,
    targetAssignmentId: row.targetAssignmentId,
    preferredDates: parsePreferredDates(row.preferredDates),
    status: row.status,
    adminNotes: row.adminNotes,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    institutionId: row.institutionId,
    institutionName: row.institutionName,
    institutionAbbreviation: row.institutionAbbreviation,
    scheduleStatus: row.scheduleStatus,
    cycleId: row.cycleId,
    cycleName: row.cycleName,
    targetAssignment: {
      id: row.targetAssignmentId,
      assignedDate: row.targetAssignmentAssignedDate,
      shift: row.targetAssignmentShift,
      shareIndex: row.targetAssignmentShareIndex,
      blockIndex: row.targetAssignmentBlockIndex,
    },
  };
}

export const swapRequestSelectFields = {
  id: swapRequests.id,
  scheduleId: swapRequests.scheduleId,
  requesterId: swapRequests.requesterId,
  targetAssignmentId: swapRequests.targetAssignmentId,
  preferredDates: swapRequests.preferredDates,
  status: swapRequests.status,
  adminNotes: swapRequests.adminNotes,
  reviewedBy: swapRequests.reviewedBy,
  reviewedAt: swapRequests.reviewedAt,
  createdAt: swapRequests.createdAt,
  requesterName: users.name,
  requesterEmail: users.email,
  institutionId: institutions.id,
  institutionName: institutions.name,
  institutionAbbreviation: institutions.abbreviation,
  targetAssignmentAssignedDate: scheduleAssignments.assignedDate,
  targetAssignmentShift: scheduleAssignments.shift,
  targetAssignmentShareIndex: scheduleAssignments.shareIndex,
  targetAssignmentBlockIndex: scheduleAssignments.blockIndex,
  scheduleStatus: schedules.status,
  cycleId: schedules.cycleId,
  cycleName: cycles.name,
};

export function swapRequestBaseQuery() {
  return db
    .select(swapRequestSelectFields)
    .from(swapRequests)
    .innerJoin(users, eq(swapRequests.requesterId, users.id))
    .leftJoin(institutions, eq(users.institutionId, institutions.id))
    .innerJoin(scheduleAssignments, eq(swapRequests.targetAssignmentId, scheduleAssignments.id))
    .innerJoin(schedules, eq(swapRequests.scheduleId, schedules.id))
    .leftJoin(cycles, eq(schedules.cycleId, cycles.id));
}

export async function fetchSwapRequestRow(id) {
  const [row] = await swapRequestBaseQuery()
    .where(eq(swapRequests.id, id))
    .limit(1);

  return row || null;
}
