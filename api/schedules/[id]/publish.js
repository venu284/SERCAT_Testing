import { eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { schedules } from '../../../db/schema/schedules.js';
import { scheduleAssignments } from '../../../db/schema/schedule-assignments.js';
import { cycles } from '../../../db/schema/cycles.js';
import { deficitHistory } from '../../../db/schema/deficit-history.js';
import { preferenceHistory } from '../../../db/schema/preference-history.js';
import { preferences } from '../../../db/schema/preferences.js';
import { fractionalPreferences } from '../../../db/schema/fractional-preferences.js';
import { users } from '../../../db/schema/users.js';
import { institutions } from '../../../db/schema/institutions.js';
import { runAnalytics } from '../../../db/schema/run-analytics.js';
import { withAdmin } from '../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../lib/middleware/with-method.js';
import { logAudit } from '../../../lib/audit.js';
import { sendEmail } from '../../../lib/email.js';
import { schedulePublishedEmail } from '../../../lib/email-templates.js';
import { createBulkNotifications } from '../../../lib/notifications.js';

async function handler(req, res) {
  try {
    const { id: scheduleId } = req.query;

    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, scheduleId)).limit(1);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found', code: 'NOT_FOUND' });
    }
    if (schedule.status === 'published') {
      return res.status(400).json({ error: 'Schedule is already published', code: 'ALREADY_PUBLISHED' });
    }

    const now = new Date();

    await db.update(schedules).set({ status: 'published', publishedAt: now }).where(eq(schedules.id, scheduleId));
    await db.update(cycles).set({ status: 'published', updatedAt: now }).where(eq(cycles.id, schedule.cycleId));

    const assignments = await db
      .select({
        piId: scheduleAssignments.piId,
        institutionId: scheduleAssignments.institutionId,
        shift: scheduleAssignments.shift,
        assignedDate: scheduleAssignments.assignedDate,
        choiceRank: scheduleAssignments.choiceRank,
        assignmentReason: scheduleAssignments.assignmentReason,
        shareIndex: scheduleAssignments.shareIndex,
        blockIndex: scheduleAssignments.blockIndex,
      })
      .from(scheduleAssignments)
      .where(eq(scheduleAssignments.scheduleId, scheduleId));

    const wholePrefs = await db.select().from(preferences).where(eq(preferences.cycleId, schedule.cycleId));
    const fractionalPrefs = await db.select().from(fractionalPreferences).where(eq(fractionalPreferences.cycleId, schedule.cycleId));
    const wholePrefMap = {};
    wholePrefs.forEach((p) => {
      wholePrefMap[`${p.piId}:${p.shareIndex}:${p.shift}`] = p;
    });
    const fractionalPrefMap = {};
    fractionalPrefs.forEach((p) => {
      fractionalPrefMap[`${p.piId}:${p.blockIndex}`] = p;
    });

    const historyRows = assignments.map((a) => {
      const pref = a.shareIndex > 0
        ? wholePrefMap[`${a.piId}:${a.shareIndex}:${a.shift}`]
        : fractionalPrefMap[`${a.piId}:${a.blockIndex || 1}`];
      return {
        piId: a.piId,
        institutionId: a.institutionId,
        cycleId: schedule.cycleId,
        shareIndex: a.shareIndex,
        shift: a.shift,
        choice1Date: pref?.choice1Date || null,
        choice2Date: pref?.choice2Date || null,
        assignedDate: a.assignedDate,
        choiceRank: a.choiceRank,
        assignmentReason: a.assignmentReason || null,
      };
    });

    await db.delete(preferenceHistory).where(eq(preferenceHistory.cycleId, schedule.cycleId));

    if (historyRows.length > 0) {
      await db.insert(preferenceHistory).values(historyRows);
    }

    const [analyticsRow] = await db
      .select()
      .from(runAnalytics)
      .where(eq(runAnalytics.scheduleId, scheduleId))
      .limit(1);

    const computedDeficitUpdates = analyticsRow?.detectedPatterns?.deficitUpdates;
    const deficitRows = Array.isArray(computedDeficitUpdates) && computedDeficitUpdates.length > 0
      ? computedDeficitUpdates
        .map((update) => {
          const representative = assignments.find((assignment) => (
            assignment.institutionId === update.institutionId
            && assignment.shift === update.shift
          ));

          return {
            institutionId: update.institutionId,
            cycleId: schedule.cycleId,
            shift: update.shift,
            deficitScore: String(update.newDeficitScore),
          };
        })
        .filter(Boolean)
      : assignments.map((a) => ({
        institutionId: a.institutionId,
        cycleId: schedule.cycleId,
        shift: a.shift,
        deficitScore:
          ['choice1', 'choice1_no_conflict'].includes(a.assignmentReason) ? '0'
            : a.assignmentReason === 'choice2' ? '0.10'
              : a.assignmentReason === 'fallback_proximity' ? '0.20'
                : a.assignmentReason === 'fallback_any' ? '0.35'
                  : a.assignmentReason === 'auto_assigned' ? '0.30'
                    : '0.15',
      }));

    if (deficitRows.length > 0) {
      await db.delete(deficitHistory).where(eq(deficitHistory.cycleId, schedule.cycleId));
      await db.insert(deficitHistory).values(deficitRows);
    }

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, schedule.cycleId)).limit(1);
    const piAssignments = {};
    assignments.forEach((a) => {
      if (!piAssignments[a.piId]) piAssignments[a.piId] = [];
      piAssignments[a.piId].push(a);
    });

    for (const [piId, piAs] of Object.entries(piAssignments)) {
      const [piUser] = await db.select().from(users).where(eq(users.id, piId)).limit(1);
      if (!piUser) continue;

      const summary = piAs
        .sort((a, b) => String(a.assignedDate).localeCompare(String(b.assignedDate)))
        .map((a) => `${a.assignedDate} - ${a.shift}`)
        .join('<br>');

      void sendEmail({
        to: piUser.email,
        ...schedulePublishedEmail({
          name: piUser.name,
          cycleName: cycle?.name || 'Current Cycle',
          assignmentSummary: summary,
        }),
      });
    }

    await createBulkNotifications(Object.keys(piAssignments).map((piId) => ({
      userId: piId,
      type: 'schedule_published',
      title: 'Schedule Published',
      message: `The schedule for ${cycle?.name || 'the current cycle'} has been published. View your assigned shifts in the app.`,
    })));

    await logAudit(req.user.userId, 'schedule.publish', {
      scheduleId,
      cycleId: schedule.cycleId,
      assignmentCount: assignments.length,
    });

    return res.status(200).json({
      data: { message: 'Schedule published', scheduleId, publishedAt: now },
    });
  } catch (err) {
    console.error('Publish schedule error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('POST', withAdmin(handler));
