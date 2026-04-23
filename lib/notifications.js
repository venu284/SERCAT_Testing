import { db } from '../db/index.js';
import { notifications } from '../db/schema/notifications.js';

export async function createNotification({ userId, type, title, message }) {
  try {
    await db.insert(notifications).values({ userId, type, title, message });
  } catch (err) {
    console.error('[NOTIFICATION ERROR] Failed to create notification:', err.message);
  }
}

export async function createBulkNotifications(entries) {
  try {
    if (!Array.isArray(entries) || entries.length === 0) return;
    await db.insert(notifications).values(entries);
  } catch (err) {
    console.error('[NOTIFICATION ERROR] Bulk insert failed:', err.message);
  }
}
