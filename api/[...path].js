import { createRouter } from '../lib/router.js';

import healthHandler from '../api-handlers/health.js';
import auditLogHandler from '../api-handlers/admin/audit-log.js';
import sendReminderHandler from '../api-handlers/admin/send-reminder.js';
import activateHandler from '../api-handlers/auth/activate.js';
import loginHandler from '../api-handlers/auth/login.js';
import logoutHandler from '../api-handlers/auth/logout.js';
import meHandler from '../api-handlers/auth/me.js';
import resetPasswordHandler from '../api-handlers/auth/reset-password.js';
import setPasswordHandler from '../api-handlers/auth/set-password.js';
import commentByIdHandler from '../api-handlers/comments/[id].js';
import commentsIndexHandler from '../api-handlers/comments/index.js';
import cycleArchiveHandler from '../api-handlers/cycles/[id]/archive.js';
import cycleDatesHandler from '../api-handlers/cycles/[id]/dates.js';
import cyclePreferencesHandler from '../api-handlers/cycles/[id]/preferences/index.js';
import cyclePreferenceStatusHandler from '../api-handlers/cycles/[id]/preferences/status.js';
import cycleSchedulesGenerateHandler from '../api-handlers/cycles/[id]/schedules/generate.js';
import cycleSchedulesIndexHandler from '../api-handlers/cycles/[id]/schedules/index.js';
import cycleSharesIndexHandler from '../api-handlers/cycles/[id]/shares/index.js';
import cycleSharesSnapshotHandler from '../api-handlers/cycles/[id]/shares/snapshot.js';
import cycleByIdHandler from '../api-handlers/cycles/[id].js';
import cyclesIndexHandler from '../api-handlers/cycles/index.js';
import institutionByIdHandler from '../api-handlers/institutions/[id].js';
import institutionsIndexHandler from '../api-handlers/institutions/index.js';
import notificationByIdHandler from '../api-handlers/notifications/[id].js';
import notificationsIndexHandler from '../api-handlers/notifications/index.js';
import scheduleAssignmentHandler from '../api-handlers/schedules/[id]/assignments/[assignmentId].js';
import schedulePublishHandler from '../api-handlers/schedules/[id]/publish.js';
import scheduleUnpublishHandler from '../api-handlers/schedules/[id]/unpublish.js';
import shareByIdHandler from '../api-handlers/shares/[id].js';
import sharesIndexHandler from '../api-handlers/shares/index.js';
import sharesUploadHandler from '../api-handlers/shares/upload.js';
import swapRequestByIdHandler from '../api-handlers/swap-requests/[id].js';
import swapRequestsIndexHandler from '../api-handlers/swap-requests/index.js';
import userResendInviteHandler from '../api-handlers/users/[id]/resend-invite.js';
import userRoleHandler from '../api-handlers/users/[id]/role.js';
import userByIdHandler from '../api-handlers/users/[id].js';
import usersIndexHandler from '../api-handlers/users/index.js';

const router = createRouter();

router.all('/health', healthHandler);

router.all('/admin/audit-log', auditLogHandler);
router.all('/admin/send-reminder', sendReminderHandler);

router.all('/auth/activate', activateHandler);
router.all('/auth/login', loginHandler);
router.all('/auth/logout', logoutHandler);
router.all('/auth/me', meHandler);
router.all('/auth/reset-password', resetPasswordHandler);
router.all('/auth/set-password', setPasswordHandler);

router.all('/comments', commentsIndexHandler);
router.all('/comments/:id', commentByIdHandler);

router.all('/cycles/:id/preferences/status', cyclePreferenceStatusHandler);
router.all('/cycles/:id/shares/snapshot', cycleSharesSnapshotHandler);
router.all('/cycles/:id/schedules/generate', cycleSchedulesGenerateHandler);
router.all('/cycles/:id/archive', cycleArchiveHandler);
router.all('/cycles/:id/dates', cycleDatesHandler);
router.all('/cycles/:id/preferences', cyclePreferencesHandler);
router.all('/cycles/:id/schedules', cycleSchedulesIndexHandler);
router.all('/cycles/:id/shares', cycleSharesIndexHandler);
router.all('/cycles', cyclesIndexHandler);
router.all('/cycles/:id', cycleByIdHandler);

router.all('/institutions', institutionsIndexHandler);
router.all('/institutions/:id', institutionByIdHandler);

router.all('/notifications', notificationsIndexHandler);
router.all('/notifications/:id', notificationByIdHandler);

router.all('/schedules/:id/assignments/:assignmentId', scheduleAssignmentHandler);
router.all('/schedules/:id/publish', schedulePublishHandler);
router.all('/schedules/:id/unpublish', scheduleUnpublishHandler);

router.all('/shares/upload', sharesUploadHandler);
router.all('/shares', sharesIndexHandler);
router.all('/shares/:id', shareByIdHandler);

router.all('/swap-requests', swapRequestsIndexHandler);
router.all('/swap-requests/:id', swapRequestByIdHandler);

router.all('/users/:id/resend-invite', userResendInviteHandler);
router.all('/users/:id/role', userRoleHandler);
router.all('/users', usersIndexHandler);
router.all('/users/:id', userByIdHandler);

export default function handler(req, res) {
  const pathSegments = Array.isArray(req.query.path)
    ? req.query.path
    : [req.query.path].filter(Boolean);
  const path = `/${pathSegments.join('/')}`;

  const matched = router.match(req.method, path);
  if (!matched) {
    return res.status(404).json({
      error: `API route not found: ${req.method} /api${path}`,
      code: 'NOT_FOUND',
    });
  }

  req.query = { ...req.query, ...matched.params };
  return matched.handler(req, res);
}
