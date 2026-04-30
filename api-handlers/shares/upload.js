import { z } from 'zod';
import { eq, ilike } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { institutions } from '../../db/schema/institutions.js';
import { users } from '../../db/schema/users.js';
import { masterShares } from '../../db/schema/master-shares.js';
import { withAdmin } from '../../lib/middleware/with-admin.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { ROLES } from '../../lib/constants.js';
import { emailSchema } from '../../lib/validation.js';
import { logAudit } from '../../lib/audit.js';
import { generateToken, hashToken, tokenExpiresAt } from '../../lib/auth-utils.js';
import { sendEmail } from '../../lib/email.js';
import { accountInviteEmail } from '../../lib/email-templates.js';

const rowSchema = z.object({
  institutionName: z.string().trim().min(1),
  abbreviation: z.string().trim().min(1),
  piName: z.string().trim().min(1),
  piEmail: emailSchema,
  wholeShares: z.number().int().min(0),
  fractionalShares: z.number().min(0),
  activationToken: z.string().trim().min(1).optional(),
});

const uploadSchema = z.object({
  rows: z.array(rowSchema).min(1, 'At least one row is required'),
});

function getZodErrorDetails(err) {
  const firstError = err.issues?.[0] || err.errors?.[0];
  if (!firstError) {
    return { path: '', message: 'Invalid request' };
  }
  return {
    path: Array.isArray(firstError.path) ? firstError.path.join('.') : '',
    message: firstError.message || 'Invalid request',
  };
}

async function handler(req, res) {
  try {
    const body = uploadSchema.parse(req.body);

    const emails = body.rows.map((r) => r.piEmail);
    const uniqueEmails = new Set(emails);
    if (uniqueEmails.size !== emails.length) {
      const dupes = emails.filter((e, i) => emails.indexOf(e) !== i);
      return res.status(400).json({
        error: `Duplicate PI emails in upload: ${[...new Set(dupes)].join(', ')}`,
        code: 'DUPLICATE_IN_UPLOAD',
      });
    }

    const summary = {
      institutionsCreated: 0,
      institutionsExisting: 0,
      usersCreated: 0,
      usersExisting: 0,
      sharesUpserted: 0,
      inviteTokens: [],
    };

    for (const row of body.rows) {
      let [inst] = await db
        .select()
        .from(institutions)
        .where(ilike(institutions.abbreviation, row.abbreviation))
        .limit(1);

      if (!inst) {
        [inst] = await db.insert(institutions).values({
          name: row.institutionName,
          abbreviation: row.abbreviation,
        }).returning();
        summary.institutionsCreated++;
      } else {
        summary.institutionsExisting++;
      }

      let [pi] = await db.select().from(users).where(ilike(users.email, row.piEmail)).limit(1);
      if (!pi) {
        const activationToken = row.activationToken || generateToken();
        [pi] = await db.insert(users).values({
          email: row.piEmail,
          name: row.piName,
          role: ROLES.PI,
          institutionId: inst.id,
          isActive: true,
          isActivated: false,
          activationTokenHash: hashToken(activationToken),
          activationTokenExpiresAt: tokenExpiresAt(72),
        }).returning();
        summary.usersCreated++;
        summary.inviteTokens.push({ email: row.piEmail, name: row.piName, token: activationToken });
        void sendEmail({
          to: row.piEmail,
          ...accountInviteEmail({
            name: row.piName,
            email: row.piEmail,
            activationToken,
            institutionName: row.institutionName,
          }),
        });
      } else {
        summary.usersExisting++;
        if (pi.institutionId !== inst.id || pi.name !== row.piName) {
          await db.update(users).set({
            institutionId: inst.id,
            name: row.piName,
            updatedAt: new Date(),
          }).where(eq(users.id, pi.id));
        }
      }

      const [existingShare] = await db.select().from(masterShares).where(eq(masterShares.piId, pi.id)).limit(1);
      if (existingShare) {
        await db.update(masterShares).set({
          institutionId: inst.id,
          wholeShares: row.wholeShares,
          fractionalShares: String(row.fractionalShares),
          updatedAt: new Date(),
        }).where(eq(masterShares.id, existingShare.id));
      } else {
        await db.insert(masterShares).values({
          institutionId: inst.id,
          piId: pi.id,
          wholeShares: row.wholeShares,
          fractionalShares: String(row.fractionalShares),
        });
      }
      summary.sharesUpserted++;
    }

    await logAudit(req.user.userId, 'shares.upload', {
      rowCount: body.rows.length,
      institutionsCreated: summary.institutionsCreated,
      usersCreated: summary.usersCreated,
    });

    return res.status(200).json({ data: summary });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = getZodErrorDetails(err);
      return res.status(400).json({
        error: `Row validation error at ${firstError.path}: ${firstError.message}`,
        code: 'VALIDATION_ERROR',
      });
    }
    console.error('Share upload error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod('POST', handler));
