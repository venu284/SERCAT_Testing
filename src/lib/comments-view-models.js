function toCommentStatusLabel(status) {
  if (status === 'read') return 'Read';
  if (status === 'replied') return 'Replied';
  if (status === 'resolved') return 'Resolved';
  return 'Sent';
}

function toNewestFirst(a, b) {
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}

function normalizeBaseComment(comment) {
  return {
    id: comment.id,
    subject: comment.subject,
    status: toCommentStatusLabel(comment.status),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    readAt: comment.readAt ?? '',
    messages: Array.isArray(comment.messages) ? comment.messages : [],
  };
}

export function toMemberCommentHistory(comments) {
  if (!Array.isArray(comments)) return [];

  return comments
    .map((comment) => ({
      ...normalizeBaseComment(comment),
      canReply: comment.status !== 'resolved',
    }))
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
