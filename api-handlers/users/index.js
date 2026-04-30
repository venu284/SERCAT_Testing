import { z } from 'zod';
import { eq, count, ilike, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { institutions } from '../../db/schema/institutions.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { logAudit } from '../../lib/audit.js';
import { generateToken, hashToken, tokenExpiresAt } from '../../lib/auth-utils.js';
import { sendEmail } from '../../lib/email.js';
import { accountInviteEmail } from '../../lib/email-templates.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { getZodMessage, emailSchema, uuidSchema } from '../../lib/validation.js';
import { ROLES } from '../../lib/constants.js';

const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1, 'Name is required'),
  role: z.enum(['admin', 'pi']).default('pi'),
  institutionId: uuidSchema.nullable().optional(),
});


async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (req.user.role !== ROLES.ADMIN) {
        const rows = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            institutionId: users.institutionId,
            institutionName: institutions.name,
            institutionAbbreviation: institutions.abbreviation,
            isActive: users.isActive,
            isActivated: users.isActivated,
            lastLoginAt: users.lastLoginAt,
            createdAt: users.createdAt,
          })
          .from(users)
          .leftJoin(institutions, eq(users.institutionId, institutions.id))
          .where(eq(users.id, req.user.userId))
          .limit(1);

        return res.status(200).json(paginatedResponse(rows, rows.length, 1, 50));
      }

      const { page, limit, offset } = parsePagination(req.query || {});
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          institutionId: users.institutionId,
          institutionName: institutions.name,
          institutionAbbreviation: institutions.abbreviation,
          isActive: users.isActive,
          isActivated: users.isActivated,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .leftJoin(institutions, eq(users.institutionId, institutions.id))
        .where(isNull(users.deletedAt))
        .orderBy(users.name)
        .limit(limit)
        .offset(offset);

      const [{ total }] = await db.select({ total: count() }).from(users).where(isNull(users.deletedAt));
      return res.status(200).json(paginatedResponse(rows, Number(total), page, limit));
    }

    const body = createUserSchema.parse(req.body);
    if (req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
    }

    const [existing] = await db.select().from(users).where(ilike(users.email, body.email)).limit(1);
    if (existing) {
      return res.status(409).json({
        error: `Email "${body.email}" is already registered`,
        code: 'DUPLICATE',
      });
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

    const activationToken = generateToken();
    const activationTokenExpiresAt = tokenExpiresAt(72);

    const [created] = await db.insert(users).values({
      email: body.email,
      name: body.name,
      role: body.role,
      institutionId: body.institutionId || null,
      isActive: true,
      isActivated: false,
      activationTokenHash: hashToken(activationToken),
      activationTokenExpiresAt,
    }).returning();

    await logAudit(req.user.userId, 'user.create', {
      newUserId: created.id,
      email: body.email,
      role: body.role,
    });

    const emailData = accountInviteEmail({
      name: body.name,
      email: body.email,
      activationToken,
      institutionName: null,
    });
    const emailResult = await sendEmail({ to: body.email, ...emailData });
    if (!emailResult.ok) {
      console.warn('[INVITE] Email failed to send to', body.email, ':', emailResult.error);
    }

    return res.status(201).json({
      data: {
        user: {
          id: created.id,
          email: created.email,
          name: created.name,
          role: created.role,
          institutionId: created.institutionId,
          isActive: created.isActive,
          isActivated: created.isActivated,
        },
        activationToken,
        emailSent: emailResult.ok,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: getZodMessage(err), code: 'VALIDATION_ERROR' });
    }
    console.error('Users error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAuth(withMethod(['GET', 'POST'], handler));
