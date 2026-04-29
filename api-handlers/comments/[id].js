import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { comments } from '../../db/schema/comments.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import { getZodMessage } from '../../lib/validation.js';

const updateCommentSchema = z.object({
  status: z.enum(['read', 'resolved']).optional(),
});


async function handler(req, res) {
  try {
    const { id } = req.query;
    const body = updateCommentSchema.parse(req.body || {});

    const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found', code: 'NOT_FOUND' });
    }

    if (!body.status) {
      return res.status(400).json({ error: 'No changes requested', code: 'VALIDATION_ERROR' });
    }

    if (body.status === 'read') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can mark comments as read', code: 'FORBIDDEN' });
      }
      if (comment.status !== 'sent') {
        return res.status(200).json({ data: comment });
      }
    }

    if (body.status === 'resolved') {
      if (req.user.role !== 'pi') {
        return res.status(403).json({ error: 'Only the PI can resolve their comment', code: 'FORBIDDEN' });
      }
      if (comment.piId !== req.user.userId) {
        return res.status(403).json({ error: 'You can only resolve your own comments', code: 'FORBIDDEN' });
      }
    }

    const now = new Date();
    const [updated] = await db
      .update(comments)
      .set({
        status: body.status,
        readAt: body.status === 'read' ? (comment.readAt || now) : comment.readAt,
        updatedAt: now,
      })
      .where(eq(comments.id, id))
      .returning();

    await logAudit(req.user.userId, 'comment.update', {
      commentId: id,
      status: updated.status,
    });

    return res.status(200).json({ data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Update comment error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('PUT', withAuth(handler));
