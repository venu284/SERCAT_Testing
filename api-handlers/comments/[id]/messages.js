import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/index.js';
import { comments } from '../../../db/schema/comments.js';
import { commentMessages } from '../../../db/schema/comments.js';
import { withAuth } from '../../../lib/middleware/with-auth.js';
import { withMethod } from '../../../lib/middleware/with-method.js';
import { logAudit } from '../../../lib/audit.js';
import { getZodMessage } from '../../../lib/validation.js';

const addMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message body is required'),
});


async function handler(req, res) {
  try {
    const { id } = req.query;
    const body = addMessageSchema.parse(req.body);

    const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found', code: 'NOT_FOUND' });
    }

    if (req.user.role === 'pi') {
      if (comment.piId !== req.user.userId) {
        return res.status(403).json({ error: 'You can only reply to your own comments', code: 'FORBIDDEN' });
      }
      if (comment.status === 'resolved') {
        return res.status(400).json({ error: 'Cannot reply to a resolved conversation', code: 'VALIDATION_ERROR' });
      }
    }

    const now = new Date();
    const role = req.user.role === 'admin' ? 'admin' : 'pi';

    const [message] = await db.insert(commentMessages).values({
      commentId: id,
      authorId: req.user.userId,
      role,
      body: body.body,
      createdAt: now,
    }).returning();

    const newStatus = role === 'admin' ? 'replied' : 'sent';
    await db
      .update(comments)
      .set({
        status: newStatus,
        readAt: role === 'admin' ? (comment.readAt || now) : comment.readAt,
        updatedAt: now,
      })
      .where(eq(comments.id, id));

    await logAudit(req.user.userId, 'comment.message.add', {
      commentId: id,
      role,
    });

    return res.status(201).json({ data: message });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Add comment message error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('POST', withAuth(handler));
