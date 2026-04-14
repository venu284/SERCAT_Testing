function toCommentStatusLabel(status) {
  if (status === 'read') return 'Read';
  if (status === 'replied') return 'Replied';
  return 'Sent';
}

function toEmptyString(value) {
  return value ?? '';
}

function toNewestFirst(a, b) {
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}

function normalizeBaseComment(comment) {
  return {
    id: comment.id,
    subject: comment.subject,
    message: comment.message,
    status: toCommentStatusLabel(comment.status),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    readAt: toEmptyString(comment.readAt),
    adminReply: toEmptyString(comment.adminReply),
    adminReplyAt: toEmptyString(comment.adminReplyAt),
  };
}

export function toMemberCommentHistory(comments) {
  if (!Array.isArray(comments)) return [];

  return comments
    .map((comment) => normalizeBaseComment(comment))
    .sort(toNewestFirst);
}

export function toAdminCommentInbox(comments) {
  if (!Array.isArray(comments)) return [];

  return comments
    .map((comment) => ({
      ...normalizeBaseComment(comment),
      memberId: comment.institutionAbbreviation || comment.institutionName || 'PI',
      memberName: comment.institutionName || comment.institutionAbbreviation || 'Unknown institution',
      piName: comment.piName || 'Principal Investigator',
      piEmail: comment.piEmail || '-',
    }))
    .sort(toNewestFirst);
}
