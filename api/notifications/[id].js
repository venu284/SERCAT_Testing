import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { notifications } from '../../../db/schema/notifications.js';
import { withAuth } from '../../../lib/middleware/with-auth.js';
import { withMethod } from '../../../lib/middleware/with-method.js';

async function handler(req, res) {
  try {
    const { id } = req.query;

    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, req.user.userId)))
      .limit(1);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found', code: 'NOT_FOUND' });
    }

    if (notification.isRead) {
      return res.status(200).json({ data: notification });
    }

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();

    return res.status(200).json({ data: updated });
  } catch (err) {
    console.error('Update notification error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('PUT', withAuth(handler));
