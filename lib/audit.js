import { db } from '../db/index.js';
import { auditLog } from '../db/schema/audit-log.js';

export async function logAudit(userId, action, details = {}) {
  try {
    await db.insert(auditLog).values({
      userId,
      action,
      details,
    });
  } catch (err) {
    // Audit logging should never break the main operation
    console.error('Audit log failed:', err);
  }
}
