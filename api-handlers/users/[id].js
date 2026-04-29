import { z } from 'zod';
import { eq, and, ilike, ne } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { institutions } from '../../db/schema/institutions.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import { generateToken, hashToken, tokenExpiresAt } from '../../lib/auth-utils.js';
import { getZodMessage } from '../../lib/validation.js';

const updateUserSchema = z.object({
  email: z.string().email().trim().toLowerCase().optional(),
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().nullable().optional(),
  roleTitle: z.string().trim().nullable().optional(),
  institutionId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  resetActivation: z.boolean().optional(),
  activationToken: z.string().trim().min(1).optional(),
});


async function handler(req, res) {
  try {
    const { id } = req.query;
    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.userId === id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }

    if (req.method === 'PUT') {
      const parsedBody = updateUserSchema.parse(req.body);
      const forbiddenSelfUpdate = !isAdmin && (
        parsedBody.institutionId !== undefined
        || parsedBody.isActive !== undefined
        || parsedBody.resetActivation !== undefined
        || parsedBody.activationToken !== undefined
      );

      if (forbiddenSelfUpdate) {
        return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
      }

      const body = isAdmin
        ? parsedBody
        : {
          name: parsedBody.name,
          phone: parsedBody.phone,
          roleTitle: parsedBody.roleTitle,
        };

      if (body.email) {
        const [dup] = await db
          .select()
          .from(users)
          .where(and(ilike(users.email, body.email), ne(users.id, id)))
          .limit(1);
        if (dup) {
          return res.status(409).json({
            error: `Email "${body.email}" is already registered`,
            code: 'DUPLICATE',
          });
        }
      }

      if (body.institutionId) {
        const [inst] = await db
          .select()
          .from(institutions)
          .where(eq(institutions.id, body.institutionId))
          .limit(1);
        if (!inst) {
          return res.status(400).json({ error: 'Institution not found', code: 'INVALID_INSTITUTION' });
        }
      }

      const updateData = { ...body, updatedAt: new Date() };
      delete updateData.resetActivation;
      delete updateData.activationToken;

      let activationToken = null;
      if (body.resetActivation) {
        activationToken = body.activationToken || generateToken();
        updateData.activationTokenHash = hashToken(activationToken);
        updateData.activationTokenExpiresAt = tokenExpiresAt(72);
        updateData.isActivated = false;
        updateData.passwordHash = null;
        updateData.lastLoginAt = null;
      }

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          phone: users.phone,
          roleTitle: users.roleTitle,
          institutionId: users.institutionId,
          isActive: users.isActive,
          isActivated: users.isActivated,
        });

      await logAudit(req.user.userId, 'user.update', { targetUserId: id, changes: body });
      return res.status(200).json({
        data: {
          ...updated,
          activationToken,
        },
      });
    }

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
    }

    if (req.query.permanent === 'true') {
      if (existing.isActive) {
        return res.status(400).json({ error: 'User must be deactivated before permanent deletion', code: 'MUST_DEACTIVATE_FIRST' });
      }
      const anonymizedEmail = `deleted-${id}@removed.local`;
      const [anonymized] = await db
        .update(users)
        .set({
          name: 'Deleted Member',
          email: anonymizedEmail,
          phone: null,
          roleTitle: null,
          pendingEmail: null,
          activationTokenHash: null,
          activationTokenExpiresAt: null,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
          emailVerifyTokenHash: null,
          emailVerifyTokenExpiresAt: null,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({ id: users.id });
      await logAudit(req.user.userId, 'user.permanentDelete', { targetUserId: id, originalEmail: existing.email });
      return res.status(200).json({ data: anonymized });
    }

    if (existing.role === 'admin') {
      const adminRows = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));
      if (adminRows.length <= 1) {
        return res.status(400).json({ error: 'Cannot deactivate the last admin', code: 'LAST_ADMIN' });
      }
    }

    const [deactivated] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
      });

    await logAudit(req.user.userId, 'user.deactivate', { targetUserId: id, email: existing.email });
    return res.status(200).json({ data: deactivated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('User update error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAuth(withMethod(['PUT', 'DELETE'], handler));
