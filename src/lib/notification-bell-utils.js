function toTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function truncateNotificationMessage(message, maxLength = 50) {
  const trimmed = String(message || '').trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function formatNotificationTimeAgo(value, now = Date.now()) {
  const timestamp = toTimestamp(value);
  const nowTimestamp = typeof now === 'string' ? toTimestamp(now) : now;

  if (timestamp == null || nowTimestamp == null) return '';

  const diffMs = Math.max(0, nowTimestamp - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function getUnreadNotificationCount(notifications) {
  if (!Array.isArray(notifications)) return 0;
  return notifications.filter((notification) => !notification?.isRead).length;
}

export function getNotificationPreviewItems(notifications, options = {}) {
  const { now = Date.now(), limit = 20 } = options;

  if (!Array.isArray(notifications)) {
    return [];
  }

  return [...notifications]
    .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))
    .slice(0, limit)
    .map((notification) => ({
      ...notification,
      preview: truncateNotificationMessage(notification?.message || ''),
      timeAgo: formatNotificationTimeAgo(notification?.createdAt, now),
    }));
}
