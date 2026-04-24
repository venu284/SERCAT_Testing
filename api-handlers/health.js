import { db } from '../lib/db.js';
import { runPreviewAuthReadinessCheck } from '../lib/preview-auth-readiness.js';

export default async function handler(req, res) {
  const readiness = await runPreviewAuthReadinessCheck({ db });

  if (!readiness.ok) {
    return res.status(readiness.statusCode).json({
      error: readiness.error,
      code: readiness.code,
      checks: readiness.checks,
    });
  }

  return res.status(200).json({
    data: {
      status: 'ok',
      database: 'connected',
      timestamp: readiness.timestamp,
      checks: readiness.checks,
    },
  });
}
