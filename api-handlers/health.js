import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

export default async function handler(req, res) {
  try {
    const result = await db.execute(sql`SELECT NOW() as now`);
    return res.status(200).json({
      data: {
        status: 'ok',
        database: 'connected',
        timestamp: result.rows?.[0]?.now || new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Health check failed:', err);
    return res.status(500).json({
      error: 'Database connection failed',
      code: 'DB_ERROR',
    });
  }
}
