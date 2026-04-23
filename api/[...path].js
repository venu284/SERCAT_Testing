import { createApiRouter, handleCatchAllRequest } from '../lib/api-catch-all.js';

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

const router = createApiRouter({
  health: healthHandler,
  adminAuditLog: auditLogHandler,
  adminSendReminder: sendReminderHandler,
  activate: activateHandler,
  login: loginHandler,
  logout: logoutHandler,
  me: meHandler,
  resetPassword: resetPasswordHandler,
  setPassword: setPasswordHandler,
  commentsIndex: commentsIndexHandler,
  commentById: commentByIdHandler,
  cyclePreferenceStatus: cyclePreferenceStatusHandler,
  cycleSharesSnapshot: cycleSharesSnapshotHandler,
  cycleSchedulesGenerate: cycleSchedulesGenerateHandler,
  cycleArchive: cycleArchiveHandler,
  cycleDates: cycleDatesHandler,
  cyclePreferences: cyclePreferencesHandler,
  cycleSchedulesIndex: cycleSchedulesIndexHandler,
  cycleSharesIndex: cycleSharesIndexHandler,
  cyclesIndex: cyclesIndexHandler,
  cycleById: cycleByIdHandler,
  institutionsIndex: institutionsIndexHandler,
  institutionById: institutionByIdHandler,
  notificationsIndex: notificationsIndexHandler,
  notificationById: notificationByIdHandler,
  scheduleAssignment: scheduleAssignmentHandler,
  schedulePublish: schedulePublishHandler,
  scheduleUnpublish: scheduleUnpublishHandler,
  sharesUpload: sharesUploadHandler,
  sharesIndex: sharesIndexHandler,
  shareById: shareByIdHandler,
  swapRequestsIndex: swapRequestsIndexHandler,
  swapRequestById: swapRequestByIdHandler,
  userResendInvite: userResendInviteHandler,
  userRole: userRoleHandler,
  usersIndex: usersIndexHandler,
  userById: userByIdHandler,
});

export default function handler(req, res) {
  return handleCatchAllRequest(router, req, res);
}
