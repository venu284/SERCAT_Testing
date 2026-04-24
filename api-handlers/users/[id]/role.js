import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema/users.js';
import { withAdmin } from '../../../lib/middleware/with-admin.js';
import { withMethod } from '../../../lib/middleware/with-method.js';
import { logAudit } from '../../../lib/audit.js';
import { getZodMessage } from '../../../lib/validation.js';

const roleSchema = z.object({
  role: z.enum(['admin', 'pi']),
});


async function handler(req, res) {
  try {
    const { id } = req.query;

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }

    const body = roleSchema.parse(req.body);

    if (user.role === 'admin' && body.role === 'pi') {
      const adminRows = await db
        .select()
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));
      if (adminRows.length <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last admin', code: 'LAST_ADMIN' });
      }
    }

    const [updated] = await db
      .update(users)
      .set({ role: body.role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      });

    await logAudit(req.user.userId, 'user.role_change', {
      targetUserId: id,
      from: user.role,
      to: body.role,
    });

    return res.status(200).json({ data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Role change error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod('PUT', handler));
