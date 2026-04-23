import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { masterShares } from '../../db/schema/master-shares.js';
import { institutions } from '../../db/schema/institutions.js';
import { users } from '../../db/schema/users.js';
import { withAuth } from '../../lib/middleware/with-auth.js';
import { withMethod } from '../../lib/middleware/with-method.js';

async function handler(req, res) {
  try {
    let query = db
      .select({
        id: masterShares.id,
        institutionId: masterShares.institutionId,
        institutionName: institutions.name,
        institutionAbbreviation: institutions.abbreviation,
        piId: masterShares.piId,
        piName: users.name,
        piEmail: users.email,
        wholeShares: masterShares.wholeShares,
        fractionalShares: masterShares.fractionalShares,
        updatedAt: masterShares.updatedAt,
      })
      .from(masterShares)
      .innerJoin(institutions, eq(masterShares.institutionId, institutions.id))
      .innerJoin(users, eq(masterShares.piId, users.id));

    if (req.user.role !== 'admin') {
      query = query.where(eq(masterShares.piId, req.user.userId));
    }

    const rows = await query.orderBy(institutions.name);

    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('Master shares error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAuth(withMethod('GET', handler));
