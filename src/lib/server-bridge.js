import { normalizeMemberComments, normalizeShiftChangeRequests } from './normalizers.js';

function findMemberId(members, piId) {
  return members.find((member) => member._piUserId === piId)?.id || piId;
}

function toCommentStatusLabel(status) {
  if (status === 'read') return 'Read';
  if (status === 'replied') return 'Replied';
  return 'Sent';
}

function toSwapStatusLabel(status) {
  if (status === 'approved') return 'Approved';
  if (status === 'denied') return 'Rejected';
  return 'Pending';
}

function parsePreferredDates(preferredDates) {
  if (Array.isArray(preferredDates)) {
    return preferredDates.filter((value) => typeof value === 'string' && value.trim());
  }

  if (typeof preferredDates !== 'string' || !preferredDates.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(preferredDates);
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === 'string' && value.trim())
      : [];
  } catch {
    return [];
  }
}

export function mapServerCommentsToMemberComments(serverComments, members = []) {
  const grouped = Object.fromEntries(members.map((member) => [member.id, []]));

  if (!Array.isArray(serverComments)) {
    return normalizeMemberComments(grouped, members);
  }

  serverComments.forEach((comment) => {
    const memberId = findMemberId(members, comment.piId);
    if (!grouped[memberId]) grouped[memberId] = [];

    grouped[memberId].push({
      id: comment.id,
      memberId,
      subject: comment.subject,
      message: comment.message,
      status: toCommentStatusLabel(comment.status),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      readAt: comment.readAt || '',
      adminReply: comment.adminReply || '',
      adminReplyAt: comment.adminReplyAt || '',
    });
  });

  return normalizeMemberComments(grouped, members);
}

export function mapServerSwapRequestsToShiftChangeRequests(serverSwaps, members = []) {
  if (!Array.isArray(serverSwaps)) {
    return [];
  }

  return normalizeShiftChangeRequests(serverSwaps.map((swap) => {
    const memberId = findMemberId(members, swap.requesterId);
    const preferredDates = parsePreferredDates(swap.preferredDates);
    const assignedDate = swap.targetAssignment?.assignedDate || '';
    const assignedShift = swap.targetAssignment?.shift || '';
    const approved = swap.status === 'approved';

    return {
      id: swap.id,
      memberId,
      sourceDate: assignedDate,
      sourceShift: assignedShift,
      requestedDate: preferredDates[0] || '',
      requestedShift: '',
      reason: '',
      status: toSwapStatusLabel(swap.status),
      createdAt: swap.createdAt,
      adminNote: swap.adminNotes || '',
      reassignedDate: approved ? assignedDate : '',
      reassignedShift: approved ? assignedShift : '',
      resolvedAt: swap.reviewedAt || '',
      _swapId: swap.id,
      _scheduleId: swap.scheduleId,
      _targetAssignmentId: swap.targetAssignmentId,
    };
  }));
}
