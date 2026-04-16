import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/index.js';
import { comments } from '../../../db/schema/comments.js';
import { withAdmin } from '../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../lib/middleware/with-method.js';
import { logAudit } from '../../../lib/audit.js';

const updateCommentSchema = z.object({
  status: z.enum(['read', 'replied']).optional(),
  adminReply: z.string().optional(),
});

function getZodMessage(err) {
  return err.issues?.[0]?.message || err.errors?.[0]?.message || 'Invalid request';
}

async function handler(req, res) {
  try {
    const { id } = req.query;
    const body = updateCommentSchema.parse(req.body || {});

    const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found', code: 'NOT_FOUND' });
    }

    const adminReply = String(body.adminReply || '').trim();
    if (!adminReply && !body.status) {
      return res.status(400).json({ error: 'No changes requested', code: 'VALIDATION_ERROR' });
    }
    if (body.status === 'replied' && !adminReply) {
      return res.status(400).json({ error: 'Reply message is required.', code: 'VALIDATION_ERROR' });
    }

    const now = new Date();
    let updated = comment;

    if (adminReply) {
      [updated] = await db
        .update(comments)
        .set({
          status: 'replied',
          adminReply,
          adminReplyBy: req.user.userId,
          adminReplyAt: now,
          readAt: comment.readAt || now,
          updatedAt: now,
        })
        .where(eq(comments.id, id))
        .returning();
    } else if (body.status === 'read' && comment.status === 'sent') {
      [updated] = await db
        .update(comments)
        .set({
          status: 'read',
          readAt: comment.readAt || now,
          updatedAt: now,
        })
        .where(eq(comments.id, id))
        .returning();
    }

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

export default withMethod('PUT', withAdmin(handler));
