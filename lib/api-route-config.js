export const apiRoutes = [
  {
    pattern: '/health',
    handlerKey: 'health',
    handlerFile: 'api-handlers/health.js',
  },
  {
    pattern: '/admin/audit-log',
    handlerKey: 'adminAuditLog',
    handlerFile: 'api-handlers/admin/audit-log.js',
  },
  {
    pattern: '/admin/send-reminder',
    handlerKey: 'adminSendReminder',
    handlerFile: 'api-handlers/admin/send-reminder.js',
  },
  {
    pattern: '/auth/activate',
    handlerKey: 'activate',
    handlerFile: 'api-handlers/auth/activate.js',
  },
  {
    pattern: '/auth/login',
    handlerKey: 'login',
    handlerFile: 'api-handlers/auth/login.js',
  },
  {
    pattern: '/auth/logout',
    handlerKey: 'logout',
    handlerFile: 'api-handlers/auth/logout.js',
  },
  {
    pattern: '/auth/me',
    handlerKey: 'me',
    handlerFile: 'api-handlers/auth/me.js',
  },
  {
    pattern: '/auth/reset-password',
    handlerKey: 'resetPassword',
    handlerFile: 'api-handlers/auth/reset-password.js',
  },
  {
    pattern: '/auth/set-password',
    handlerKey: 'setPassword',
    handlerFile: 'api-handlers/auth/set-password.js',
  },
  {
    pattern: '/comments',
    handlerKey: 'commentsIndex',
    handlerFile: 'api-handlers/comments/index.js',
  },
  {
    pattern: '/comments/:id',
    handlerKey: 'commentById',
    handlerFile: 'api-handlers/comments/[id].js',
  },
  {
    pattern: '/cycles/:id/preferences/status',
    handlerKey: 'cyclePreferenceStatus',
    handlerFile: 'api-handlers/cycles/[id]/preferences/status.js',
  },
  {
    pattern: '/cycles/:id/shares/snapshot',
    handlerKey: 'cycleSharesSnapshot',
    handlerFile: 'api-handlers/cycles/[id]/shares/snapshot.js',
  },
  {
    pattern: '/cycles/:id/schedules/generate',
    handlerKey: 'cycleSchedulesGenerate',
    handlerFile: 'api-handlers/cycles/[id]/schedules/generate.js',
  },
  {
    pattern: '/cycles/:id/archive',
    handlerKey: 'cycleArchive',
    handlerFile: 'api-handlers/cycles/[id]/archive.js',
  },
  {
    pattern: '/cycles/:id/dates',
    handlerKey: 'cycleDates',
    handlerFile: 'api-handlers/cycles/[id]/dates.js',
  },
  {
    pattern: '/cycles/:id/preferences',
    handlerKey: 'cyclePreferences',
    handlerFile: 'api-handlers/cycles/[id]/preferences/index.js',
  },
  {
    pattern: '/cycles/:id/schedules',
    handlerKey: 'cycleSchedulesIndex',
    handlerFile: 'api-handlers/cycles/[id]/schedules/index.js',
  },
  {
    pattern: '/cycles/:id/shares',
    handlerKey: 'cycleSharesIndex',
    handlerFile: 'api-handlers/cycles/[id]/shares/index.js',
  },
  {
    pattern: '/cycles',
    handlerKey: 'cyclesIndex',
    handlerFile: 'api-handlers/cycles/index.js',
  },
  {
    pattern: '/cycles/:id',
    handlerKey: 'cycleById',
    handlerFile: 'api-handlers/cycles/[id].js',
  },
  {
    pattern: '/institutions',
    handlerKey: 'institutionsIndex',
    handlerFile: 'api-handlers/institutions/index.js',
  },
  {
    pattern: '/institutions/:id',
    handlerKey: 'institutionById',
    handlerFile: 'api-handlers/institutions/[id].js',
  },
  {
    pattern: '/notifications',
    handlerKey: 'notificationsIndex',
    handlerFile: 'api-handlers/notifications/index.js',
  },
  {
    pattern: '/notifications/:id',
    handlerKey: 'notificationById',
    handlerFile: 'api-handlers/notifications/[id].js',
  },
  {
    pattern: '/schedules/:id/assignments/:assignmentId',
    handlerKey: 'scheduleAssignment',
    handlerFile: 'api-handlers/schedules/[id]/assignments/[assignmentId].js',
  },
  {
    pattern: '/schedules/:id/publish',
    handlerKey: 'schedulePublish',
    handlerFile: 'api-handlers/schedules/[id]/publish.js',
  },
  {
    pattern: '/schedules/:id/unpublish',
    handlerKey: 'scheduleUnpublish',
    handlerFile: 'api-handlers/schedules/[id]/unpublish.js',
  },
  {
    pattern: '/shares/upload',
    handlerKey: 'sharesUpload',
    handlerFile: 'api-handlers/shares/upload.js',
  },
  {
    pattern: '/shares',
    handlerKey: 'sharesIndex',
    handlerFile: 'api-handlers/shares/index.js',
  },
  {
    pattern: '/shares/:id',
    handlerKey: 'shareById',
    handlerFile: 'api-handlers/shares/[id].js',
  },
  {
    pattern: '/swap-requests',
    handlerKey: 'swapRequestsIndex',
    handlerFile: 'api-handlers/swap-requests/index.js',
  },
  {
    pattern: '/swap-requests/:id',
    handlerKey: 'swapRequestById',
    handlerFile: 'api-handlers/swap-requests/[id].js',
  },
  {
    pattern: '/users/:id/resend-invite',
    handlerKey: 'userResendInvite',
    handlerFile: 'api-handlers/users/[id]/resend-invite.js',
  },
  {
    pattern: '/users/:id/role',
    handlerKey: 'userRole',
    handlerFile: 'api-handlers/users/[id]/role.js',
  },
  {
    pattern: '/users',
    handlerKey: 'usersIndex',
    handlerFile: 'api-handlers/users/index.js',
  },
  {
    pattern: '/users/:id',
    handlerKey: 'userById',
    handlerFile: 'api-handlers/users/[id].js',
  },
];
