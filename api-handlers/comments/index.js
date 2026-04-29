import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { comments } from '../../db/schema/comments.js';
import { commentMessages } from '../../db/schema/comments.js';
import { users } from '../../db/schema/users.js';
import { institutions } from '../../db/schema/institutions.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { getZodMessage } from '../../lib/validation.js';

const createCommentSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required'),
  message: z.string().trim().min(1, 'Message is required'),
});


async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const baseQuery = db
        .select({
          id: comments.id,
          piId: comments.piId,
          institutionId: comments.institutionId,
          subject: comments.subject,
          status: comments.status,
          readAt: comments.readAt,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          piName: users.name,
          piEmail: users.email,
          institutionName: institutions.name,
          institutionAbbreviation: institutions.abbreviation,
        })
        .from(comments)
        .innerJoin(users, eq(comments.piId, users.id))
        .leftJoin(institutions, eq(comments.institutionId, institutions.id));

      const rows = req.user.role === 'admin'
        ? await baseQuery.orderBy(desc(comments.createdAt))
        : await baseQuery
          .where(eq(comments.piId, req.user.userId))
          .orderBy(desc(comments.createdAt));

      if (rows.length === 0) {
        return res.status(200).json({ data: [] });
      }

      const commentIds = rows.map((r) => r.id);
      const messages = await db
        .select()
        .from(commentMessages)
        .where(inArray(commentMessages.commentId, commentIds))
        .orderBy(commentMessages.createdAt);

      const messagesByCommentId = {};
      for (const msg of messages) {
        if (!messagesByCommentId[msg.commentId]) {
          messagesByCommentId[msg.commentId] = [];
        }
        messagesByCommentId[msg.commentId].push(msg);
      }

      const data = rows.map((row) => ({
        ...row,
        messages: messagesByCommentId[row.id] || [],
      }));

      return res.status(200).json({ data });
    }

    if (req.user.role !== 'pi') {
      return res.status(403).json({ error: 'Only PIs can create comments', code: 'FORBIDDEN' });
    }

    const body = createCommentSchema.parse(req.body);
    const now = new Date();

    const [created] = await db.insert(comments).values({
      piId: req.user.userId,
      institutionId: req.user.institutionId || null,
      subject: body.subject,
      status: 'sent',
      createdAt: now,
      updatedAt: now,
    }).returning();

    await db.insert(commentMessages).values({
      commentId: created.id,
      authorId: req.user.userId,
      role: 'pi',
      body: body.message,
      createdAt: now,
    });

    return res.status(201).json({ data: { ...created, messages: [{ commentId: created.id, authorId: req.user.userId, role: 'pi', body: body.message, createdAt: now }] } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Comments error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod(['GET', 'POST'], withAuth(handler));
