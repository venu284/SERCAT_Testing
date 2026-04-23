import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatNotificationTimeAgo,
  getNotificationPreviewItems,
  getUnreadNotificationCount,
} from './notification-bell-utils.js';

test('getUnreadNotificationCount counts only unread notifications', () => {
  const count = getUnreadNotificationCount([
    { id: 'a', isRead: false },
    { id: 'b', isRead: true },
    { id: 'c', isRead: false },
  ]);

  assert.equal(count, 2);
});

test('getNotificationPreviewItems sorts newest first and truncates long messages', () => {
  const items = getNotificationPreviewItems([
    {
      id: 'older',
      title: 'Older',
      message: 'Short body',
      isRead: true,
      createdAt: '2026-04-13T10:00:00Z',
    },
    {
      id: 'newer',
      title: 'Newer',
      message: 'This message is intentionally much longer than fifty characters so it must be truncated.',
      isRead: false,
      createdAt: '2026-04-14T10:00:00Z',
    },
  ], { now: '2026-04-14T11:00:00Z', limit: 20 });

  assert.equal(items[0].id, 'newer');
  assert.equal(items[0].preview.endsWith('...'), true);
  assert.equal(items[0].timeAgo, '1h ago');
});

test('formatNotificationTimeAgo returns minute, hour, and day labels', () => {
  const now = '2026-04-14T12:00:00Z';

  assert.equal(formatNotificationTimeAgo('2026-04-14T11:57:00Z', now), '3m ago');
  assert.equal(formatNotificationTimeAgo('2026-04-14T10:00:00Z', now), '2h ago');
  assert.equal(formatNotificationTimeAgo('2026-04-11T12:00:00Z', now), '3d ago');
});
