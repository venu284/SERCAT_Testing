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

export function toMemberCommentHistory(comments) {
  if (!Array.isArray(comments)) return [];

  return comments
    .map((comment) => ({
      id: comment.id,
      subject: comment.subject,
      message: comment.message,
      status: toCommentStatusLabel(comment.status),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      readAt: toEmptyString(comment.readAt),
      adminReply: toEmptyString(comment.adminReply),
      adminReplyAt: toEmptyString(comment.adminReplyAt),
    }))
    .sort(toNewestFirst);
}

export function toAdminCommentInbox(comments) {
  if (!Array.isArray(comments)) return [];

  return comments
    .map((comment) => ({
      id: comment.id,
      subject: comment.subject,
      message: comment.message,
      status: toCommentStatusLabel(comment.status),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      readAt: toEmptyString(comment.readAt),
      adminReply: toEmptyString(comment.adminReply),
      adminReplyAt: toEmptyString(comment.adminReplyAt),
      memberId: comment.institutionAbbreviation,
      memberName: comment.institutionName,
      piName: comment.piName,
      piEmail: comment.piEmail,
    }))
    .sort(toNewestFirst);
}
