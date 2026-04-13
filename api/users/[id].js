import { z } from 'zod';
import { eq, and, ilike, ne } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { institutions } from '../../db/schema/institutions.js';
import { withAdmin } from '../../lib/middleware/with-admin.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import { generateToken, tokenExpiresAt } from '../../lib/auth-utils.js';

const updateUserSchema = z.object({
  email: z.string().email().trim().toLowerCase().optional(),
  name: z.string().trim().min(1).optional(),
  institutionId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  resetActivation: z.boolean().optional(),
  activationToken: z.string().trim().min(1).optional(),
});

function getZodMessage(err) {
  return err.issues?.[0]?.message || err.errors?.[0]?.message || 'Invalid request';
}

async function handler(req, res) {
  try {
    const { id } = req.query;

    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }

    if (req.method === 'PUT') {
      const body = updateUserSchema.parse(req.body);

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
        updateData.activationToken = activationToken;
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

export default withAdmin(withMethod(['PUT', 'DELETE'], handler));
