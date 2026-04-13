import { desc, count, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { auditLog } from '../../db/schema/audit-log.js';
import { users } from '../../db/schema/users.js';
import { withAdmin } from '../../lib/middleware/with-admin.js';
import { withMethod } from '../../lib/middleware/with-method.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';

async function handler(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query || {});

    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        details: auditLog.details,
        createdAt: auditLog.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(auditLog);
    return res.status(200).json(paginatedResponse(rows, Number(total), page, limit));
  } catch (err) {
    console.error('Audit log error:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
}

export default withAdmin(withMethod('GET', handler));
