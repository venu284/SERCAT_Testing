import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { cycles } from '../../../../db/schema/cycles.js';
import { preferences } from '../../../../db/schema/preferences.js';
import { fractionalPreferences } from '../../../../db/schema/fractional-preferences.js';
import { users } from '../../../../db/schema/users.js';
import { institutions } from '../../../../db/schema/institutions.js';
import { withAuth } from '../../../../lib/middleware/with-auth.js';
import { withMethod } from '../../../../lib/middleware/with-method.js';
import { sendEmail } from '../../../../lib/email.js';
import { preferenceConfirmationEmail } from '../../../../lib/email-templates.js';
import { createNotification } from '../../../../lib/notifications.js';

const submitPreferenceSchema = z.object({
  preferences: z.array(z.object({
    shareIndex: z.number().int().min(1),
    shift: z.enum(['DS1', 'DS2', 'NS']),
    choice1Date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    choice2Date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })).default([]),
  fractionalPreferences: z.array(z.object({
    blockIndex: z.number().int().min(1),
    fractionalHours: z.number().positive(),
    choice1Date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    choice2Date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })).default([]),
});

function getZodMessage(err) {
  return err.issues?.[0]?.message || err.errors?.[0]?.message || 'Invalid request';
}

function formatPreferenceLabel(pref) {
  if (pref.fractionalHours) {
    return `Fractional Block ${pref.blockIndex} (${pref.fractionalHours}h)`;
  }
  return `Share ${pref.shareIndex} ${pref.shift}`;
}

async function handler(req, res) {
  try {
    const { id: cycleId } = req.query;

    const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found', code: 'NOT_FOUND' });
    }

    if (req.method === 'GET') {
      if (req.user.role === 'admin') {
        const wholeRows = await db
          .select({
            id: preferences.id,
            cycleId: preferences.cycleId,
            piId: preferences.piId,
            piName: users.name,
            piEmail: users.email,
            institutionName: institutions.name,
            institutionId: users.institutionId,
            shareIndex: preferences.shareIndex,
            shift: preferences.shift,
            choice1Date: preferences.choice1Date,
            choice2Date: preferences.choice2Date,
            submittedAt: preferences.submittedAt,
            updatedAt: preferences.updatedAt,
          })
          .from(preferences)
          .innerJoin(users, eq(preferences.piId, users.id))
          .leftJoin(institutions, eq(users.institutionId, institutions.id))
          .where(eq(preferences.cycleId, cycleId))
          .orderBy(users.name, preferences.shareIndex, preferences.shift);

        const fractionalRows = await db
          .select({
            id: fractionalPreferences.id,
            cycleId: fractionalPreferences.cycleId,
            piId: fractionalPreferences.piId,
            piName: users.name,
            piEmail: users.email,
            institutionName: institutions.name,
            institutionId: users.institutionId,
            blockIndex: fractionalPreferences.blockIndex,
            fractionalHours: fractionalPreferences.fractionalHours,
            choice1Date: fractionalPreferences.choice1Date,
            choice2Date: fractionalPreferences.choice2Date,
            submittedAt: fractionalPreferences.submittedAt,
            updatedAt: fractionalPreferences.updatedAt,
          })
          .from(fractionalPreferences)
          .innerJoin(users, eq(fractionalPreferences.piId, users.id))
          .leftJoin(institutions, eq(users.institutionId, institutions.id))
          .where(eq(fractionalPreferences.cycleId, cycleId))
          .orderBy(users.name, fractionalPreferences.blockIndex);

        const submissions = new Map();
        [...wholeRows, ...fractionalRows].forEach((row) => {
          if (!row.piId) return;
          const current = submissions.get(row.piId);
          const nextSubmittedAt = row.submittedAt || row.updatedAt || null;
          if (!current || String(nextSubmittedAt || '') > String(current.submittedAt || '')) {
            submissions.set(row.piId, {
              piId: row.piId,
              piName: row.piName,
              piEmail: row.piEmail,
              institutionId: row.institutionId,
              institutionName: row.institutionName,
              submittedAt: nextSubmittedAt,
              updatedAt: row.updatedAt || null,
            });
          }
        });

        return res.status(200).json({
          data: {
            preferences: wholeRows,
            fractionalPreferences: fractionalRows,
            submissions: Array.from(submissions.values()),
          },
        });
      }

      const wholeRows = await db
        .select()
        .from(preferences)
        .where(and(eq(preferences.cycleId, cycleId), eq(preferences.piId, req.user.userId)))
        .orderBy(preferences.shareIndex, preferences.shift);

      const fractionalRows = await db
        .select()
        .from(fractionalPreferences)
        .where(and(eq(fractionalPreferences.cycleId, cycleId), eq(fractionalPreferences.piId, req.user.userId)))
        .orderBy(fractionalPreferences.blockIndex);

      const submittedAt = [
        ...wholeRows.map((row) => row.submittedAt),
        ...fractionalRows.map((row) => row.submittedAt),
      ].filter(Boolean).sort().at(-1) || null;

      return res.status(200).json({
        data: {
          preferences: wholeRows,
          fractionalPreferences: fractionalRows,
          submittedAt,
          submissions: submittedAt ? [{ piId: req.user.userId, submittedAt }] : [],
        },
      });
    }

    if (!['collecting', 'setup'].includes(cycle.status)) {
      return res.status(400).json({
        error: `Cannot submit preferences when cycle is in "${cycle.status}" status`,
        code: 'INVALID_CYCLE_STATUS',
      });
    }

    const body = submitPreferenceSchema.parse(req.body);
    const piId = req.user.userId;
    const now = new Date();
    const [piUser] = await db.select().from(users).where(eq(users.id, piId)).limit(1);
    const institutionId = piUser?.institutionId || null;

    if (!institutionId) {
      return res.status(400).json({ error: 'PI institution is missing', code: 'MISSING_INSTITUTION' });
    }

    await db.delete(preferences).where(
      and(eq(preferences.cycleId, cycleId), eq(preferences.piId, piId)),
    );
    await db.delete(fractionalPreferences).where(
      and(eq(fractionalPreferences.cycleId, cycleId), eq(fractionalPreferences.piId, piId)),
    );

    if (body.preferences.length > 0) {
      const rows = body.preferences.map((p) => ({
        cycleId,
        piId,
        institutionId,
        shareIndex: p.shareIndex,
        shift: p.shift,
        choice1Date: p.choice1Date || null,
        choice2Date: p.choice2Date || null,
        submittedAt: now,
        updatedAt: now,
      }));

      await db.insert(preferences).values(rows);
    }

    if (body.fractionalPreferences.length > 0) {
      await db.insert(fractionalPreferences).values(body.fractionalPreferences.map((p) => ({
        cycleId,
        piId,
        institutionId,
        blockIndex: p.blockIndex,
        fractionalHours: String(p.fractionalHours),
        choice1Date: p.choice1Date || null,
        choice2Date: p.choice2Date || null,
        submittedAt: now,
        updatedAt: now,
      })));
    }

    const insertedWhole = await db
      .select()
      .from(preferences)
      .where(and(eq(preferences.cycleId, cycleId), eq(preferences.piId, piId)))
      .orderBy(preferences.shareIndex, preferences.shift);

    const insertedFractional = await db
      .select()
      .from(fractionalPreferences)
      .where(and(eq(fractionalPreferences.cycleId, cycleId), eq(fractionalPreferences.piId, piId)))
      .orderBy(fractionalPreferences.blockIndex);

    if (piUser) {
      const preferenceSummary = [...body.preferences, ...body.fractionalPreferences]
        .filter((p) => p.choice1Date)
        .map((p) => `${formatPreferenceLabel(p)}: 1st choice ${p.choice1Date}${p.choice2Date ? `, 2nd choice ${p.choice2Date}` : ''}`)
        .join('<br>');

      void sendEmail({
        to: piUser.email,
        ...preferenceConfirmationEmail({
          name: piUser.name,
          cycleName: cycle.name,
          preferenceSummary,
        }),
      });

      await createNotification({
        userId: req.user.userId,
        type: 'preference_confirmed',
        title: 'Preferences Submitted',
        message: `Your preferences for ${cycle.name || 'the current cycle'} have been recorded.`,
      });
    }

    return res.status(200).json({
      data: {
        preferences: insertedWhole,
        fractionalPreferences: insertedFractional,
        submittedAt: now.toISOString(),
        submissions: [{ piId, submittedAt: now.toISOString() }],
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Preferences error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod(['GET', 'POST'], withAuth(handler));
