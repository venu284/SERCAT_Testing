import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { institutions } from '../../db/schema/institutions.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withMethod } from '../../lib/middleware/with-method.js';

async function handler(req, res) {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: users.phone,
        roleTitle: users.roleTitle,
        institutionId: users.institutionId,
        institutionName: institutions.name,
        institutionAbbreviation: institutions.abbreviation,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .leftJoin(institutions, eq(users.institutionId, institutions.id))
      .where(and(eq(users.id, req.user.userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    }

    return res.status(200).json({ data: { user } });
  } catch (err) {
    console.error('Auth me error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withMethod('GET', withAuth(handler));
