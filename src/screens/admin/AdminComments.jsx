import React, { useMemo, useRef, useState } from 'react';
import { CONCEPT_THEME } from '../../lib/theme';
import { useComments, useUpdateComment } from '../../hooks/useApiData';
import { toAdminCommentInbox } from '../../lib/comments-view-models';

function buildStatusTone(status) {
  if (status === 'Read') {
    return { bg: CONCEPT_THEME.amberLight, color: CONCEPT_THEME.accentOnAccent };
  }
  if (status === 'Replied') {
    return { bg: CONCEPT_THEME.tealLight, color: CONCEPT_THEME.teal };
  }
  return { bg: CONCEPT_THEME.skyLight, color: CONCEPT_THEME.sky };
}

export default function AdminComments() {
  const commentsQuery = useComments();
  const updateComment = useUpdateComment();

  const [expandedCommentId, setExpandedCommentId] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyError, setReplyError] = useState('');
  const [replySuccessId, setReplySuccessId] = useState('');
  const readMarkedIdsRef = useRef(new Set());
  const pendingReplyIdsRef = useRef(new Set());
  const [pendingReplyIds, setPendingReplyIds] = useState({});

  const inbox = useMemo(() => toAdminCommentInbox(commentsQuery.data), [commentsQuery.data]);

  const handleToggle = (entry) => {
    const nextExpanded = expandedCommentId === entry.id ? '' : entry.id;
    setExpandedCommentId(nextExpanded);
    setReplyError('');
    setReplySuccessId('');

    if (nextExpanded && entry.status === 'Sent' && !readMarkedIdsRef.current.has(entry.id)) {
      readMarkedIdsRef.current.add(entry.id);
      updateComment.mutate({ id: entry.id, status: 'read' });
    }
  };

  const handleReplySubmit = async (entry) => {
    if (pendingReplyIdsRef.current.has(entry.id)) return;

    const replyText = (replyDrafts[entry.id] ?? entry.adminReply ?? '').trim();

    if (!replyText) {
      setReplyError('Reply message is required.');
      setReplySuccessId('');
      return;
    }

    pendingReplyIdsRef.current.add(entry.id);
    setPendingReplyIds((prev) => ({ ...prev, [entry.id]: true }));
    setReplyError('');
    setReplySuccessId('');

    try {
      await updateComment.mutateAsync({ id: entry.id, adminReply: replyText });
      setReplyDrafts((prev) => ({ ...prev, [entry.id]: replyText }));
      setReplySuccessId(entry.id);
    } catch (err) {
      setReplyError(err?.message || 'Unable to save reply.');
    } finally {
      pendingReplyIdsRef.current.delete(entry.id);
      setPendingReplyIds((prev) => {
        if (!prev[entry.id]) return prev;
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    }
  };

  const hasInbox = inbox.length > 0;
  const showLoading = commentsQuery.isLoading && !hasInbox;
  const showQueryError = commentsQuery.isError && !hasInbox;
  const showInlineQueryError = commentsQuery.isError && hasInbox;

  return (
    <div className="space-y-4 concept-font-body concept-anim-fade">
      <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <h3 className="concept-font-display text-xl font-bold" style={{ color: CONCEPT_THEME.navy }}>Member Comments</h3>
        <p className="mt-1 text-sm" style={{ color: CONCEPT_THEME.muted }}>
          Review member questions, mark them as read through normal viewing, and send a single admin reply.
        </p>
      </div>

      <div className="rounded-2xl border bg-white px-5 py-5 shadow-sm" style={{ borderColor: CONCEPT_THEME.borderLight }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="concept-font-display text-lg font-bold" style={{ color: CONCEPT_THEME.navy }}>Inbox</h4>
          <span className="rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}>
            {inbox.length} messages
          </span>
        </div>

        {showLoading ? (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
            Loading member comments...
          </div>
        ) : showQueryError ? (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
            Unable to load the comments inbox.
          </div>
        ) : !hasInbox ? (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.muted }}>
            No member comments available yet.
          </div>
        ) : (
          <div className="space-y-3">
            {showInlineQueryError ? (
              <div className="rounded-xl border px-4 py-3 text-sm" style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.borderLight, color: CONCEPT_THEME.muted }}>
                Unable to load the comments inbox.
              </div>
            ) : null}
            {inbox.map((entry) => {
              const tone = buildStatusTone(entry.status);
              const expanded = expandedCommentId === entry.id;
              const replyValue = replyDrafts[entry.id] ?? entry.adminReply ?? '';
              const replyPending = Boolean(pendingReplyIds[entry.id]);
              const institutionName = entry.memberName;
              const piName = entry.piName;
              const piEmail = entry.piEmail;

              return (
                <div key={entry.id} className="rounded-2xl border" style={{ background: CONCEPT_THEME.warmWhite, borderColor: CONCEPT_THEME.borderLight }}>
                  <button
                    type="button"
                    onClick={() => handleToggle(entry)}
                    className="w-full px-4 py-4 text-left"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}>
                            {entry.memberId}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: CONCEPT_THEME.navy }}>
                            {institutionName}
                          </span>
                        </div>
                        <div className="mt-2 text-base font-semibold" style={{ color: CONCEPT_THEME.text }}>
                          {entry.subject || 'Untitled message'}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                          PI: {piName} | {piEmail}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                          Submitted {new Date(entry.createdAt).toLocaleString()}
                        </div>
                        <div className="mt-2 truncate text-sm" style={{ color: CONCEPT_THEME.muted }}>
                          {entry.message}
                        </div>
                      </div>
                      <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: tone.bg, color: tone.color }}>
                        {entry.status}
                      </span>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="border-t px-4 py-4" style={{ borderColor: CONCEPT_THEME.borderLight }}>
                      <div className="rounded-2xl border px-4 py-4" style={{ background: CONCEPT_THEME.cream, borderColor: CONCEPT_THEME.border }}>
                        <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CONCEPT_THEME.navyMuted }}>
                          Member Message
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6" style={{ color: CONCEPT_THEME.text }}>
                          {entry.message}
                        </p>
                      </div>

                      <div className="mt-4">
                        <label className="mb-1.5 block text-sm font-semibold" style={{ color: CONCEPT_THEME.text }}>
                          Admin Reply
                        </label>
                        <textarea
                          value={replyValue}
                          onChange={(event) => {
                            setReplyDrafts((prev) => ({ ...prev, [entry.id]: event.target.value }));
                            setReplyError('');
                            if (replySuccessId === entry.id) setReplySuccessId('');
                          }}
                          rows={4}
                          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition"
                          style={{ background: CONCEPT_THEME.sand, borderColor: CONCEPT_THEME.border, color: CONCEPT_THEME.text, resize: 'vertical' }}
                          placeholder="Type a reply back to this member."
                        />
                        {entry.adminReplyAt ? (
                          <div className="mt-2 text-xs" style={{ color: CONCEPT_THEME.muted }}>
                            Last replied {new Date(entry.adminReplyAt).toLocaleString()}
                          </div>
                        ) : null}
                      </div>

                      {replyError ? (
                        <div className="mt-4 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.errorLight, borderColor: `${CONCEPT_THEME.error}33`, color: CONCEPT_THEME.error }}>
                          {replyError}
                        </div>
                      ) : null}
                      {replySuccessId === entry.id ? (
                        <div className="mt-4 rounded-xl border px-3 py-2 text-sm" style={{ background: CONCEPT_THEME.emeraldLight, borderColor: `${CONCEPT_THEME.emerald}33`, color: CONCEPT_THEME.emerald }}>
                          Reply saved.
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReplySubmit(entry)}
                          disabled={replyPending}
                          className="rounded-xl px-4 py-2.5 text-sm font-bold"
                          style={{ background: CONCEPT_THEME.navy, color: 'white', opacity: replyPending ? 0.7 : 1 }}
                        >
                          {replyPending ? 'Saving...' : entry.adminReply ? 'Update Reply' : 'Send Reply'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
