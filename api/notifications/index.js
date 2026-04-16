import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { notifications } from '../../db/schema/notifications.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withMethod } from '../../lib/middleware/with-method.js';

const markAllSchema = z.object({
  action: z.literal('read-all'),
});

function getZodMessage(err) {
  return err.issues?.[0]?.message || err.errors?.[0]?.message || 'Invalid request';
}

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, req.user.userId))
        .orderBy(desc(notifications.createdAt))
        .limit(50);

      return res.status(200).json({ data: rows });
    }

    markAllSchema.parse(req.body);

    const updated = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, req.user.userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });

    return res.status(200).json({ data: { updated: updated.length } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Notifications error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod(['GET', 'PUT'], withAuth(handler));
