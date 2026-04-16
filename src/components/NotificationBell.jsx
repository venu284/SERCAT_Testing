import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../hooks/useApiData';
import { getNotificationPreviewItems, getUnreadNotificationCount } from '../lib/notification-bell-utils';
import { CONCEPT_THEME } from '../lib/theme';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const notificationsQuery = useNotifications();
  const markNotificationRead = useMarkNotificationRead();
  const markAllNotificationsRead = useMarkAllNotificationsRead();
  const notifications = Array.isArray(notificationsQuery.data) ? notificationsQuery.data : [];
  const unreadCount = getUnreadNotificationCount(notifications);
  const previewItems = useMemo(
    () => getNotificationPreviewItems(notifications, { limit: 20 }),
    [notifications],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const handleNotificationClick = (notification) => {
    if (!notification?.isRead) {
      markNotificationRead.mutate(notification.id);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border transition-all"
        style={{
          background: 'rgba(255,255,255,0.08)',
          borderColor: 'rgba(255,255,255,0.12)',
          color: 'white',
        }}
        aria-label="Toggle notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 9a5.5 5.5 0 1111 0v4.2l1.7 2.3a1 1 0 01-.8 1.6H5.6a1 1 0 01-.8-1.6l1.7-2.3V9z" />
          <path d="M10 19a2.2 2.2 0 004 0" />
        </svg>
        {unreadCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ background: '#cf3f3f', color: 'white' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-full z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-lg"
          style={{
            background: CONCEPT_THEME.warmWhite,
            borderColor: CONCEPT_THEME.borderLight,
            boxShadow: '0 20px 45px rgba(15,42,74,0.22)',
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: CONCEPT_THEME.borderLight }}>
            <div>
              <div className="text-sm font-bold" style={{ color: CONCEPT_THEME.navy }}>Notifications</div>
              <div className="text-xs" style={{ color: CONCEPT_THEME.muted }}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => markAllNotificationsRead.mutate()}
              disabled={unreadCount === 0 || markAllNotificationsRead.isPending}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notificationsQuery.isLoading ? (
              <div className="px-4 py-6 text-sm" style={{ color: CONCEPT_THEME.muted }}>
                Loading notifications...
              </div>
            ) : notificationsQuery.error ? (
              <div className="px-4 py-6 text-sm" style={{ color: CONCEPT_THEME.error }}>
                Unable to load notifications.
              </div>
            ) : previewItems.length === 0 ? (
              <div className="px-4 py-6 text-sm" style={{ color: CONCEPT_THEME.muted }}>
                No notifications yet
              </div>
            ) : (
              previewItems.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className="block w-full border-b px-4 py-3 text-left transition-all last:border-b-0"
                  style={{
                    borderColor: CONCEPT_THEME.borderLight,
                    background: notification.isRead ? CONCEPT_THEME.warmWhite : `${CONCEPT_THEME.sky}0d`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div
                        className="truncate text-sm"
                        style={{
                          color: CONCEPT_THEME.text,
                          fontWeight: notification.isRead ? 600 : 700,
                        }}
                      >
                        {notification.title}
                      </div>
                      <div className="mt-1 text-xs leading-5" style={{ color: CONCEPT_THEME.muted }}>
                        {notification.preview}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-[11px]" style={{ color: CONCEPT_THEME.subtle }}>
                      {notification.timeAgo}
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] font-semibold" style={{ color: notification.isRead ? CONCEPT_THEME.subtle : CONCEPT_THEME.sky }}>
                    {notification.isRead ? 'Read' : 'Unread'}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
